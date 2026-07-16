/**
 * Bridge source for injection into plugin iframes.
 *
 * This is the runtime bridge code as a string constant. It creates a
 * postMessage-based window.cham proxy so plugin code running in an
 * iframe can call Cham APIs transparently.
 *
 * Keep this in sync with bridge.ts (which is the documented reference).
 */
export const BRIDGE_SOURCE = String.raw`
(function() {
  var eventCbs = new Map();
  var msgId = 0;
  var pending = new Map();

  function sendCall(method, args) {
    var id = 'cif_' + (++msgId) + '_' + Date.now();
    return new Promise(function(resolve, reject) {
      var timer = setTimeout(function() {
        pending.delete(id);
        reject(new Error('[ChamBridge] "' + method + '" timed out'));
      }, 30000);
      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      parent.postMessage({ type: 'cham-call', id: id, method: method, args: args }, '*');
    });
  }

  function createProxy(path) {
    return new Proxy(function() {}, {
      get: function(target, prop) {
        if (typeof prop === 'symbol') return undefined;
        var nextPath = path.concat([prop]);
        var fullMethod = nextPath.join('.');

        // Subscription methods: register callback locally
        if (fullMethod === 'plugin.subscribe' ||
            fullMethod === 'onUpdateAvailable' ||
            fullMethod === 'onUpdateProgress' ||
            fullMethod === 'onWindowStateChanged' ||
            fullMethod === 'onBackgroundChanged' ||
            fullMethod === 'onTitleBarAction' ||
            fullMethod === 'onTitleBarActionsChanged') {
          return function() {
            var cb = arguments[arguments.length - 1];
            if (typeof cb !== 'function') {
              return sendCall(fullMethod, Array.prototype.slice.call(arguments));
            }
            var channel = fullMethod === 'plugin.subscribe'
              ? 'plugin:' + arguments[0] + ':' + arguments[1]
              : fullMethod;
            if (!eventCbs.has(channel)) eventCbs.set(channel, new Set());
            eventCbs.get(channel).add(cb);

            var forwardArgs = fullMethod === 'plugin.subscribe'
              ? [arguments[0], arguments[1], '__BRIDGE_SUBSCRIBE__']
              : ['__BRIDGE_SUBSCRIBE__'];
            sendCall(fullMethod, forwardArgs).catch(function() {});

            return function() {
              var set = eventCbs.get(channel);
              if (set) {
                set.delete(cb);
                if (set.size === 0) eventCbs.delete(channel);
              }
            };
          };
        }

        return createProxy(nextPath);
      },
      apply: function(target, thisArg, args) {
        return sendCall(path.join('.'), args);
      }
    });
  }

  window.addEventListener('message', function(event) {
    var d = event.data || {};
    if (d.type === 'cham-result') {
      var p = pending.get(d.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(d.id);
        if (d.error) p.reject(new Error(d.error));
        else p.resolve(d.result);
      }
    }
    if (d.type === 'cham-event') {
      var cbs = eventCbs.get(d.channel);
      if (cbs) {
        cbs.forEach(function(cb) {
          try { cb.apply(null, d.args || []); } catch(e) {}
        });
      }
    }
  });

  Object.defineProperty(window, 'cham', {
    value: createProxy([]),
    configurable: false,
    writable: false,
    enumerable: true
  });

  parent.postMessage({ type: 'cham-ready' }, '*');
})();
`.trim();
