interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemWritableFileStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<'granted' | 'denied' | 'prompt'>;
}

interface Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}
