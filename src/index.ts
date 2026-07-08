import { fileSystemDirectoryHandleFactory } from './opfs';
import { installFileSystemObserver } from './observer';
import { getSizeOfDirectory, makeLogger } from './utils';
import type { PermissionHandler } from './types';
import { IDB_DATABASE_NAME } from './idbmap';
import { deleteDB, openDB } from 'idb';

export interface StorageFactoryOptions extends StorageEstimate {
  queryPermission?: PermissionHandler;
  requestPermission?: PermissionHandler;
  debug?: boolean;
}

export const storageFactory = async ({
  usage = 0,
  quota = 1024 ** 3,
  queryPermission,
  requestPermission,
  debug = false,
}: StorageFactoryOptions = {}): Promise<StorageManager> => {
  const log = makeLogger({ debug });

  const root = await fileSystemDirectoryHandleFactory('root', { queryPermission, requestPermission }, undefined, undefined, 0, log);

  if (debug) {
    log('debug: list of idb tables');
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      if (!name.startsWith(IDB_DATABASE_NAME)) continue;

      const db = await openDB(name).catch((error) => ({ error }));
      if ('error' in db) {
        log(`debug: couldnt open database ${name}:`);
        log(db.error);
        continue;
      }

      // objectStoreNames is a DOMStringList, it's not iterable
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        const store = db.objectStoreNames[i];
        if (!store) continue;

        log(`idb store ${store}@${name}:`);
        try {
          for (const item of await db.getAll(store)) {
            log(`- ${item.key}: #${item.value.id} ${item.value.locked ? 'LOCKED' : ''}`);
          }
        } catch (error) {
          log(`- couldnt get items for this store:`);
          log(error);
        }
      }

      db.close();
    }
  }

  return {
    estimate: async (): Promise<StorageEstimate> => {
      const defaultUsage = usage;
      const calculatedUsage = await getSizeOfDirectory(root);

      return {
        usage: defaultUsage + calculatedUsage,
        quota,
      };
    },
    getDirectory: async (): Promise<FileSystemDirectoryHandle> => {
      return root;
    },
    persist: async (): Promise<boolean> => {
      return true;
    },
    persisted: async (): Promise<boolean> => {
      return true;
    },
  };
};

export const mockOPFS = async (options?: StorageFactoryOptions): Promise<void> => {
  // Navigator was added to Node.js in v21
  if (!('navigator' in globalThis)) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
      writable: true,
    });
  }

  if (!globalThis.navigator.storage) {
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: await storageFactory(options),
      writable: true,
    });
  }

  installFileSystemObserver();
};

export const resetMockOPFS = async (options: StorageFactoryOptions = {}): Promise<void> => {
  for (const db of await indexedDB.databases()) {
    if (!db.name) continue;
    if (db.name.startsWith(IDB_DATABASE_NAME)) {
      await deleteDB(db.name);
    }
  }

  // Clear the mock state, e.g., reset the root directory
  const root = await fileSystemDirectoryHandleFactory(
    'root',
    {
      queryPermission: options.queryPermission,
      requestPermission: options.requestPermission,
    },
    undefined,
    undefined,
    // Important, so that when opening the root on e.g. another thread
    // we get the same data
    0,
    makeLogger(options),
  );
  Object.defineProperty(globalThis.navigator.storage, 'getDirectory', {
    configurable: true,
    value: () => root,
    writable: true,
  });
};

// // Automatically add to globalThis if imported directly
// if (typeof globalThis !== 'undefined') {
//   void mockOPFS();
// }
