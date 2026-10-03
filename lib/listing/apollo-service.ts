// ============================================
// APOLLO.IO ENRICHMENT SERVICE
// ============================================
// Server-side enrichment provider
// - Enriches ProspectProfile and Company data
// - Never creates Contacts directly
// - Fully stateless (no Prisma imports)
// - Graceful degradation on failures
// - OPTIMIZED: caching, rate limiting, credit tracking
// ============================================

import { config } from "@/lib/config";
import { ProspectProfile } from "@prisma/client";
import {
  trackCreditUsage,
  enrichmentCache,
  searchCache,
  orgCache,
  enrichmentCacheKey,
  searchCacheKey,
  apolloRateLimiter,
  type ApolloEndpoint,
} from "./apollo-credits";

// ============================================
// TYPES
// ============================================

export interface ApolloEnrichmentResult {
  company?: {
    name?: string;
    domain?: string;
    industry?: string;
    size?: string;
    country?: string;
    city?: string;
    state?: string;
    linkedin?: string;
    description?: string;
    phone?: string;
  };
  person?: {
    firstName?: string;
    lastName?: string;
    title?: string;
    linkedin?: string;
    email?: string;
    phone?: string;
    seniority?: string;
  };
  source: "apollo";
  confidence: number; // 0-100
  metadata?: {
    apolloId?: string;
    lastEnriched: string;
  };
}

interface ApolloPersonResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    title?: string;
    linkedin_url?: string;
    email?: string;
    phone_numbers?: Array<{ raw_number?: string }>;
    seniority?: string;
    organization?: {
      id?: string;
      name?: string;
      website_url?: string;
      industry?: string;
      estimated_num_employees?: number;
      country?: string;
      city?: string;
      state?: string;
      linkedin_url?: string;
      short_description?: string;
    };
  };
}

export interface ApolloSearchParams {
  // Basic Filters
  industry?: string;
  companySize?: string;
  country?: string;
  region?: string;
  state?: string;
  jobTitle?: string;
  keywords?: string;

  // Revenue & Funding
  revenueRange?: string;
  fundingMin?: number;
  fundingMax?: number;
  latestFundingStage?: string;

  // Company Details
  yearFoundedMin?: number;
  yearFoundedMax?: number;
  companyType?: string; // public, private, nonprofit
  technologies?: string[];

  // Growth & Intent Signals
  isHiring?: boolean;
  departmentHeadcount?: string;
  jobPostings?: string;

  // Pagination
  limit?: number;
  page?: number;
}

interface ApolloSearchResponse {
  organizations: any[];
  pagination: {
    total_entries: number;
    total_pages: number;
    page: number;
    per_page: number;
  };
}

interface ApolloOrganizationResponse {
  organization?: {
    id?: string;
    name?: string;
    website_url?: string;
    industry?: string;
    estimated_num_employees?: number;
    country?: string;
    city?: string;
    state?: string;
    linkedin_url?: string;
    short_description?: string;
    phone?: string;
    primary_phone?: { number?: string };
    sanitized_phone?: string;
    account?: { phone?: string };
  };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

export async function enrichFromApollo(
  profile: ProspectProfile,
): Promise<ApolloEnrichmentResult | null> {
  // Pre-flight checks
  if (!config.integrations.apollo.enabled) {
    console.log("[Apollo] Enrichment disabled in config");
    return null;
  }

  if (!config.integrations.apollo.apiKey) {
    console.error("[Apollo] API key not configured");
    return null;
  }

  try {
    // Determine enrichment strategy based on available data
    // OPTIMIZED: Try cheapest/cached strategies first, stop at first hit
    let result: ApolloEnrichmentResult | null = null;

    // Strategy 1: Email-based enrichment (most reliable, 1 credit)
    if (profile.email) {
      const cacheKey = enrichmentCacheKey("email", profile.email);
      const cached = enrichmentCache.get(cacheKey) as ApolloEnrichmentResult | null;
      if (cached) {
        trackCreditUsage("people/match", true);
        return cached;
      }
      result = await enrichByEmail(profile.email);
      if (result) {
        enrichmentCache.set(cacheKey, result);
        return result;
      }
    }

    // Strategy 2: LinkedIn URL enrichment (1 credit)
    if (profile.linkedin) {
      const cacheKey = enrichmentCacheKey("linkedin", profile.linkedin);
      const cached = enrichmentCache.get(cacheKey) as ApolloEnrichmentResult | null;
      if (cached) {
        trackCreditUsage("people/match", true);
        return cached;
      }
      result = await enrichByLinkedIn(profile.linkedin);
      if (result) {
        enrichmentCache.set(cacheKey, result);
        return result;
      }
    }

    // Strategy 3: Company + Name enrichment (1 credit)
    if (profile.companyName && profile.firstName && profile.lastName) {
      const cacheKey = enrichmentCacheKey(
        "name",
        `${profile.firstName}:${profile.lastName}:${profile.companyName}`,
      );
      const cached = enrichmentCache.get(cacheKey) as ApolloEnrichmentResult | null;
      if (cached) {
        trackCreditUsage("people/match", true);
        return cached;
      }
      result = await enrichByNameAndCompany(
        profile.firstName,
        profile.lastName,
        profile.companyName,
      );
      if (result) {
        enrichmentCache.set(cacheKey, result);
        return result;
      }
    }

    // Strategy 4: Company domain enrichment only (1 credit)
    if (profile.companyWebsite) {
      const cacheKey = enrichmentCacheKey("domain", profile.companyWebsite);
      const cached = orgCache.get(cacheKey) as ApolloEnrichmentResult | null;
      if (cached) {
        trackCreditUsage("organizations/enrich", true);
        return cached;
      }
      result = await enrichCompanyByDomain(profile.companyWebsite);
      if (result) {
        orgCache.set(cacheKey, result);
        return result;
      }
    }

    console.log(
      `[Apollo] No enrichment data found for profile (strategies exhausted)`,
    );
    return null;
  } catch (error) {
    // Never throw - graceful degradation
    console.error("[Apollo] Enrichment failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
      // DO NOT log profileId or any PII here
    });
    return null;
  }
}

// ============================================
// ============================================
// SEARCH FUNCTION
// ============================================

export async function searchFromApollo(
  params: ApolloSearchParams,
): Promise<{ results: ApolloEnrichmentResult[]; total: number; cached?: boolean }> {
  // Pre-flight checks
  if (
    !config.integrations.apollo.enabled ||
    !config.integrations.apollo.apiKey
  ) {
    console.warn("[Apollo] Search skipped: Disabled or missing API key");
    return { results: [], total: 0 };
  }

  try {
    // Check search cache first (org search is free but still reduces latency)
    const cKey = searchCacheKey(params as unknown as Record<string, unknown>);
    const cachedResult = searchCache.get(cKey) as { results: ApolloEnrichmentResult[]; total: number } | null;
    if (cachedResult) {
      trackCreditUsage("organizations/search", true);
      console.log(`[Apollo] Search cache hit — saved API call`);
      return { ...cachedResult, cached: true };
    }

    const apiParams: Record<string, any> = {
      page: params.page || 1,
      per_page: params.limit || 25,

      // Basic Search
      q_keywords: params.keywords,
      organization_locations:
        [params.country, params.state, params.region].filter(Boolean).length > 0
          ? [params.country, params.state, params.region].filter(Boolean)
          : undefined,
      q_organization_keyword: params.industry,
    };

    // Company Size
    if (params.companySize) {
      apiParams.organization_num_employees_ranges = [
        params.companySize.replace("-", ","),
      ];
    }

    // Revenue Range
    if (params.revenueRange) {
      apiParams.revenue_range = params.revenueRange;
    }

    // Funding
    if (params.fundingMin || params.fundingMax) {
      apiParams.funding_raised_min = params.fundingMin;
      apiParams.funding_raised_max = params.fundingMax;
    }
    if (params.latestFundingStage) {
      apiParams.latest_funding_stage = params.latestFundingStage;
    }

    // Year Founded
    if (params.yearFoundedMin || params.yearFoundedMax) {
      apiParams.organization_year_founded_min = params.yearFoundedMin;
      apiParams.organization_year_founded_max = params.yearFoundedMax;
    }

    // Company Type
    if (params.companyType) {
      apiParams.organization_type = params.companyType;
    }

    // Technologies
    if (params.technologies && params.technologies.length > 0) {
      apiParams.technologies = params.technologies;
    }

    // Hiring Signals
    if (params.isHiring) {
      apiParams.organization_is_hiring = true;
    }
    if (params.departmentHeadcount) {
      apiParams.department_headcount = params.departmentHeadcount;
    }
    if (params.jobPostings) {
      apiParams.job_postings = params.jobPostings;
    }

    const response = await apolloApiCall<ApolloSearchResponse>(
      "/organizations/search",
      apiParams,
    );

    const results = (response.organizations || [])
      .map((org) => {
        try {
          return mapApolloOrganizationResponse({ organization: org });
        } catch {
          return null;
        }
      })
      .filter((r): r is ApolloEnrichmentResult => r !== null);

    const output = {
      results,
      total: response.pagination?.total_entries || results.length,
    };

    // Cache the search results
    searchCache.set(cKey, output);

    return output;
  } catch (error) {
    console.error("[Apollo] Search failed:", error);
    return { results: [], total: 0 };
  }
}

// ============================================
// ENRICHMENT STRATEGIES
// ============================================

async function enrichByEmail(
  email: string,
): Promise<ApolloEnrichmentResult | null> {
  try {
    const response = await apolloApiCall<ApolloPersonResponse>(
      "/people/match",
      {
        email,
      },
    );

    if (!response.person) return null;

    return mapApolloPersonResponse(response);
  } catch (error) {
    console.log(
      `[Apollo] Email enrichment failed: ${error instanceof Error ? error.message : "Unknown"}`,
    );
    return null;
  }
}

async function enrichByLinkedIn(
  linkedinUrl: string,
): Promise<ApolloEnrichmentResult | null> {
  try {
    const response = await apolloApiCall<ApolloPersonResponse>(
      "/people/match",
      {
        linkedin_url: linkedinUrl,
      },
    );

    if (!response.person) return null;

    return mapApolloPersonResponse(response);
  } catch (error) {
    console.log(
      `[Apollo] LinkedIn enrichment failed: ${error instanceof Error ? error.message : "Unknown"}`,
    );
    return null;
  }
}

async function enrichByNameAndCompany(
  firstName: string,
  lastName: string,
  companyName: string,
): Promise<ApolloEnrichmentResult | null> {
  try {
    const response = await apolloApiCall<ApolloPersonResponse>(
      "/people/match",
      {
        first_name: firstName,
        last_name: lastName,
        organization_name: companyName,
      },
    );

    if (!response.person) return null;

    return mapApolloPersonResponse(response);
  } catch (error) {
    console.log(
      `[Apollo] Name+Company enrichment failed: ${error instanceof Error ? error.message : "Unknown"}`,
    );
    return null;
  }
}

async function enrichCompanyByDomain(
  domain: string,
): Promise<ApolloEnrichmentResult | null> {
  try {
    // Extract domain from URL if needed
    const cleanDomain = extractDomain(domain);

    const response = await apolloApiCall<ApolloOrganizationResponse>(
      "/organizations/enrich",
      {
        domain: cleanDomain,
      },
    );

    if (!response.organization) return null;

    return mapApolloOrganizationResponse(response);
  } catch (error) {
    console.log(
      `[Apollo] Company enrichment failed: ${error instanceof Error ? error.message : "Unknown"}`,
    );
    return null;
  }
}

// ============================================
// API CALL WRAPPER
// ============================================

async function apolloApiCall<T>(
  endpoint: string,
  body: Record<string, any>,
): Promise<T> {
  // Rate limit: wait for available token
  await apolloRateLimiter.waitForToken();

  const url = `https://api.apollo.io/v1${endpoint}`;

  // Track the credit usage (not cached)
  const creditEndpoint = endpoint.replace(/^\//, "") as ApolloEndpoint;
  trackCreditUsage(creditEndpoint, false);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": config.integrations.apollo.apiKey,
    },
    body: JSON.stringify(body),
  });

  // Handle rate limit responses with retry
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("retry-after") || "5");
    console.warn(`[Apollo] Rate limited. Retrying after ${retryAfter}s...`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return apolloApiCall<T>(endpoint, body);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Apollo API error: ${response.status} ${response.statusText} - ${text}`,
    );
  }

  return response.json();
}

// ============================================
// RESPONSE MAPPERS
// ============================================

function mapApolloPersonResponse(
  response: ApolloPersonResponse,
): ApolloEnrichmentResult {
  const person = response.person;
  if (!person) {
    throw new Error("No person data in response");
  }

  const org = person.organization;

  return {
    person: {
      firstName: person.first_name || undefined,
      lastName: person.last_name || undefined,
      title: person.title || undefined,
      linkedin: person.linkedin_url || undefined,
      email: person.email || undefined,
      phone: person.phone_numbers?.[0]?.raw_number || undefined,
      seniority: person.seniority || undefined,
    },
    company: org
      ? {
          name: org.name || undefined,
          domain: org.website_url || undefined,
          industry: org.industry || undefined,
          size: org.estimated_num_employees
            ? categorizeCompanySize(org.estimated_num_employees)
            : undefined,
          country: org.country || undefined,
          city: org.city || undefined,
          state: org.state || undefined,
          linkedin: org.linkedin_url || undefined,
          description: org.short_description || undefined,
        }
      : undefined,
    source: "apollo",
    confidence: calculateConfidence(person),
    metadata: {
      apolloId: person.id,
      lastEnriched: new Date().toISOString(),
    },
  };
}

function mapApolloOrganizationResponse(
  response: ApolloOrganizationResponse,
): ApolloEnrichmentResult {
  const org = response.organization;
  if (!org) {
    throw new Error("No organization data in response");
  }

  return {
    company: {
      name: org.name || undefined,
      domain: org.website_url || undefined,
      industry: org.industry || undefined,
      size: org.estimated_num_employees
        ? categorizeCompanySize(org.estimated_num_employees)
        : undefined,
      country: org.country || undefined,
      city: org.city || undefined,
      state: org.state || undefined,
      linkedin: org.linkedin_url || undefined,
      description: org.short_description || undefined,
      phone:
        org.sanitized_phone ||
        org.phone ||
        org.primary_phone?.number ||
        (typeof org.primary_phone === "string"
          ? org.primary_phone
          : undefined) ||
        org.account?.phone ||
        undefined,
    },
    source: "apollo",
    confidence: calculateOrganizationConfidence(org),
    metadata: {
      apolloId: org.id,
      lastEnriched: new Date().toISOString(),
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function categorizeCompanySize(numEmployees: number): string {
  if (numEmployees < 10) return "1-10";
  if (numEmployees < 50) return "11-50";
  if (numEmployees < 200) return "51-200";
  if (numEmployees < 500) return "201-500";
  if (numEmployees < 1000) return "501-1000";
  if (numEmployees < 5000) return "1001-5000";
  if (numEmployees < 10000) return "5001-10000";
  return "10000+";
}

function calculateConfidence(person: ApolloPersonResponse["person"]): number {
  if (!person) return 0;

  let score = 0;

  // Email is highly reliable
  if (person.email) score += 30;
  // LinkedIn presence
  if (person.linkedin_url) score += 20;
  // Title information
  if (person.title) score += 15;
  // Name completeness
  if (person.first_name && person.last_name) score += 15;
  // Phone number
  if (person.phone_numbers && person.phone_numbers.length > 0) score += 10;
  // Organization data
  if (person.organization?.name) score += 10;

  return Math.min(100, score);
}

function calculateOrganizationConfidence(
  org: ApolloOrganizationResponse["organization"],
): number {
  if (!org) return 0;

  let score = 0;

  if (org.name) score += 20;
  if (org.website_url) score += 20;
  if (org.industry) score += 15;
  if (org.estimated_num_employees) score += 15;
  if (org.country) score += 10;
  if (org.linkedin_url) score += 10;
  if (org.short_description) score += 10;

  return Math.min(100, score);
}

function extractDomain(url: string): string {
  try {
    // Remove protocol if present
    let domain = url.replace(/^https?:\/\//, "");
    // Remove www. if present
    domain = domain.replace(/^www\./, "");
    // Remove path and query string
    domain = domain.split("/")[0];
    domain = domain.split("?")[0];
    return domain;
  } catch {
    return url;
  }
}
