import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { I18nProvider } from './i18n';
import App from './App';
import './App.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <HashRouter>
    <I18nProvider>
      <App />
    </I18nProvider>
  </HashRouter>
);
