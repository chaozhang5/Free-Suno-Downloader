import { jsxDEV as reactJsxDEV, Fragment } from 'react/jsx-dev-runtime';
import { localizedProps } from './index';
export { Fragment };
export type { JSX } from 'react/jsx-dev-runtime';
export const jsxDEV: typeof reactJsxDEV = (type, props, key, isStaticChildren, source, self) => reactJsxDEV(type, localizedProps(props as Record<string, unknown> | null), key, isStaticChildren, source, self);
