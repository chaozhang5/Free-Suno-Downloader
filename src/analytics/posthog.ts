import { basePath, selectedLanguage } from '../languages';

const projectKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
const apiHost = import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
const entryKey = 'suno-download:posthog-entry-captured';
let lastPageViewPath: string | null = null;

export const analyticsEnabled = Boolean(projectKey);
type PostHogClient = typeof import('posthog-js').default;
type QueuedEvent = [string, Record<string, unknown>];
let posthogClient: PostHogClient | null = null;
let posthogLoading: Promise<void> | null = null;
const queuedEvents: QueuedEvent[] = [];

export function initializeAnalytics() {
  if (!projectKey || typeof window === 'undefined' || posthogLoading) return;
  posthogLoading = import('posthog-js').then(({ default: client }) => {
    client.init(projectKey, {
      api_host: apiHost,
      defaults: '2026-05-30',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
    });
    posthogClient = client;
    // Promote PostHog's persistent, browser-local anonymous ID to a person profile.
    // This ID is pseudonymous and is not tied to a name, email, or account.
    const browserId = client.get_distinct_id();
    if (browserId) client.identify(browserId);
    for (const [event, properties] of queuedEvents.splice(0)) client.capture(event, properties);
  }).catch(() => { posthogLoading = null; });
}

function capture(event: string, properties: Record<string, unknown>) {
  if (!analyticsEnabled) return;
  initializeAnalytics();
  if (posthogClient) posthogClient.capture(event, properties);
  else {
    queuedEvents.push([event, properties]);
    if (queuedEvents.length > 100) queuedEvents.shift();
  }
}

export function analyticsPageType(pathname: string) {
  const path = basePath(pathname);
  if (path === '/') return 'home';
  if (path === '/tools/') return 'tools_index';
  if (path === '/tools/downloader/') return 'downloader';
  if (path === '/tools/prompt-builder/') return 'prompt_builder';
  if (path.startsWith('/tools/')) return 'tool_info';
  if (path === '/articles/') return 'articles_index';
  if (path.startsWith('/articles/')) return 'article';
  if (path === '/about/') return 'about';
  return 'other';
}

function safeUrlProperties() {
  const pathname = window.location.pathname;
  let referrerDomain: string | null = null;
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer && referrer.origin !== window.location.origin) referrerDomain = referrer.hostname;
  } catch { /* Ignore malformed referrer values. */ }
  return {
    page_path: pathname,
    page_type: analyticsPageType(pathname),
    locale: selectedLanguage(pathname).code,
    $current_url: `${window.location.origin}${pathname}`,
    $pathname: pathname,
    $referrer: referrerDomain ? `https://${referrerDomain}/` : '',
    referrer_domain: referrerDomain,
  };
}

export function track(event: string, properties: Record<string, unknown> = {}) {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  capture(event, { ...safeUrlProperties(), ...properties });
}

export function trackPageView(pathname: string, locale: string, page: string, properties: Record<string, unknown> = {}) {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  if (lastPageViewPath === pathname) return;
  lastPageViewPath = pathname;
  let isEntryPage = false;
  try {
    isEntryPage = !window.sessionStorage.getItem(entryKey);
    if (isEntryPage) window.sessionStorage.setItem(entryKey, '1');
  } catch { isEntryPage = false; }

  const referrerDomain = safeUrlProperties().referrer_domain;
  const pageProperties = {
    ...safeUrlProperties(),
    page_path: pathname,
    page_type: page,
    locale,
    $current_url: `${window.location.origin}${pathname}`,
    is_entry_page: isEntryPage,
    ...properties,
  };
  capture('$pageview', pageProperties);

  if (isEntryPage) {
    const params = new URLSearchParams(window.location.search);
    const utm = (name: string) => params.get(name)?.slice(0, 100) || null;
    capture('site_entry', {
      ...pageProperties,
      entry_page_path: pathname,
      referrer_domain: referrerDomain,
      utm_source: utm('utm_source'),
      utm_medium: utm('utm_medium'),
      utm_campaign: utm('utm_campaign'),
    });
  }
}

export function trackNavigation(to: string, placement: string, linkId: string) {
  track('navigation_clicked', {
    from_page_path: window.location.pathname,
    to_page_path: to.split(/[?#]/, 1)[0],
    placement,
    link_id: linkId,
  });
}
