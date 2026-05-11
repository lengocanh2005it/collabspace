// src/infrastructure/services/azure-blob.service.ts
import { ConfigService } from '@nestjs/config';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuid } from 'uuid';

export interface AzureBlobUploadResponse {
  url: string;
  blobName: string;
  containerName: string;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
    }
  }
}

/**
 * Azure Blob Storage Service for file uploads
 * Handles uploading files to Azure Blob Storage and managing URLs
 * Supports both real Azure accounts and mock mode for development
 */
@Injectable()
export class AzureBlobService implements OnModuleInit {
  private readonly logger = new Logger(AzureBlobService.name);
  private blobServiceClient: BlobServiceClient | null = null;
  private containerName: string;
  private maxFileSize: number;
  private isConnected: boolean = false;

  constructor(private configService: ConfigService) {
    this.containerName =
      this.configService.get<string>('AZURE_STORAGE_CONTAINER_NAME') || 'task-attachments';
    this.maxFileSize =
      this.configService.get<number>('AZURE_STORAGE_MAX_FILE_SIZE') || 5 * 1024 * 1024; // 5MB default
  }

  async onModuleInit() {
    try {
      const connectionString = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');

      // ── Guard: skip real Azure setup if connection string is missing or is a placeholder ──
      if (!connectionString || connectionString.includes('your_')) {
        this.logger.warn(
          '⚠️  Azure Blob Storage not configured - running in MOCK MODE (file uploads not persisted)',
        );
        this.logger.warn(
          'To enable real Azure Blob Storage, configure AZURE_STORAGE_CONNECTION_STRING in .env',
        );
        return;
      }

      // ── Initialize the top-level BlobServiceClient from the connection string ──
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

      // ── Get a reference to the target container ──
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

      try {
        // ── Try to reach the container; throws ContainerNotFound if it does not exist ──
        await containerClient.getProperties();
        this.logger.log(`✅ Connected to existing Azure Blob Storage container: ${this.containerName}`);
      } catch (error: any) {
        if (error?.code === 'ContainerNotFound') {
          this.logger.warn(`Container "${this.containerName}" not found. Creating it...`);
          try {
            // ── FIX 1: Do NOT pass `access: 'blob'` here.
            //    Accounts with Hierarchical Namespace (ADLS Gen2) enabled do not support
            //    the public-access-level parameter and will throw a URI-not-found error.
            //    For standard Blob Storage accounts this is also safer: rely on
            //    storage-account-level access policies instead of per-container public access. ──
            await containerClient.create();
            this.logger.log(`✅ Created new Azure Blob Storage container: ${this.containerName}`);
          } catch (createError: any) {
            // ── Ignore race condition where another instance already created the container ──
            if (createError?.code !== 'ContainerAlreadyExists') {
              throw createError;
            }
            this.logger.log(`Container already exists (race condition handled): ${this.containerName}`);
          }
        } else {
          throw error;
        }
      }

      this.isConnected = true;
      this.logger.log(`✅ Connected to Azure Blob Storage (container: ${this.containerName})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to Azure Blob Storage: ${errorMessage}`);
      this.logger.warn('Falling back to MOCK MODE for development');
      this.blobServiceClient = null;
      this.isConnected = false;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FIX 2: Sanitize the original filename before using it in the blob path.
  //
  // Azure Blob Storage blob names must be valid URI path segments.  Filenames
  // that contain spaces, unicode characters, parentheses, or other characters
  // that are not safe in a URI will produce a "The requested URI does not
  // represent any resource on the server" error at upload time.
  //
  // Strategy:
  //   1. Replace every run of whitespace with a single underscore.
  //   2. Strip every character that is not alphanumeric, dot, dash, or underscore.
  //   3. Collapse any sequence of underscores/dashes that the above may produce.
  // ────────────────────────────────────────────────────────────────────────────
  private sanitizeFileName(originalName: string): string {
    return originalName
      .replace(/\s+/g, '_')                  // spaces → underscore
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')    // unsafe chars → underscore
      .replace(/_{2,}/g, '_')               // collapse consecutive underscores
      .replace(/^[.\-_]+|[.\-_]+$/g, '');  // trim leading/trailing punctuation
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FIX 3: Sanitize metadata keys and values.
  //
  // Azure Blob Storage metadata keys follow C# identifier rules:
  //   - Only letters, digits, and underscores are allowed.
  //   - Hyphens ARE NOT allowed (e.g. 'original-name' → invalid → 400 error).
  //
  // Metadata values must also be valid HTTP header values (ASCII only, no
  // control characters).  We strip non-ASCII and non-printable characters to
  // avoid surprises with exotic filenames.
  // ────────────────────────────────────────────────────────────────────────────
  private sanitizeMetadataValue(value: string): string {
    // Keep only printable ASCII characters (codes 32–126)
    return value.replace(/[^\x20-\x7E]/g, '');
  }

  /**
   * Upload file to Azure Blob Storage
   * @param file Express Multer file object
   * @param taskId Task ID for organizing files in blob path
   * @returns Azure Blob file URL
   */
  async uploadFile(file: Express.Multer.File, taskId: string): Promise<string> {
    // ── Basic validation ──
    if (!file) {
      throw new Error('File is required');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    try {
      // ── Build a safe, unique blob name ──
      //    Structure: tasks/<taskId>/<timestamp>-<shortUuid>-<sanitizedFilename>
      //    The timestamp + UUID prefix guarantees uniqueness even when the same
      //    filename is uploaded multiple times for the same task.
      const timestamp = Date.now();
      const randomId = uuid().substring(0, 8);
      const sanitizedName = this.sanitizeFileName(file.originalname); // FIX 2 applied here
      const blobName = `tasks/${taskId}/${timestamp}-${randomId}-${sanitizedName}`;

      // ── Mock mode: return a plausible-looking URL without touching Azure ──
      if (!this.isConnected || !this.blobServiceClient) {
        const mockUrl = `https://collabspacestorage2026.blob.core.windows.net/${this.containerName}/${blobName}`;
        this.logger.debug(`📁 Mock upload (not persisted): ${mockUrl}`);
        return mockUrl;
      }

      // ── Real mode: obtain a BlockBlobClient for the target blob path ──
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // ── Upload the file buffer with correct content-type and safe metadata ──
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          // Tells browsers and downstream services what kind of file this is
          blobContentType: file.mimetype,
        },
        metadata: {
          // FIX 3 applied here:
          //   Keys use camelCase (no hyphens) — Azure requires C#-identifier-style keys.
          //   Values are sanitized to printable ASCII only.
          originalName: this.sanitizeMetadataValue(file.originalname),
          uploadedAt:   new Date().toISOString(),   // already ASCII-safe
          taskId:       this.sanitizeMetadataValue(taskId),
        },
      });

      const fileUrl = blockBlobClient.url;
      this.logger.log(`✅ File uploaded: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload file to Azure: ${errorMessage}`);
      throw new Error(`Failed to upload file to Azure Blob Storage: ${errorMessage}`);
    }
  }

  /**
   * Delete file from Azure Blob Storage
   * @param fileUrl Full Azure Blob Storage file URL
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // ── Derive the blob name from the full URL before attempting deletion ──
      const blobName = this.extractBlobNameFromUrl(fileUrl);
      if (!blobName) {
        throw new Error('Invalid file URL');
      }

      // ── Mock mode: just log; no real deletion ──
      if (!this.isConnected || !this.blobServiceClient) {
        this.logger.debug(`🗑️  Mock delete (not persisted): ${blobName}`);
        return;
      }

      // ── Real mode: obtain a client for the specific blob and delete it ──
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.delete();
      this.logger.log(`✅ File deleted: ${blobName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete file from Azure: ${errorMessage}`);
      throw new Error(`Failed to delete file from Azure Blob Storage: ${errorMessage}`);
    }
  }

  /**
   * Extract blob name from Azure Blob Storage URL
   * Example: https://account.blob.core.windows.net/container/path/to/blob
   * Returns: path/to/blob
   */
  private extractBlobNameFromUrl(fileUrl: string): string | null {
    try {
      // ── Parse the URL and strip the leading container-name segment from the path ──
      //    URL pathname: /<containerName>/<blobName>
      //    We skip pathParts[0] (the container) and rejoin the rest as the blob name.
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/').filter((p) => p.length > 0);

      if (pathParts.length < 2) {
        return null;
      }

      return pathParts.slice(1).join('/');
    } catch {
      return null;
    }
  }

  /**
   * Check if Azure Blob Storage is connected and ready
   * @returns True if connected to real Azure, false if in mock mode
   */
  isAzureConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get storage mode info
   */
  getStorageInfo(): { mode: 'real' | 'mock'; containerName: string; connected: boolean } {
    return {
      mode: this.isConnected ? 'real' : 'mock',
      containerName: this.containerName,
      connected: this.isConnected,
    };
  }
}