import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import { iframeHost } from '@/plugins/iframe';
import App from '@/App';
import Home from '@/pages/Home';
import Tools from '@/pages/Tools';
import About from '@/pages/About';
import Store from '@/pages/Store';
import './styles/global.css';

// Expose shared libraries so store plugins can use webpack externals
// instead of bundling their own copy.
(window as any).__chamShared = {
  react: React,
  reactDom: ReactDOM,
  framerMotion: motion,
};

// Initialize the iframe host for dev-mode plugin HMR
iframeHost.init();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <I18nProvider>
        <PluginRegistryProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<App />}>
                <Route index element={<Home />} />
                <Route path="tools" element={<Tools />} />
                <Route path="store" element={<Store />} />
                <Route path="about" element={<About />} />
              </Route>
            </Routes>
          </HashRouter>
        </PluginRegistryProvider>
      </I18nProvider>
    </React.StrictMode>,
  );
}
