/**
 * File Storage Abstraction Layer
 * Supports multiple storage providers (S3, Azure, Local)
 */

import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';

// ============================================
// TYPES
// ============================================

export interface StorageProvider {
    upload(file: Buffer, key: string, mimeType: string): Promise<string>;
    download(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

export interface UploadOptions {
    folder?: string;
    filename?: string;
    mimeType: string;
    size: number;
}

// ============================================
// LOCAL STORAGE PROVIDER (Development)
// ============================================

import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

/** Writable directory for local storage. Uses /tmp on Vercel/serverless (read-only fs). */
function getLocalUploadsPath(): string {
    if (process.env.VERCEL) {
        return path.join(os.tmpdir(), 'uploads');
    }
    return './uploads';
}

export class LocalStorageProvider implements StorageProvider {
    private basePath: string;

    constructor(basePath?: string) {
        this.basePath = basePath ?? getLocalUploadsPath();
        this.ensureDirectory();
    }

    private ensureDirectory() {
        if (!existsSync(this.basePath)) {
            mkdirSync(this.basePath, { recursive: true });
        }
    }

    async upload(file: Buffer, key: string, mimeType: string): Promise<string> {
        void mimeType;
        const filePath = path.join(this.basePath, key);
        const dir = path.dirname(filePath);

        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
        }

        await writeFile(filePath, file);

        // Return local URL
        return `/uploads/${key}`;
    }

    async download(key: string): Promise<Buffer> {
        const filePath = path.join(this.basePath, key);
        return await readFile(filePath);
    }

    async delete(key: string): Promise<void> {
        const filePath = path.join(this.basePath, key);
        await unlink(filePath);
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        void expiresIn;
        // For local storage, just return the URL
        return `/uploads/${key}`;
    }
}

// ============================================
// S3 STORAGE PROVIDER (Production)
// ============================================

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    deleteFile as deleteMinioFile,
    downloadFile as downloadMinioFile,
    generateSignedUrl as generateMinioSignedUrl,
    uploadFile as uploadMinioFile,
} from './minio';

export class S3StorageProvider implements StorageProvider {
    private client: S3Client;
    private bucket: string;

    constructor() {
        this.bucket = process.env.ASW_S3_BUCKET || '';
        this.client = new S3Client({
            region: process.env.ASW_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.ASW_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.ASW_SECRET_ACCESS_KEY || '',
            },
        });
    }

    async upload(file: Buffer, key: string, mimeType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file,
            ContentType: mimeType,
        });

        await this.client.send(command);

        return `https://${this.bucket}.s3.${process.env.ASW_REGION}.amazonaws.com/${key}`;
    }

    async download(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.client.send(command);
        return streamToBuffer(response.Body);
    }

    async delete(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.client.send(command);
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        return await getS3SignedUrl(this.client, command, { expiresIn });
    }
}

async function streamToBuffer(stream: GetObjectCommandOutput['Body']): Promise<Buffer> {
    if (!stream) {
        return Buffer.alloc(0);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

// ============================================
// MINIO STORAGE PROVIDER (Self-hosted S3)
// ============================================

export class MinioStorageProvider implements StorageProvider {
    private bucket: string;

    constructor() {
        this.bucket = process.env.MINIO_BUCKET || '';
    }

    async upload(file: Buffer, key: string, mimeType: string): Promise<string> {
        const result = await uploadMinioFile({
            bucket: this.bucket,
            key,
            body: file,
            contentType: mimeType,
        });

        return result.url;
    }

    async download(key: string): Promise<Buffer> {
        return downloadMinioFile(key, this.bucket);
    }

    async delete(key: string): Promise<void> {
        await deleteMinioFile(key, this.bucket);
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        return generateMinioSignedUrl({
            bucket: this.bucket,
            key,
            expiresIn,
        });
    }
}

// ============================================
// STORAGE SERVICE (Main Interface)
// ============================================

export class StorageService {
    private provider: StorageProvider;

    constructor() {
        const provider = process.env.STORAGE_PROVIDER?.toLowerCase();

        if (provider === 'minio' || process.env.MINIO_ENDPOINT) {
            this.provider = new MinioStorageProvider();
        } else if (provider === 's3' || (process.env.NODE_ENV === 'production' && process.env.ASW_S3_BUCKET)) {
            this.provider = new S3StorageProvider();
        } else {
            this.provider = new LocalStorageProvider();
        }
    }

    /**
     * Generate a unique file key
     */
    generateKey(userId: string, originalFilename: string, folder?: string): string {
        const ext = path.extname(originalFilename);
        const uuid = randomUUID();
        const timestamp = Date.now();

        const parts = [userId, timestamp, uuid];
        if (folder) {
            parts.unshift(folder);
        }

        return `${parts.join('/')}${ext}`;
    }

    /**
     * Upload a file
     */
    async upload(
        file: Buffer,
        options: UploadOptions,
        userId: string
    ): Promise<{ key: string; url: string }> {
        const key = this.generateKey(
            userId,
            options.filename || 'file',
            options.folder
        );

        const url = await this.provider.upload(file, key, options.mimeType);

        return { key, url };
    }

    /**
     * Download a file
     */
    async download(key: string): Promise<Buffer> {
        return await this.provider.download(key);
    }

    /**
     * Delete a file
     */
    async delete(key: string): Promise<void> {
        await this.provider.delete(key);
    }

    /**
     * Get a signed URL for temporary access
     */
    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        return await this.provider.getSignedUrl(key, expiresIn);
    }

    /**
     * Get file extension from filename
     */
    getExtension(filename: string): string {
        return path.extname(filename).toLowerCase();
    }

    /**
     * Validate file type
     */
    isAllowedType(mimeType: string, allowedTypes?: string[]): boolean {
        if (!allowedTypes || allowedTypes.length === 0) {
            return true;
        }

        return allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                const category = type.split('/')[0];
                return mimeType.startsWith(`${category}/`);
            }
            return mimeType === type;
        });
    }

    /**
     * Validate file size
     */
    isAllowedSize(size: number, maxSize?: number): boolean {
        if (!maxSize) {
            return true;
        }
        return size <= maxSize;
    }

    /**
     * Format file size for display
     */
    formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const storageService = new StorageService();
