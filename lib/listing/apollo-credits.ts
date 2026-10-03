// ============================================
// APOLLO CREDIT TRACKING & COST OPTIMIZATION
// ============================================
// Tracks API credit usage, provides projections,
// implements caching to minimize credit consumption.
// ============================================

// ============================================
// CREDIT COSTS (Apollo.io Pricing 2026)
// ============================================

export const APOLLO_CREDIT_COSTS = {
  // People endpoints
  "people/match": 1,        // 1 credit per person enrichment
  "people/search": 1,       // 1 credit per search (returns list)

  // Organization endpoints
  "organizations/search": 0, // FREE - org search doesn't cost credits
  "organizations/enrich": 1, // 1 credit per org enrichment

  // Email endpoints (if used)
  "email/verify": 1,         // 1 credit per email verification
} as const;

export type ApolloEndpoint = keyof typeof APOLLO_CREDIT_COSTS;

// ============================================
// CREDIT USAGE TRACKER (In-memory + logging)
// ============================================

interface CreditUsageEntry {
  endpoint: ApolloEndpoint;
  credits: number;
  timestamp: Date;
  cached: boolean;
  userId?: string;
}

interface CreditUsageSummary {
  totalCreditsUsed: number;
  totalCreditsSaved: number;
  callsByEndpoint: Record<string, { total: number; cached: number; credits: number }>;
  periodStart: Date;
  periodEnd: Date;
  cacheHitRate: number;
}

// Rolling window for tracking (keeps last 30 days in memory)
const MAX_ENTRIES = 10_000;
const usageLog: CreditUsageEntry[] = [];

export function trackCreditUsage(
  endpoint: ApolloEndpoint,
  cached: boolean,
  userId?: string
): void {
  const credits = cached ? 0 : (APOLLO_CREDIT_COSTS[endpoint] ?? 1);

  usageLog.push({
    endpoint,
    credits,
    timestamp: new Date(),
    cached,
    userId,
  });

  // Trim old entries
  if (usageLog.length > MAX_ENTRIES) {
    usageLog.splice(0, usageLog.length - MAX_ENTRIES);
  }

  if (!cached && credits > 0) {
    console.log(`[Apollo Credits] ${endpoint} → ${credits} credit(s) used`);
  }
}

export function getCreditUsageSummary(
  daysBack: number = 30
): CreditUsageSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const relevant = usageLog.filter((e) => e.timestamp >= cutoff);

  const callsByEndpoint: Record<string, { total: number; cached: number; credits: number }> = {};

  let totalCreditsUsed = 0;
  let totalCreditsSaved = 0;
  let totalCalls = 0;
  let cachedCalls = 0;

  for (const entry of relevant) {
    const key = entry.endpoint;
    if (!callsByEndpoint[key]) {
      callsByEndpoint[key] = { total: 0, cached: 0, credits: 0 };
    }
    callsByEndpoint[key].total++;
    totalCalls++;

    if (entry.cached) {
      callsByEndpoint[key].cached++;
      cachedCalls++;
      totalCreditsSaved += APOLLO_CREDIT_COSTS[entry.endpoint] ?? 1;
    } else {
      callsByEndpoint[key].credits += entry.credits;
      totalCreditsUsed += entry.credits;
    }
  }

  return {
    totalCreditsUsed,
    totalCreditsSaved,
    callsByEndpoint,
    periodStart: cutoff,
    periodEnd: new Date(),
    cacheHitRate: totalCalls > 0 ? Math.round((cachedCalls / totalCalls) * 100) : 0,
  };
}

// ============================================
// ENRICHMENT CACHE (In-memory LRU)
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 5_000;

class ApolloCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  get size(): number {
    return this.cache.size;
  }

  getStats() {
    let totalHits = 0;
    let entries = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      entries++;
    }
    return { entries, totalHits };
  }

  clear(): void {
    this.cache.clear();
  }
}

// Separate caches for different data types
export const enrichmentCache = new ApolloCache(DEFAULT_TTL_MS);
export const searchCache = new ApolloCache(30 * 60 * 1000); // 30 min for searches
export const orgCache = new ApolloCache(DEFAULT_TTL_MS);

// ============================================
// CACHE KEY GENERATORS
// ============================================

export function enrichmentCacheKey(type: string, identifier: string): string {
  return `enrich:${type}:${identifier.toLowerCase().trim()}`;
}

export function searchCacheKey(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== "" && params[k] !== null)
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
  return `search:${sorted}`;
}

// ============================================
// RATE LIMITER (Token Bucket)
// ============================================

class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSecond;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Wait until a token is available
    const waitMs = Math.ceil((1 / this.refillRate) * 1000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens = Math.max(0, this.tokens - 1);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  get availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Apollo free tier: ~50 requests/min, we stay conservative
export const apolloRateLimiter = new TokenBucketRateLimiter(10, 2); // 10 burst, 2/sec refill

// ============================================
// CREDIT PROJECTION ENGINE
// ============================================

export interface CreditProjection {
  // Current usage
  currentMonthUsed: number;
  currentMonthSaved: number;
  cacheHitRate: number;

  // Projections
  projectedMonthly: number;
  projectedWithoutCache: number;
  monthlySavings: number;
  savingsPercentage: number;

  // Cost estimates (based on plan)
  estimatedMonthlyCost: number;
  costWithoutOptimization: number;
  costSavings: number;

  // Breakdown
  enrichmentCredits: number;
  searchCredits: number;

  // Recommendations
  recommendations: string[];
}

export function getApolloCreditsPerDollar(plan: "free" | "basic" | "professional" | "organization"): number {
  // Apollo.io approximate pricing per credit
  switch (plan) {
    case "free":        return Infinity; // 10,000 free credits/year ≈ 833/month
    case "basic":       return 200;      // ~$49/mo for 10,000 credits → 200 credits/$
    case "professional": return 100;     // ~$99/mo for 10,000 credits → 100 credits/$
    case "organization": return 166;     // ~$149/mo for ~25,000 credits
    default:            return 100;
  }
}

export function getMonthlyCreditsLimit(plan: "free" | "basic" | "professional" | "organization"): number {
  switch (plan) {
    case "free":        return 833;    // ~10,000/year
    case "basic":       return 10_000;
    case "professional": return 10_000;
    case "organization": return 25_000;
    default:            return 833;
  }
}

export function projectCreditUsage(
  plan: "free" | "basic" | "professional" | "organization" = "free"
): CreditProjection {
  const summary = getCreditUsageSummary(30);
  const daysElapsed = Math.max(1, Math.ceil(
    (summary.periodEnd.getTime() - summary.periodStart.getTime()) / (1000 * 60 * 60 * 24)
  ));

  const dailyRate = summary.totalCreditsUsed / daysElapsed;
  const dailyRateWithoutCache = (summary.totalCreditsUsed + summary.totalCreditsSaved) / daysElapsed;
  const daysInMonth = 30;

  const projectedMonthly = Math.round(dailyRate * daysInMonth);
  const projectedWithoutCache = Math.round(dailyRateWithoutCache * daysInMonth);
  const monthlySavings = projectedWithoutCache - projectedMonthly;

  const creditsPerDollar = getApolloCreditsPerDollar(plan);
  const monthlyLimit = getMonthlyCreditsLimit(plan);

  // Cost calculations
  const estimatedMonthlyCost = plan === "free" ? 0 : projectedMonthly / creditsPerDollar;
  const costWithoutOptimization = plan === "free" ? 0 : projectedWithoutCache / creditsPerDollar;

  // Breakdown
  const enrichmentCredits =
    (summary.callsByEndpoint["people/match"]?.credits ?? 0) +
    (summary.callsByEndpoint["organizations/enrich"]?.credits ?? 0);
  const searchCredits = summary.callsByEndpoint["organizations/search"]?.credits ?? 0;

  // Recommendations
  const recommendations: string[] = [];

  if (summary.cacheHitRate < 30) {
    recommendations.push("Low cache hit rate. Consider importing leads in batches to benefit from cache.");
  }
  if (projectedMonthly > monthlyLimit * 0.8) {
    recommendations.push(`Projected usage (${projectedMonthly}) is near your plan limit (${monthlyLimit}). Consider upgrading or reducing enrichment frequency.`);
  }
  if (projectedMonthly > monthlyLimit) {
    recommendations.push(`WARNING: Projected to exceed monthly limit by ${projectedMonthly - monthlyLimit} credits.`);
  }
  if (enrichmentCredits > searchCredits * 3) {
    recommendations.push("Enrichment dominates usage. Consider using organization search (free) before enriching individuals.");
  }
  if (projectedMonthly === 0) {
    recommendations.push("No usage detected yet. Credits will be tracked as you use Apollo features.");
  }
  if (summary.cacheHitRate >= 50) {
    recommendations.push(`Excellent cache efficiency at ${summary.cacheHitRate}% hit rate. Keep it up!`);
  }

  return {
    currentMonthUsed: summary.totalCreditsUsed,
    currentMonthSaved: summary.totalCreditsSaved,
    cacheHitRate: summary.cacheHitRate,
    projectedMonthly,
    projectedWithoutCache,
    monthlySavings,
    savingsPercentage: projectedWithoutCache > 0
      ? Math.round((monthlySavings / projectedWithoutCache) * 100)
      : 0,
    estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
    costWithoutOptimization: Math.round(costWithoutOptimization * 100) / 100,
    costSavings: Math.round((costWithoutOptimization - estimatedMonthlyCost) * 100) / 100,
    enrichmentCredits,
    searchCredits,
    recommendations,
  };
}
