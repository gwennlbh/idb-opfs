// Experimental properties:
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/remove
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemObserver
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemChangeRecord

export type PermissionHandler = (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;

declare global {
  type FileSystemChangeType = 'appeared' | 'disappeared' | 'errored' | 'modified' | 'moved' | 'unknown';

  interface FileSystemChangeRecord {
    changedHandle: FileSystemHandle | FileSystemSyncAccessHandle | null;
    relativePathComponents: string[];
    relativePathMovedFrom: string[] | null;
    root: FileSystemHandle | FileSystemSyncAccessHandle;
    type: FileSystemChangeType;
  }

  type FileSystemObserverCallback = (records: FileSystemChangeRecord[], observer: FileSystemObserver) => void;

  interface FileSystemObserver {
    disconnect(): void;
    observe(handle: FileSystemHandle | FileSystemSyncAccessHandle): Promise<void>;
  }

  const FileSystemObserver: {
    prototype: FileSystemObserver;
    new (callback: FileSystemObserverCallback): FileSystemObserver;
  };

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    remove(options?: FileSystemRemoveOptions): Promise<void>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    remove(options?: FileSystemRemoveOptions): Promise<void>;
  }
}
