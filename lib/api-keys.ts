import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';

// ============================================
// API KEY VALIDATION & MANAGEMENT
// ============================================

const API_KEY_PREFIX = 'cp_live_';
const MIN_KEY_LENGTH = 32;
const MAX_RATE_LIMIT_PER_MINUTE = 1000;
const MAX_RATE_LIMIT_PER_HOUR = 10000;

export interface ValidatedApiKey {
  id: string;
  name: string;
  role: UserRole;
  clientId: string | null;
  missionId: string | null;
  allowedEndpoints: string[];
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  key?: ValidatedApiKey;
  error?: string;
  statusCode?: number;
}

/**
 * Generate a new API key
 * Format: cp_live_{random}_{timestamp}
 * Returns the full key (shown only once) and its hash
 */
export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(24).toString('hex'); // Increased from 16 to 24 bytes
  const fullKey = `${API_KEY_PREFIX}${random}_${timestamp}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  const keyPrefix = fullKey.substring(0, 12);
  
  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an existing API key for validation
 */
export function hashApiKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid API key format');
  }
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format before processing
 */
function isValidKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (key.length < MIN_KEY_LENGTH) return false;
  if (!key.startsWith(API_KEY_PREFIX)) return false;
  // Check for suspicious characters
  if (!/^[a-zA-Z0-9_]+$/.test(key)) return false;
  return true;
}

/**
 * Validate an API key from request header
 * Checks existence, active status, expiration, endpoint access, and rate limits
 */
export async function validateApiKey(
  apiKey: string | null,
  endpoint: string,
  method: string
): Promise<ApiKeyValidationResult> {
  // Input validation
  if (!apiKey) {
    return { valid: false, error: 'API key required', statusCode: 401 };
  }

  if (!isValidKeyFormat(apiKey)) {
    return { valid: false, error: 'Invalid API key format', statusCode: 401 };
  }

  if (!endpoint || !method) {
    return { valid: false, error: 'Invalid request parameters', statusCode: 400 };
  }

  try {
    // Hash the provided key
    const keyHash = hashApiKey(apiKey);

    // Find the key in database with rate limit check
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        usageLogs: {
          where: {
            createdAt: { gte: oneHourAgo },
          },
          select: { 
            id: true,
            createdAt: true,
          },
        },
      },
    });

    if (!keyRecord) {
      return { valid: false, error: 'Invalid API key', statusCode: 401 };
    }

    if (!keyRecord.isActive) {
      return { valid: false, error: 'API key has been revoked', statusCode: 401 };
    }

    // Check expiration
    if (keyRecord.expiresAt && now > keyRecord.expiresAt) {
      return { valid: false, error: 'API key has expired', statusCode: 401 };
    }

    // Check endpoint access
    const allowedEndpoints = Array.isArray(keyRecord.allowedEndpoints) 
      ? keyRecord.allowedEndpoints as string[]
      : [];
    
    if (allowedEndpoints.length === 0) {
      return { valid: false, error: 'No endpoints configured for this API key', statusCode: 403 };
    }

    const hasEndpointAccess = allowedEndpoints.some(allowed => {
      // Support wildcards like "/api/stats/*"
      if (allowed.endsWith('/*')) {
        const prefix = allowed.slice(0, -2);
        return endpoint.startsWith(prefix);
      }
      // Exact match or subpath match
      return endpoint === allowed || endpoint.startsWith(allowed + '/');
    });

    if (!hasEndpointAccess) {
      return { 
        valid: false, 
        error: `Access denied: endpoint ${endpoint} not allowed for this API key`, 
        statusCode: 403 
      };
    }

    // Check rate limits
    const usageInLastHour = keyRecord.usageLogs.length;
    const usageInLastMinute = keyRecord.usageLogs.filter(
      log => log.createdAt >= oneMinuteAgo
    ).length;

    if (usageInLastMinute >= keyRecord.rateLimitPerMinute) {
      return { 
        valid: false, 
        error: `Rate limit exceeded: ${keyRecord.rateLimitPerMinute} requests per minute`, 
        statusCode: 429 
      };
    }

    if (usageInLastHour >= keyRecord.rateLimitPerHour) {
      return { 
        valid: false, 
        error: `Rate limit exceeded: ${keyRecord.rateLimitPerHour} requests per hour`, 
        statusCode: 429 
      };
    }

    return {
      valid: true,
      key: {
        id: keyRecord.id,
        name: keyRecord.name,
        role: keyRecord.role,
        clientId: keyRecord.clientId,
        missionId: keyRecord.missionId,
        allowedEndpoints,
        rateLimitPerMinute: keyRecord.rateLimitPerMinute,
        rateLimitPerHour: keyRecord.rateLimitPerHour,
      },
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return { 
      valid: false, 
      error: 'Internal server error during API key validation', 
      statusCode: 500 
    };
  }
}

/**
 * Log API key usage for analytics and rate limiting
 */
export async function logApiKeyUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  request?: Request
): Promise<void> {
  try {
    // Extract IP and User-Agent safely
    const ipAddress = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request?.headers.get('x-real-ip') 
      || 'unknown';
    const userAgent = request?.headers.get('user-agent')?.substring(0, 500) || 'unknown';

    await prisma.apiKeyUsageLog.create({
      data: {
        apiKeyId,
        endpoint: endpoint.substring(0, 500), // Prevent excessively long values
        method: method.substring(0, 10),
        statusCode,
        responseTimeMs: Math.min(responseTimeMs, 999999), // Cap at reasonable value
        ipAddress: ipAddress.substring(0, 100),
        userAgent,
      },
    });

    // Update last used timestamp (fire and forget)
    prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    }).catch(err => console.error('Failed to update lastUsedAt:', err));
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log API key usage:', error);
  }
}

/**
 * Extract API key from request headers
 * Supports: X-API-Key header or Authorization: Bearer <key>
 */
export function extractApiKey(request: Request): string | null {
  try {
    // Check X-API-Key header first
    const apiKeyHeader = request.headers.get('X-API-Key');
    if (apiKeyHeader) {
      return apiKeyHeader.trim().substring(0, 200); // Limit length
    }

    // Check Authorization header (Bearer token)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7).trim().substring(0, 200); // Limit length
    }

    return null;
  } catch (error) {
    console.error('Error extracting API key:', error);
    return null;
  }
}

/**
 * Get available endpoints for a user based on their role
 */
export async function getAvailableEndpoints(role: UserRole): Promise<Array<{
  id: string;
  path: string;
  name: string;
  description: string | null;
  methods: string[];
  supportsClientScope: boolean;
  supportsMissionScope: boolean;
  isEnabled: boolean;
}>> {
  try {
    const endpoints = await prisma.externalEndpoint.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: { name: 'asc' },
    });

    // Filter by role (minRole check)
    const roleHierarchy: UserRole[] = [
      'CLIENT', 
      'SDR', 
      'BOOKER', 
      'BUSINESS_DEVELOPER', 
      'COMMERCIAL',
      'MANAGER', 
      'DEVELOPER'
    ];
    
    const userRoleIndex = roleHierarchy.indexOf(role);
    if (userRoleIndex === -1) {
      console.warn(`Unknown role: ${role}`);
      return [];
    }

    return endpoints.filter(ep => {
      const requiredRoleIndex = roleHierarchy.indexOf(ep.minRole);
      return requiredRoleIndex !== -1 && userRoleIndex >= requiredRoleIndex;
    }).map(ep => ({
      id: ep.id,
      path: ep.path,
      name: ep.name,
      description: ep.description,
      methods: ep.methods,
      supportsClientScope: ep.supportsClientScope,
      supportsMissionScope: ep.supportsMissionScope,
      isEnabled: ep.isEnabled,
    }));
  } catch (error) {
    console.error('Error fetching available endpoints:', error);
    return [];
  }
}

/**
 * Check if endpoint is available for external access
 */
export async function isEndpointEnabled(path: string): Promise<boolean> {
  try {
    if (!path || typeof path !== 'string') return false;
    
    const endpoint = await prisma.externalEndpoint.findUnique({
      where: { path },
      select: { isEnabled: true },
    });
    
    return endpoint?.isEnabled ?? false;
  } catch (error) {
    console.error('Error checking endpoint status:', error);
    return false;
  }
}

/**
 * Validate rate limit values
 */
export function validateRateLimits(perMinute: number, perHour: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(perMinute) || perMinute < 1 || perMinute > MAX_RATE_LIMIT_PER_MINUTE) {
    return { 
      valid: false, 
      error: `Rate limit per minute must be between 1 and ${MAX_RATE_LIMIT_PER_MINUTE}` 
    };
  }
  
  if (!Number.isInteger(perHour) || perHour < 1 || perHour > MAX_RATE_LIMIT_PER_HOUR) {
    return { 
      valid: false, 
      error: `Rate limit per hour must be between 1 and ${MAX_RATE_LIMIT_PER_HOUR}` 
    };
  }
  
  if (perMinute * 60 > perHour) {
    return { 
      valid: false, 
      error: 'Per-minute rate limit cannot exceed hourly limit when multiplied by 60' 
    };
  }
  
  return { valid: true };
}
