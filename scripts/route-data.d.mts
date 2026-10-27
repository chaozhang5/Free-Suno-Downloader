export interface SeoRoute { path: string; page: string; slug?: string; canonicalPath: string; indexable: boolean; locale: string }
export const routes: SeoRoute[];
export const localePrefixes: Record<string, string>;
export const primaryRoutes: SeoRoute[];
export const manifest: { pages: Record<string, { title: string; description: string }>; routes: SeoRoute[] };
