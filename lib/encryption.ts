import crypto from 'crypto';

// ============================================
// ENCRYPTION UTILITY
// For encrypting/decrypting sensitive data like OAuth tokens
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    return key;
}

/**
 * Derive a key from the encryption key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt data
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: salt:iv:tag:encrypted
 */
export function encrypt(text: string): string {
    try {
        const password = getEncryptionKey();

        // Generate random salt and IV
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);

        // Derive key from password
        const key = deriveKey(password, salt);

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Get auth tag
        const tag = cipher.getAuthTag();

        // Return salt:iv:tag:encrypted
        return [
            salt.toString('hex'),
            iv.toString('hex'),
            tag.toString('hex'),
            encrypted,
        ].join(':');
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt data
 * @param encryptedData - Encrypted string in format: salt:iv:tag:encrypted
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
    try {
        const password = getEncryptionKey();

        // Split encrypted data
        const parts = encryptedData.split(':');
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted data format');
        }

        const [saltHex, ivHex, tagHex, encrypted] = parts;

        // Convert from hex
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        // Derive key from password
        const key = deriveKey(password, salt);

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        // Decrypt
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Encrypt OAuth tokens for storage
 */
export function encryptTokens(tokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    scope?: string;
    token_type?: string;
}): string {
    return encrypt(JSON.stringify(tokens));
}

/**
 * Decrypt OAuth tokens from storage
 */
export function decryptTokens(encryptedTokens: string): {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    scope?: string;
    token_type?: string;
} {
    const decrypted = decrypt(encryptedTokens);
    return JSON.parse(decrypted);
}
