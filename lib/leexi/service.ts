// ============================================
// LEEXI API SERVICE
// Live fetch of calls/meetings with recaps
// Auth: HTTP Basic (KEY_ID:KEY_SECRET)
// ============================================

import { prisma } from "@/lib/prisma";

const LEEXI_API_BASE = 'https://public-api.leexi.ai/v1';

// ============================================
// TYPES
// ============================================

export interface LeexiCallParticipant {
  name?: string;
  email?: string;
  company?: string;
}

export interface LeexiCall {
  id: string;
  title?: string;
  date?: string;
  duration?: number;
  summary?: string;
  recap?: string;
  transcript?: string;
  participants?: LeexiCallParticipant[];
  company_name?: string;
}

export interface LeexiRecap {
  id: string;
  title: string;
  date: string;
  duration: number;
  recapText: string;
  companyName: string;
  participants: LeexiCallParticipant[];
}

// ============================================
// AUTH
// ============================================

const CONFIG_KEY_ID = "leexiApiKeyId";
const CONFIG_KEY_SECRET = "leexiApiKeySecret";

async function getLeexiCredentials() {
  const records = await prisma.systemConfig.findMany({
    where: { key: { in: [CONFIG_KEY_ID, CONFIG_KEY_SECRET] } },
  });

  const idFromSettings = records.find((r) => r.key === CONFIG_KEY_ID)?.value?.trim();
  const secretFromSettings = records.find((r) => r.key === CONFIG_KEY_SECRET)?.value?.trim();

  const keyId = idFromSettings || process.env.LEEXI_API_KEY_ID || "";
  const keySecret = secretFromSettings || process.env.LEEXI_API_KEY_SECRET || "";

  return {
    keyId: keyId.trim(),
    keySecret: keySecret.trim(),
  };
}

async function getAuthHeader(): Promise<string | null> {
  const { keyId, keySecret } = await getLeexiCredentials();
  if (!keyId || !keySecret) return null;
  const encoded = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${encoded}`;
}

export async function isLeexiAvailable(): Promise<boolean> {
  const { keyId, keySecret } = await getLeexiCredentials();
  return !!keyId && !!keySecret;
}

// ============================================
// API CALLS
// ============================================

async function leexiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const auth = await getAuthHeader();
  if (!auth) throw new Error('LEEXI_API_KEY_ID / LEEXI_API_KEY_SECRET non configurés');

  const url = new URL(`${LEEXI_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Leexi API error (${response.status}): ${text.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Fetch recent calls/meetings from Leexi.
 * Returns up to `limit` items (max 100 per Leexi docs).
 */
export async function fetchLeexiCalls(page = 1, items = 50): Promise<LeexiCall[]> {
  try {
    const data = await leexiFetch<LeexiCall[] | { data?: LeexiCall[] }>('/calls', {
      page: String(page),
      items: String(Math.min(items, 100)),
    });

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (err: any) {
    if (err?.message?.includes('403') || err?.message?.includes('401')) {
      console.warn('Leexi access denied (401/403): API key might lack permissions.', err.message);
      return [];
    }
    throw err;
  }
}

/**
 * Search Leexi calls by query string (searches title, company name, participant names).
 * Client-side filter over fetched calls since Leexi API doesn't expose a search param.
 */
export async function searchLeexiCalls(query: string, maxPages = 3): Promise<LeexiCall[]> {
  const q = query.toLowerCase().trim();
  if (!q) return fetchLeexiCalls(1, 50);

  const allCalls: LeexiCall[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const calls = await fetchLeexiCalls(page, 100);
    allCalls.push(...calls);
    if (calls.length < 100) break;
  }

  return allCalls.filter((call) => {
    const searchable = [
      call.title,
      call.company_name,
      ...(call.participants?.map((p) => [p.name, p.company, p.email].join(' ')) ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(q);
  });
}

/**
 * Fetch a single Leexi call by ID, with full transcript/recap.
 */
export async function fetchLeexiCallById(callId: string): Promise<LeexiCall> {
  return leexiFetch<LeexiCall>(`/calls/${callId}`);
}

// ============================================
// NORMALIZE TO RECAP
// ============================================

function extractCompanyName(call: LeexiCall): string {
  if (call.company_name) return call.company_name;
  const externalParticipant = call.participants?.find((p) => p.company);
  if (externalParticipant?.company) return externalParticipant.company;
  return '';
}

function extractRecapText(call: LeexiCall): string {
  if (call.recap) return call.recap;
  if (call.summary) return call.summary;
  if (call.transcript) return call.transcript.slice(0, 5000);
  return '';
}

/**
 * Fetch and normalize Leexi calls into LeexiRecap objects.
 * Only returns calls that have some recap/summary content.
 */
export async function fetchLeexiRecaps(page = 1, items = 50): Promise<LeexiRecap[]> {
  const calls = await fetchLeexiCalls(page, items);

  return calls
    .map((call) => ({
      id: call.id,
      title: call.title || 'Appel sans titre',
      date: call.date || new Date().toISOString(),
      duration: call.duration || 0,
      recapText: extractRecapText(call),
      companyName: extractCompanyName(call),
      participants: call.participants || [],
    }))
    .filter((r) => r.recapText.length > 0);
}
