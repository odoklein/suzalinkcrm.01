# LISTING Domain

**Purpose:** Lead search, discovery, and enrichment providers.

---

## Overview

The `listing` domain contains integrations with external lead search and data enrichment platforms. These services are used by other domains (like `prospects`) but are kept separate for architectural clarity.

## Why Separate from Prospects?

Apollo.io (and similar providers) are **listing/search providers**, not part of the prospect orchestration logic. They provide:

- Lead search capabilities
- Company discovery
- Contact enrichment
- Data validation

By isolating them in a dedicated domain, we:

1. **Separate concerns** - Listing is a bounded context
2. **Enable reuse** - Apollo can be used beyond just prospect enrichment
3. **Simplify testing** - Listing services can be tested in isolation
4. **Future-proof** - Easy to add new providers (ZoomInfo, Clearbit, etc.)

---

## Current Services

### `apollo-service.ts`

**Provider:** Apollo.io  
**Purpose:** Lead enrichment and company data

**Key Functions:**

- `enrichFromApollo(profile)` - Enriches a ProspectProfile with Apollo data

**Enrichment Strategies:**

1. Email-based (most reliable)
2. LinkedIn URL
3. Name + Company
4. Company domain

**Return Type:**

```typescript
interface ApolloEnrichmentResult {
  company?: { name, domain, industry, size, country, ... };
  person?: { firstName, lastName, title, linkedin, email, phone };
  source: 'apollo';
  confidence: number; // 0-100
}
```

**Configuration:**

- `config.integrations.apollo.enabled` (boolean)
- `config.integrations.apollo.apiKey` (string)

---

## Future Services

### Planned Integrations

- **`zoominfo-service.ts`** - ZoomInfo B2B data
- **`clearbit-service.ts`** - Clearbit enrichment
- **`hunter-service.ts`** - Hunter.io email finder
- **`snov-service.ts`** - Snov.io lead search

### Common Interface

All listing services should follow this pattern:

```typescript
export async function enrichFrom[Provider](
  profile: ProspectProfile
): Promise<[Provider]EnrichmentResult | null> {
  // 1. Pre-flight checks (enabled, API key)
  // 2. Call external API
  // 3. Transform response
  // 4. Return normalized result or null
  // 5. NEVER throw errors (graceful degradation)
}
```

---

## Usage

### From Prospect Pipeline

```typescript
// lib/prospects/pipeline-service.ts
import { enrichFromApollo } from "@/lib/listing/apollo-service";

const result = await enrichFromApollo(profile);
if (result) {
  // Apply enrichment
}
```

### From Manager API (future)

```typescript
// app/api/manager/search/route.ts
import { searchCompanies } from "@/lib/listing/apollo-service";

const companies = await searchCompanies({ industry: "SaaS", size: "50-200" });
```

---

## Architecture Rules

### ✅ DO

- Keep services stateless
- Return `null` on failure (never throw)
- Use typed interfaces
- Log errors without PII
- Follow provider-specific rate limits
- Cache responses when appropriate

### ❌ DON'T

- Import Prisma in listing services
- Import UI components
- Store raw API responses directly
- Log sensitive data (emails, API keys)
- Create database records directly
- Depend on other domains

---

## Testing

Each service should have:

1. Unit tests (isolated API mocking)
2. Integration tests (real API calls, dev mode only)
3. Manual test scripts

Example:

```bash
# Test Apollo service
node test-apollo.js
```

---

## Adding a New Provider

1. **Create service file**

   ```
   lib/listing/[provider]-service.ts
   ```

2. **Implement standard interface**

   ```typescript
   export async function enrichFrom[Provider](profile) { ... }
   ```

3. **Add configuration**

   ```typescript
   // lib/config.ts
   integrations: {
     [provider]: {
       enabled: process.env.[PROVIDER]_ENABLED === 'true',
       apiKey: process.env.[PROVIDER]_API_KEY || '',
     }
   }
   ```

4. **Update consumers**

   ```typescript
   // lib/prospects/pipeline-service.ts
   if (config.enrichmentProvider === '[provider]') {
     const { enrichFrom[Provider] } = await import('@/lib/listing/[provider]-service');
     result = await enrichFrom[Provider](profile);
   }
   ```

5. **Document in this README**

---

## Directory Structure

```
lib/listing/
├── README.md                 (this file)
├── apollo-service.ts         (Apollo.io integration)
├── zoominfo-service.ts       (future)
├── clearbit-service.ts       (future)
└── types.ts                  (shared types, future)
```

---

## Related Domains

- **`lib/prospects/`** - Consumes listing services for enrichment
- **`lib/config.ts`** - Configuration for all providers

---

**Domain Owner:** Engineering Team  
**Last Updated:** 2026-02-02
