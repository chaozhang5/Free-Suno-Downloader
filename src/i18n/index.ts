import { selectedLanguage } from '../languages';
import overrides from './overrides.json';

type MessageMap = Record<string, string>;
const messageLoaders = import.meta.glob<{ default: MessageMap }>('./messages.*.json');
const messages: Record<string, MessageMap> = {};
const messagePromises: Partial<Record<string, Promise<void>>> = {};
let serverPath = '/';

export function setServerPath(path: string) { serverPath = path; }
export function loadLanguageMessages(locale: string) {
  if (messages[locale]) return Promise.resolve();
  if (messagePromises[locale]) return messagePromises[locale];
  const loader = messageLoaders[`./messages.${locale}.json`];
  if (!loader) return Promise.resolve();
  messagePromises[locale] = loader().then(({ default: values }) => {
    messages[locale] = { ...values, ...overrides[locale as keyof typeof overrides] };
  }).catch((error) => {
    delete messagePromises[locale];
    throw error;
  });
  return messagePromises[locale];
}
export function currentLanguage() {
  return selectedLanguage(typeof window === 'undefined' ? serverPath : window.location.pathname).code;
}
export function tr(source: string): string {
  if (source.trim() === 'Suno Download' || source.trim() === 'SUNO DOWNLOAD') return source;
  const translated = messages[currentLanguage()]?.[source.trim()];
  if (!translated) return source;
  return source.replace(source.trim(), translated);
}

export function localizedProps<T extends Record<string, unknown> | null>(props: T): T {
  if (!props) return props;
  const result: Record<string, unknown> = { ...props };
  if (Array.isArray(result.children)) result.children = result.children.map((child) => typeof child === 'string' ? tr(child) : child);
  for (const key of ['children', 'placeholder', 'aria-label', 'alt', 'title']) {
    if (typeof result[key] === 'string') result[key] = tr(result[key] as string);
  }
  return result as T;
}
