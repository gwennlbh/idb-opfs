type ObservableHandle = FileSystemHandle | FileSystemSyncAccessHandle;

export type FileSystemChangeType = 'appeared' | 'disappeared' | 'errored' | 'modified' | 'moved' | 'unknown';

export interface FileSystemChangeRecord {
  changedHandle: ObservableHandle | null;
  relativePathComponents: string[];
  relativePathMovedFrom: string[] | null;
  root: ObservableHandle;
  type: FileSystemChangeType;
}

export type FileSystemObserverCallback = (records: FileSystemChangeRecord[], observer: FileSystemObserver) => void;

interface HandleMetadata {
  path: string[];
}

interface Observation {
  root: ObservableHandle;
  path: string[];
}

const handleMetadata = new WeakMap<ObservableHandle, HandleMetadata>();
const observers = new Set<FileSystemObserver>();

const isPathWithin = (path: string[], rootPath: string[]): boolean => {
  if (path.length < rootPath.length) {
    return false;
  }
  return rootPath.every((component, index) => path[index] === component);
};

const relativePath = (path: string[], rootPath: string[]): string[] => {
  return path.slice(rootPath.length);
};

export const setFileSystemHandleMetadata = (handle: ObservableHandle, path: string[]): void => {
  handleMetadata.set(handle, { path });
};

export const notifyFileSystemObservers = (
  type: FileSystemChangeType,
  changedHandle: ObservableHandle | null,
  path: string[],
  relativePathMovedFrom: string[] | null = null,
): void => {
  for (const observer of observers) {
    observer.queueRecord(type, changedHandle, path, relativePathMovedFrom);
  }
};

export class FileSystemObserver {
  readonly #callback: FileSystemObserverCallback;
  readonly #observations = new Map<ObservableHandle, Observation>();
  #records: FileSystemChangeRecord[] = [];
  #scheduled = false;

  constructor(callback: FileSystemObserverCallback) {
    if (typeof callback !== 'function') {
      throw new TypeError('FileSystemObserver callback must be a function');
    }
    this.#callback = callback;
  }

  async observe(handle: ObservableHandle): Promise<void> {
    const metadata = handleMetadata.get(handle);
    if (!metadata) {
      throw new DOMException('The supplied handle is not managed by opfs-mock.', 'NotFoundError');
    }

    this.#observations.set(handle, { root: handle, path: metadata.path });
    observers.add(this);
  }

  disconnect(): void {
    this.#observations.clear();
    this.#records = [];
    this.#scheduled = false;
    observers.delete(this);
  }

  queueRecord(
    type: FileSystemChangeType,
    changedHandle: ObservableHandle | null,
    path: string[],
    relativePathMovedFrom: string[] | null,
  ): void {
    for (const observation of this.#observations.values()) {
      if (!isPathWithin(path, observation.path)) {
        continue;
      }

      this.#records.push({
        changedHandle: type === 'disappeared' || type === 'errored' || type === 'unknown' ? null : changedHandle,
        relativePathComponents: relativePath(path, observation.path),
        relativePathMovedFrom,
        root: observation.root,
        type,
      });
    }

    if (this.#records.length > 0 && !this.#scheduled) {
      this.#scheduled = true;
      queueMicrotask(() => {
        this.#scheduled = false;
        const records = this.#records;
        this.#records = [];
        if (records.length > 0) {
          this.#callback(records, this);
        }
      });
    }
  }
}

export const installFileSystemObserver = (): void => {
  Object.defineProperty(globalThis, 'FileSystemObserver', {
    configurable: true,
    value: FileSystemObserver,
    writable: true,
  });
};
