import type { StorageConstructor } from '..';
import { IndexedDBBlobStorage } from './blob';
import { IndexedDBBlobSyncStorage } from './blob-sync';
import { IndexedDBDocStorage } from './doc';
import { IndexedDBDocSyncStorage } from './doc-sync';

export * from './blob';
export * from './blob-sync';
export * from './doc';
export * from './doc-sync';

export const idbStorages = [
  IndexedDBDocStorage,
  IndexedDBBlobStorage,
  IndexedDBDocSyncStorage,
  IndexedDBBlobSyncStorage,
] satisfies StorageConstructor[];
