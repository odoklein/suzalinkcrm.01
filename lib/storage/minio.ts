import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    ListBucketsCommand,
    PutObjectCommand,
    S3Client,
    S3ServiceException,
    type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presignS3Url } from "@aws-sdk/s3-request-presigner";

export interface MinioConfig {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket?: string;
}

export interface MinioBucket {
    name: string;
    createdAt?: Date;
}

export interface UploadFileInput {
    key: string;
    body: PutObjectCommandInput["Body"];
    bucket?: string;
    contentType?: string;
    metadata?: Record<string, string>;
}

export interface GenerateSignedUrlInput {
    key: string;
    bucket?: string;
    expiresIn?: number;
}

const DEFAULT_REGION = "us-east-1";

function cleanEndpoint(endpoint: string): string {
    return endpoint.replace(/\/+$/, "");
}

function getRequiredValue(value: string | undefined, name: string): string {
    if (!value?.trim()) {
        throw new Error(`${name} is required for MinIO storage`);
    }
    return value.trim();
}

export function getMinioConfig(overrides: Partial<MinioConfig> = {}): MinioConfig {
    return {
        endpoint: cleanEndpoint(
            getRequiredValue(overrides.endpoint ?? process.env.MINIO_ENDPOINT, "MINIO_ENDPOINT"),
        ),
        accessKeyId: getRequiredValue(
            overrides.accessKeyId ?? process.env.MINIO_ACCESS_KEY_ID,
            "MINIO_ACCESS_KEY_ID",
        ),
        secretAccessKey: getRequiredValue(
            overrides.secretAccessKey ?? process.env.MINIO_SECRET_ACCESS_KEY,
            "MINIO_SECRET_ACCESS_KEY",
        ),
        region: overrides.region ?? process.env.MINIO_REGION ?? DEFAULT_REGION,
        bucket: overrides.bucket ?? process.env.MINIO_BUCKET,
    };
}

export function createMinioClient(overrides: Partial<MinioConfig> = {}): S3Client {
    const config = getMinioConfig(overrides);

    return new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: true,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
}

function getBucketName(bucket: string | undefined, config: MinioConfig): string {
    return getRequiredValue(bucket ?? config.bucket, "MINIO_BUCKET");
}

function getObjectUrl(endpoint: string, bucket: string, key: string): string {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${cleanEndpoint(endpoint)}/${encodeURIComponent(bucket)}/${encodedKey}`;
}

function isMissingBucketError(error: unknown): boolean {
    if (!(error instanceof S3ServiceException)) {
        return false;
    }

    return (
        error.name === "NotFound" ||
        error.name === "NoSuchBucket" ||
        error.$metadata.httpStatusCode === 404
    );
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
    if (!stream) {
        return Buffer.alloc(0);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

export async function listBuckets(overrides: Partial<MinioConfig> = {}): Promise<MinioBucket[]> {
    const client = createMinioClient(overrides);
    const response = await client.send(new ListBucketsCommand({}));

    return (response.Buckets ?? [])
        .filter((bucket): bucket is NonNullable<typeof response.Buckets>[number] & { Name: string } =>
            Boolean(bucket.Name),
        )
        .map((bucket) => ({
            name: bucket.Name,
            createdAt: bucket.CreationDate,
        }));
}

export async function createBucket(
    bucket?: string,
    overrides: Partial<MinioConfig> = {},
): Promise<string> {
    const config = getMinioConfig(overrides);
    const bucketName = getBucketName(bucket, config);
    const client = createMinioClient(config);

    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    return bucketName;
}

export async function ensureBucket(
    bucket?: string,
    overrides: Partial<MinioConfig> = {},
): Promise<string> {
    const config = getMinioConfig(overrides);
    const bucketName = getBucketName(bucket, config);
    const client = createMinioClient(config);

    try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return bucketName;
    } catch (error) {
        if (!isMissingBucketError(error)) {
            throw error;
        }
    }

    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    return bucketName;
}

export async function uploadFile(
    input: UploadFileInput,
    overrides: Partial<MinioConfig> = {},
): Promise<{ bucket: string; key: string; url: string }> {
    const config = getMinioConfig(overrides);
    const bucketName = await ensureBucket(input.bucket, config);
    const client = createMinioClient(config);

    await client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType,
            Metadata: input.metadata,
        }),
    );

    return {
        bucket: bucketName,
        key: input.key,
        url: getObjectUrl(config.endpoint, bucketName, input.key),
    };
}

export async function downloadFile(
    key: string,
    bucket?: string,
    overrides: Partial<MinioConfig> = {},
): Promise<Buffer> {
    const config = getMinioConfig(overrides);
    const bucketName = getBucketName(bucket, config);
    const client = createMinioClient(config);

    const response = await client.send(
        new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        }),
    );

    return streamToBuffer(response.Body);
}

export async function deleteFile(
    key: string,
    bucket?: string,
    overrides: Partial<MinioConfig> = {},
): Promise<void> {
    const config = getMinioConfig(overrides);
    const bucketName = getBucketName(bucket, config);
    const client = createMinioClient(config);

    await client.send(
        new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        }),
    );
}

export async function generateSignedUrl(
    input: GenerateSignedUrlInput,
    overrides: Partial<MinioConfig> = {},
): Promise<string> {
    const config = getMinioConfig(overrides);
    const bucketName = getBucketName(input.bucket, config);
    const client = createMinioClient(config);

    return presignS3Url(
        client,
        new GetObjectCommand({
            Bucket: bucketName,
            Key: input.key,
        }),
        { expiresIn: input.expiresIn ?? 3600 },
    );
}
