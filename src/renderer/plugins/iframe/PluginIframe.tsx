/**
 * PluginIframe — renders a store plugin inside a sandboxed iframe.
 *
 * Two modes:
 * - Dev:  loads bundle from plugin's webpack-dev-server via <script src>
 * - Prod: inlines the bundle source directly into srcdoc
 *
 * The bridge (postMessage-based window.cham proxy) is always inlined
 * into the srcdoc so the plugin can call Cham APIs transparently.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { BRIDGE_SOURCE } from './bridgeSource';

interface Props {
  pluginId: string;
  /** Dev server URL (e.g. "http://localhost:3001"). If set, dev mode. */
  url?: string;
  /** Bundle filename relative to dev server (e.g. "renderer.dev.js") */
  bundle?: string;
  /** Inline JS source for production mode */
  source?: string;
}

type Status = 'loading' | 'loaded' | 'error';

function buildSrcdoc(opts: { pluginId: string; url?: string; bundle?: string; source?: string }): string {
  const { pluginId, url, bundle = 'renderer.dev.js', source } = opts;

  const bundleTag = url
    ? `<script src="${url.replace(/\/+$/, '')}/${bundle}"></script>`
    : `<script>${source || ''}</script>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
  #root { width: 100%; height: 100%; display: flex; flex-direction: column; }
  body { background: #0f0f14; color: #ccc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
</style>
</head>
<body>
<div id="root"></div>
<script>window.__CHAM_PLUGIN_ID__ = '${pluginId}';</script>
<script>${BRIDGE_SOURCE}</script>
${bundleTag}
</body>
</html>`;
}

export default function PluginIframe({ pluginId, url, bundle, source }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const srcdoc = useMemo(
    () => buildSrcdoc({ pluginId, url, bundle, source }),
    [pluginId, url, bundle, source],
  );

  const handleLoad = useCallback(() => {
    setStatus('loaded');
    console.log(`[PluginIframe] "${pluginId}" loaded`);
  }, [pluginId]);

  const handleError = useCallback(() => {
    setStatus('error');
    setErrorMsg(`Failed to load plugin: ${pluginId}`);
  }, [pluginId]);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setErrorMsg('');
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <iframe
        key={retryKey}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          visibility: status === 'loaded' ? 'visible' : 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        onLoad={handleLoad}
        onError={handleError}
        title={pluginId}
      />

      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#0f0f14', color: '#888', fontSize: 14, gap: 12, zIndex: 1,
        }}>
          <div style={{
            width: 28, height: 28,
            border: '3px solid #333', borderTopColor: '#1098ad',
            borderRadius: '50%',
            animation: 'cham-spin 0.8s linear infinite',
          }} />
          <span>Loading {pluginId}…</span>
          <style>{`@keyframes cham-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#0f0f14', color: '#e06060', fontSize: 14, gap: 12, zIndex: 1,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e06060" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <circle cx="12" cy="16" r="0.5" fill="#e06060" />
          </svg>
          <span>{errorMsg}</span>
          <button onClick={handleRetry} style={{
            padding: '6px 18px', border: '1px solid #555', borderRadius: 6,
            background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: 13,
          }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
