import localeRegistry from './locales.json';

export type LanguageCode = 'en' | 'es' | 'pt-BR' | 'zh-CN' | 'ja' | 'de' | 'fr' | 'it' | 'ru' | 'ar' | 'hi' | 'id' | 'vi' | 'ko' | 'tr' | 'th' | 'pl' | 'nl';
export const languages = localeRegistry as { code: LanguageCode; label: string; prefix: string }[];

export function selectedLanguage(pathname: string) {
  return languages.find(({ prefix }) => prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) ?? languages[0];
}

export function localizePath(path: string, code: LanguageCode) {
  const prefix = languages.find((item) => item.code === code)?.prefix ?? '';
  return `${prefix}${path}` || '/';
}

export function basePath(pathname: string) {
  const { prefix } = selectedLanguage(pathname);
  const path = prefix ? pathname.slice(prefix.length) || '/' : pathname;
  return /^\/(?:en\/)?downloader\/?$/.test(path)
    ? '/tools/downloader/' : path;
}

export function languageSwitchPath(pathname: string, code: LanguageCode) {
  return localizePath(basePath(pathname), code);
}

export function currentDownloaderPath(pathname: string) {
  return localizePath('/tools/downloader/', selectedLanguage(pathname).code);
}
