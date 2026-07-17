/**
 * Cham Iframe Bridge — injected into plugin iframes to provide window.cham.
 *
 * Since contextBridge/preload does not run in iframes, this script creates a
 * postMessage-based proxy that mirrors the host's window.cham API surface.
 *
 * Protocol (messages sent via parent.postMessage):
 *   Request:  { type: 'cham-call',  id, method, args }
 *   Response: { type: 'cham-result', id, result?, error? }
 *   Event:    { type: 'cham-event', channel, args }
 *   Ready:    { type: 'cham-ready' }
 */

// ── Subscription registry ──
type EventCallback = (...args: any[]) => void;
const eventCallbacks = new Map<string, Set<EventCallback>>();

// ── Pending calls ──
let msgId = 0;
interface Pending {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, Pending>();

const TIMEOUT_MS = 30000;

function sendCall(method: string, args: any[]): Promise<any> {
  const id = `cif_${++msgId}_${Date.now()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`[ChamBridge] "${method}" timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    parent.postMessage({ type: 'cham-call', id, method, args }, '*');
  });
}

// ── Recursive Proxy builder ──
// Every property access appends to the path; function calls send the message.
function createProxy(path: string[]): any {
  return new Proxy(function () { /* empty callable */ }, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;

      const nextPath = [...path, prop];
      const fullMethod = nextPath.join('.');

      // ── Special: event listener methods ──
      // These register callbacks on the host side for push events.
      if (
        fullMethod === 'plugin.subscribe' ||
        fullMethod === 'onUpdateAvailable' ||
        fullMethod === 'onUpdateProgress' ||
        fullMethod === 'onWindowStateChanged' ||
        fullMethod === 'onBackgroundChanged' ||
        fullMethod === 'onTitleBarAction' ||
        fullMethod === 'onTitleBarActionsChanged'
      ) {
        return (...args: any[]) => {
          const cb = args[args.length - 1] as EventCallback;
          if (typeof cb !== 'function') {
            return sendCall(fullMethod, args);
          }

          // Register local callback
          const channel = fullMethod === 'plugin.subscribe'
            ? `plugin:${args[0]}:${args[1]}`
            : fullMethod;
          if (!eventCallbacks.has(channel)) {
            eventCallbacks.set(channel, new Set());
          }
          eventCallbacks.get(channel)!.add(cb);

          // Tell host to start forwarding (with a marker so host knows it's a subscription)
          const forwardArgs = fullMethod === 'plugin.subscribe'
            ? [args[0], args[1], '__BRIDGE_SUBSCRIBE__']
            : ['__BRIDGE_SUBSCRIBE__'];
          sendCall(fullMethod, forwardArgs).catch(() => {
            // Subscription registration failure is non-fatal
          });

          // Return unsubscribe function
          return () => {
            eventCallbacks.get(channel)?.delete(cb);
            if (eventCallbacks.get(channel)?.size === 0) {
              eventCallbacks.delete(channel);
            }
          };
        };
      }

      return createProxy(nextPath);
    },

    apply(_target, _thisArg, args) {
      const fullMethod = path.join('.');

      // Auto-prefix: plugin.call('channel', ...args) → plugin.call(pluginId, 'channel', ...args)
      // 1-2 args → auto-prefix; 3+ args → first arg is explicit target pluginId
      if (fullMethod === 'plugin.call' && args.length < 3) {
        const pluginId = (window as any).__CHAM_PLUGIN_ID__;
        if (pluginId) {
          args = [pluginId, ...args];
        }
      }

      return sendCall(fullMethod, args);
    },
  });
}

// ── Listen for responses & events from host ──
window.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'cham-result') {
    const { id, result, error } = event.data;
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    if (error) {
      p.reject(new Error(error));
    } else {
      p.resolve(result);
    }
  }

  if (type === 'cham-event') {
    const { channel, args } = event.data;
    const cbs = eventCallbacks.get(channel);
    if (cbs) {
      cbs.forEach((cb) => {
        try { cb(...(args || [])); } catch { /* don't break other listeners */ }
      });
    }
  }
});

// ── Install window.cham ──
Object.defineProperty(window, 'cham', {
  value: createProxy([]),
  configurable: false,
  writable: false,
  enumerable: true,
});

// ── Signal readiness to host ──
parent.postMessage({ type: 'cham-ready' }, '*');
