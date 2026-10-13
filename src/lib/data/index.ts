/**
 * Persistence. Components and the session store only ever see `DataStore`;
 * which implementation is behind it is decided by `getDataStore()`.
 */

export * from './types';
export { LocalStore, getDataStore, resetDataStore } from './LocalStore';
