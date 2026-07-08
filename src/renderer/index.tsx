import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n';
import App from '@/App';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import About from '@/pages/About';
import './styles/global.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <I18nProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Home />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about" element={<About />} />
            </Route>
          </Routes>
        </HashRouter>
      </I18nProvider>
    </React.StrictMode>,
  );
}
