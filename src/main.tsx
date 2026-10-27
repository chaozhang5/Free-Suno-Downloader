import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClientApp, preloadRoute } from './ClientApp';
import { loadLanguageMessages } from './i18n';
import { selectedLanguage } from './languages';
import { initializeAnalytics } from './analytics/posthog';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
const appRoot = root;
const application = <StrictMode><BrowserRouter><ClientApp /></BrowserRouter></StrictMode>;

async function start() {
  // Load the active route before hydrating so its first client render matches
  // the server-rendered page. Other routes remain split into on-demand chunks.
  try {
    await Promise.all([
      loadLanguageMessages(selectedLanguage(window.location.pathname).code),
      preloadRoute(window.location.pathname),
    ]);
  }
  catch (error) { console.error('Could not preload the current page chunk:', error); }
  if (appRoot.hasChildNodes()) hydrateRoot(appRoot, application);
  else createRoot(appRoot).render(application);
  initializeAnalytics();
}

void start();
