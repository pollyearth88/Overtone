'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` on the server and during hydration, `true` afterwards.
 *
 * Use it to defer rendering anything that depends on client-only state
 * (localStorage, matchMedia, time zone) until hydration is done, without
 * setting state inside an effect.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
