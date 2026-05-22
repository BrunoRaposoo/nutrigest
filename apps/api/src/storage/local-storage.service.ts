import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageService } from './storage.service';

@Injectable()
export class LocalStorageService implements StorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
  }

  async upload(
    fileBuffer: Buffer,
    _fileName: string,
    mimeType: string,
  ): Promise<string> {
    const ext = mimeType.split('/')[1] || 'bin';
    const uniqueName = `${randomUUID()}.${ext}`;
    const filePath = join(this.uploadDir, uniqueName);

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(filePath, fileBuffer);

    return `/uploads/${uniqueName}`;
  }

  async delete(url: string): Promise<void> {
    const fileName = url.replace('/uploads/', '');
    const filePath = join(this.uploadDir, fileName);

    try {
      await unlink(filePath);
    } catch {
      // File doesn't exist — idempotent
    }
  }
}
