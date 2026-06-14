import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import type { UploadedFile } from '../../common/types/uploaded-file';
import * as path from 'path';

@Injectable()
export class AzureBlobService {
  private readonly logger = new Logger(AzureBlobService.name);
  private readonly blobServiceClient: BlobServiceClient | null = null;
  private readonly containerClient: ContainerClient | null = null;
  private readonly containerName = 'user-avatars';
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'AZURE_STORAGE_CONNECTION_STRING',
    );

    if (!connectionString) {
      this.isMockMode = true;
      this.logger.warn(
        '⚠️ Azure Blob Storage not configured - running in MOCK MODE (file uploads not persisted)',
      );
      return;
    }

    try {
      this.isMockMode = false;
      this.blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(
        this.containerName,
      );
    } catch (error) {
      this.isMockMode = true;
      this.logger.error(
        `Failed to initialize Azure Blob Storage client: ${error instanceof Error ? error.message : String(error)}. Falling back to MOCK MODE.`,
      );
    }
  }

  async onModuleInit() {
    if (this.isMockMode) return;

    try {
      if (this.containerClient) {
        const exists = await this.containerClient.exists();
        if (!exists) {
          await this.containerClient.create({ access: 'blob' });
          this.logger.log(`Created container: ${this.containerName}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize container: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async uploadAvatar(file: UploadedFile, userId: string): Promise<string> {
    try {
      const extension = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `avatars/${userId}-${uniqueSuffix}${extension}`;

      if (this.isMockMode || !this.containerClient) {
        // Return a functional fallback URL for UI testing
        const mockUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userId)}&background=random&size=128`;
        this.logger.debug(`🔧 Mock upload (not persisted): ${mockUrl}`);
        return mockUrl;
      }

      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);

      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype,
        },
        metadata: {
          userId: userId,
          originalName: Buffer.from(file.originalname)
            .toString('ascii')
            .replace(/[^a-zA-Z0-9.-]/g, '_'),
          uploadedAt: new Date().toISOString(),
        },
      });

      const fileUrl = blockBlobClient.url;
      this.logger.log(`✅ Avatar uploaded: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload avatar to Azure: ${errorMessage}`);
      throw new Error(`Failed to upload avatar: ${errorMessage}`);
    }
  }
}
