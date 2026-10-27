import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { loadLanguageMessages, setServerPath } from './i18n';
import { selectedLanguage } from './languages';

export async function prerender(data: { url: string }) {
  setServerPath(data.url);
  await loadLanguageMessages(selectedLanguage(data.url).code);
  const html = renderToString(<MemoryRouter initialEntries={[data.url]}><App /></MemoryRouter>);
  return { html };
}
