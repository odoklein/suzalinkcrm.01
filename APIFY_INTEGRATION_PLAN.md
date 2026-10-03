# Apify Integration Implementation Plan using Google Maps Scraper (Compass)

## Overview

This document outlines the successful integration of Apify (Google Maps Scraper) alongside Apollo.io in the Listing page. This enables dual-provider sourcing of B2B leads.

## 1. Project Analysis & Architecture

- **Framework**: Next.js 16 (App Router).
- **Authentication**: NextAuth (v4).
- **Services**: Modularized in `lib/listing/`. `apollo-service.ts` and `apify-service.ts`.
- **UI**: Tailwind CSS, Lucide Icons, Custom Components.

## 2. Apify Integration Architecture

### Backend Services

- **Apify Service (`lib/listing/apify-service.ts`)**:
  - `startApifyRun`: Triggers the `compass/crawler-google-places` actor.
  - `getApifyRunStatus`: Polls run status (READY -> RUNNING -> SUCCEEDED).
  - `getApifyRunResults`: Fetches dataset items once succeeded.
  - `normalizeApifyResults`: Maps Google Maps JSON structure to our unified `ApolloEnrichmentResult` format.

- **Unified Data Model**:
  - `ApolloEnrichmentResult` interface was updated in `lib/listing/apollo-service.ts` to support `source: "apollo" | "apify-google-maps"`.
  - Added optional metadata fields (`rawUrl`, `reviewsCount`) to store Apify-specific data.

### API Routes

Three new endpoints were created in `app/api/prospects/listing/apify/`:

| Route | Method | Purpose |
|Path|Method|Description|
|---|---|---|
|`/run`|`POST`|Starts the Actor. Returns `runId`.|
|`/status`|`GET`|Checks status of `runId`. Returns status and `datasetId`.|
|`/results`|`GET`|Fetches and normalizes results from `datasetId`.|

### Frontend (User Interface)

- **File**: `app/manager/listing/page.tsx`
- **Provider Switching**: Added a top-level toggle between "Apollo.io" and "Google Maps (Apify)".
- **Dynamic Filters**:
  - **Apollo**: Full suite (Company Size, Revenue, Funding, Technologies, etc.).
  - **Apify**: Focused on "Keywords" (e.g., Dentist, Restaurant) and "Location" (City, Country).
- **Search Logic**:
  - **Apollo**: Direct sync request.
  - **Apify**: Async flow (Start -> Poll -> Fetch).
    - Displays "Initiation de la recherche..."
    - Shows real-time polling status
    - Automatically fetches results upon success

## 3. Data Normalization & Flow

**Normalization Logic (`normalizeApifyResults`)**:

- **Name**: `title`
- **Domain**: `website` (cleaned)
- **Industry**: `categoryName`
- **Location**: `city` extract from address, `countryCode`.
- **Confidence**: `totalScore` \* 20 (mapping 5-star rating to 100% scale).

## 4. Environment Variables

Added `APIFY_API_TOKEN` to `.env`.

- Ensure this variable is set in production deployment (Vercel/Docker).

## 5. Usage Guide

1. Go to **Manager > Listing**.
2. Select **Google Maps (Apify)** provider.
3. Enter keywords (e.g., "Marketing Agency") and Location (e.g., "London").
4. Click **Rechercher**.
5. Wait for the run to complete (status updates automatically).
6. Select leads and click **Envoyer au Pipeline** to import.
