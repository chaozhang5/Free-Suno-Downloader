import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from 'react/jsx-runtime';
import { localizedProps } from './index';
export { Fragment };
export type { JSX } from 'react/jsx-runtime';
export const jsx: typeof reactJsx = (type, props, key) => reactJsx(type, localizedProps(props as Record<string, unknown> | null), key);
export const jsxs: typeof reactJsxs = (type, props, key) => reactJsxs(type, localizedProps(props as Record<string, unknown> | null), key);
