import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import App from '@/App';
import Home from '@/pages/Home';
import Tools from '@/pages/Tools';
import About from '@/pages/About';
import Store from '@/pages/Store';
import './styles/global.css';

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
