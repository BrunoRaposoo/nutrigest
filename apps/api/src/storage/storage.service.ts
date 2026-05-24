export interface StorageService {
  upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string>;
  delete(url: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
