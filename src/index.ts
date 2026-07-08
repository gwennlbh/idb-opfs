import { fileSystemDirectoryHandleFactory } from './opfs';
import { installFileSystemObserver } from './observer';
import { getSizeOfDirectory } from './utils';
import type { PermissionHandler } from './types';
import { IDB_DATABASE_NAME } from './idbmap';
import { deleteDB } from 'idb';

export interface StorageFactoryOptions extends StorageEstimate {
  queryPermission?: PermissionHandler;
  requestPermission?: PermissionHandler;
}

export const storageFactory = async ({
  usage = 0,
  quota = 1024 ** 3,
  queryPermission,
  requestPermission,
}: StorageFactoryOptions = {}): Promise<StorageManager> => {
  const root = await fileSystemDirectoryHandleFactory('root', { queryPermission, requestPermission });

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

export const mockOPFS = async (): Promise<void> => {
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
      value: await storageFactory(),
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
