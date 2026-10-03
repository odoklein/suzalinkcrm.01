import { LRUCache } from "lru-cache";

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

// Store for login attempts: key = IP + email (or just IP)
const loginAttempts = new LRUCache<string, RateLimitEntry>({
  max: 1000, // Max 1000 entries
  ttl: 60 * 60 * 1000, // 1 hour TTL
});

// Store for IP-based rate limiting (stricter)
const ipAttempts = new LRUCache<string, RateLimitEntry>({
  max: 500,
  ttl: 15 * 60 * 1000, // 15 minutes TTL
});

/**
 * Check and record login attempt rate limiting
 * @param identifier - IP address or IP + email combination
 * @param maxAttempts - Max attempts allowed (default: 5)
 * @param windowMs - Time window in milliseconds (default: 15 minutes)
 * @returns Object with allowed status and remaining attempts
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; lockoutMinutes?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(identifier);

  if (!entry) {
    // First attempt
    loginAttempts.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // Check if locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const lockoutMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
    return { allowed: false, remaining: 0, lockoutMinutes };
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > windowMs) {
    loginAttempts.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // Check attempts
  if (entry.attempts >= maxAttempts) {
    // Lock out for 15 minutes
    const lockedUntil = now + 15 * 60 * 1000;
    loginAttempts.set(identifier, {
      ...entry,
      lockedUntil,
      lastAttempt: now,
    });
    return { allowed: false, remaining: 0, lockoutMinutes: 15 };
  }

  // Increment attempts
  loginAttempts.set(identifier, {
    ...entry,
    attempts: entry.attempts + 1,
    lastAttempt: now,
  });

  return { allowed: true, remaining: maxAttempts - entry.attempts - 1 };
}

/**
 * Check IP-based rate limiting (stricter, prevents enumeration attacks)
 * @param ip - Client IP address
 * @returns Boolean indicating if request is allowed
 */
export function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10; // Max 10 login attempts per minute per IP

  const entry = ipAttempts.get(ip);

  if (!entry) {
    ipAttempts.set(ip, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return true;
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > windowMs) {
    ipAttempts.set(ip, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return true;
  }

  if (entry.attempts >= maxRequests) {
    return false;
  }

  ipAttempts.set(ip, {
    ...entry,
    attempts: entry.attempts + 1,
    lastAttempt: now,
  });

  return true;
}

/**
 * Reset rate limit for a specific identifier (e.g., after successful login)
 * @param identifier - IP address or IP + email combination
 */
export function resetRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}
