/**
 * IframeHost — host-side message router for plugin iframes.
 *
 * Plugin iframes use postMessage to access window.cham APIs (since
 * contextBridge/preload doesn't run in iframes). The host listens for
 * "cham-call" messages, routes them to the real window.cham, and posts
 * the result back as "cham-result".
 *
 * Usage:
 *   iframeHost.init();  // once at app startup
 */

type EventCallback = (...args: any[]) => void;

interface IframeSubscription {
  pluginId: string;
  unsubscribe: () => void;
}

class IframeHost {
  /** Active subscriptions from plugin iframes (for cleanup) */
  private subscriptions = new Map<string, IframeSubscription[]>();
  private _initialized = false;

  /** Call once at app startup to register the global message listener. */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    window.addEventListener('message', this.handleMessage);
    console.log('[IframeHost] Initialized');
  }

  /** Remove all listeners and subscriptions. */
  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    for (const [, subs] of this.subscriptions) {
      for (const s of subs) {
        try { s.unsubscribe(); } catch { /* ignore */ }
      }
    }
    this.subscriptions.clear();
  }

  /** Clean up subscriptions for a specific plugin. */
  cleanupPlugin(pluginId: string): void {
    const subs = this.subscriptions.get(pluginId);
    if (!subs) return;
    for (const s of subs) {
      try { s.unsubscribe(); } catch { /* ignore */ }
    }
    this.subscriptions.delete(pluginId);
  }

  // ── Private ──

  private handleMessage = (event: MessageEvent): void => {
    const { type } = event.data || {};
    if (type !== 'cham-call' && type !== 'cham-ready') return;

    const sourceWindow = event.source as Window | null;
    if (!sourceWindow) return;

    if (type === 'cham-ready') {
      // Extract a plugin identifier from the iframe if possible (for logging)
      console.log('[IframeHost] Plugin iframe bridge ready');
      return;
    }

    // cham-call: route to real API
    const { id, method, args } = event.data;
    this.routeCall(sourceWindow, id, method, args || []);
  };

  private async routeCall(
    sourceWindow: Window,
    id: string,
    method: string,
    args: any[],
  ): Promise<void> {
    try {
      const cham = (window as any).cham;
      if (!cham) throw new Error('window.cham not available');

      // Walk the method path: "plugin.call" → window.cham.plugin.call
      const parts = method.split('.');
      let target: any = cham;
      for (const part of parts) {
        target = target[part];
        if (target === undefined || target === null) {
          throw new Error(`Method "${method}" not found on window.cham`);
        }
      }

      if (typeof target !== 'function') {
        this.postResult(sourceWindow, id, target);
        return;
      }

      // Check if this is a subscription registration
      const lastArg = args.length > 0 ? args[args.length - 1] : undefined;
      if (lastArg === '__BRIDGE_SUBSCRIBE__') {
        const forwardArgs = args.slice(0, -1);
        this.handleSubscribe(sourceWindow, id, method, forwardArgs, target);
        return;
      }

      // Normal call
      const result = await target.apply(cham, args);

      // If plugin set background, apply it to host UI directly
      if (method === 'backgroundSetFromUrl' && result?.dataUrl) {
        this.applyHostBackground(result.dataUrl);
      }

      this.postResult(sourceWindow, id, result);
    } catch (err: any) {
      this.postError(sourceWindow, id, err.message || 'Unknown error');
    }
  }

  /** Apply a data URL as the host's CSS background */
  private applyHostBackground(dataUrl: string): void {
    if (!dataUrl) return;
    const root = document.documentElement;
    root.style.backgroundImage = `url(${dataUrl})`;
    root.style.backgroundSize = 'cover';
    root.style.backgroundPosition = 'center';
    root.style.backgroundRepeat = 'no-repeat';
    root.style.backgroundAttachment = 'fixed';
    root.setAttribute('data-has-background', '');
  }

  /**
   * Handle a subscription request from an iframe.
   * Calls the real API with a forwarding callback that posts events
   * back to the iframe via postMessage.
   */
  private handleSubscribe(
    sourceWindow: Window,
    id: string,
    method: string,
    forwardArgs: any[],
    realFn: (...args: any[]) => any,
  ): void {
    try {
      const channel = this.getSubscribeChannel(method, forwardArgs);

      const forwardCb = (...cbArgs: any[]) => {
        try {
          sourceWindow.postMessage(
            { type: 'cham-event', channel, args: cbArgs },
            '*',
          );
        } catch {
          // iframe may be gone
        }
      };

      const unsubscribe = realFn(...forwardArgs, forwardCb);

      // Store for cleanup — use method+args as key
      const key = `${method}:${forwardArgs.join(':')}`;
      if (typeof unsubscribe === 'function') {
        const existing = this.subscriptions.get(key) || [];
        existing.push({ pluginId: key, unsubscribe });
        this.subscriptions.set(key, existing);
      }

      this.postResult(sourceWindow, id, unsubscribe);
    } catch (err: any) {
      this.postError(sourceWindow, id, err.message || 'Subscription failed');
    }
  }

  private getSubscribeChannel(method: string, args: any[]): string {
    if (method === 'plugin.subscribe') {
      return `plugin:${args[0]}:${args[1]}`;
    }
    // onUpdateAvailable, onUpdateProgress, onWindowStateChanged, onBackgroundChanged
    return method;
  }

  private postResult(target: Window, id: string, result: any): void {
    try { target.postMessage({ type: 'cham-result', id, result }, '*'); } catch { /* */ }
  }

  private postError(target: Window, id: string, error: string): void {
    try { target.postMessage({ type: 'cham-result', id, error }, '*'); } catch { /* */ }
  }
}

/** Singleton */
export const iframeHost = new IframeHost();
