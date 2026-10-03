// ============================================
// SALES PLAYBOOK TYPES (from Leexi Recap)
// Shared across API route, service, and UI
// ============================================

export interface PlaybookEmailStep {
  subject: string;
  body: string;
}

export interface PlaybookSignal {
  type: 'positive' | 'warning' | 'neutral';
  text: string;
}

export interface PlaybookMissionParams {
  channel: 'CALL' | 'EMAIL' | 'LINKEDIN' | '';
  working_days_per_month: number;
  duration_months: number;
  rdv_target_per_month: number;
  start_date: string;
}

export interface PlaybookObjectionHandling {
  objection: string;
  response: string;
}

export interface Playbook {
  company_name: string;
  website: string;
  sector: string;
  target_roles: string[];
  target_sectors: string[];
  company_size_min: number;
  company_size_max: number;
  geography: string[];
  value_proposition: string;
  competitors: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  persona_objectives: string[];
  persona_pains: string[];
  objections: string[];
  objection_handling: PlaybookObjectionHandling[];
  differentiators: string[];
  phone_script: string;
  call_scripts: string[];
  email_sequence: PlaybookEmailStep[];
  mission_params: PlaybookMissionParams;
  signals_from_call: PlaybookSignal[];
  key_contacts: Array<{ name: string; role: string; email: string }>;
}

export function emptyPlaybook(): Playbook {
  return {
    company_name: '',
    website: '',
    sector: '',
    target_roles: [],
    target_sectors: [],
    company_size_min: 0,
    company_size_max: 0,
    geography: [],
    value_proposition: '',
    competitors: [],
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
    persona_objectives: [],
    persona_pains: [],
    objections: [],
    objection_handling: [],
    differentiators: [],
    phone_script: '',
    call_scripts: [],
    email_sequence: [],
    mission_params: {
      channel: '',
      working_days_per_month: 0,
      duration_months: 0,
      rdv_target_per_month: 0,
      start_date: '',
    },
    signals_from_call: [],
    key_contacts: [],
  };
}

function safeString(v: unknown): string {
  if (typeof v === 'string') return v;
  return '';
}

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : String(x ?? ''))).filter(Boolean);
}

function safeEmailSequence(v: unknown): PlaybookEmailStep[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    if (!item || typeof item !== 'object') return { subject: '', body: '' };
    const o = item as Record<string, unknown>;
    return {
      subject: safeString(o.subject),
      body: safeString(o.body),
    };
  });
}

function safeObjectArray<T>(v: unknown, normalizer: (item: unknown) => T): T[] {
  if (!Array.isArray(v)) return [];
  return v.map(normalizer);
}

function normalizeSignal(item: unknown): PlaybookSignal {
  if (!item || typeof item !== 'object') return { type: 'neutral', text: '' };
  const o = item as Record<string, unknown>;
  const type = safeString(o.type);
  return {
    type: (type === 'positive' || type === 'warning' || type === 'neutral') ? type : 'neutral',
    text: safeString(o.text),
  };
}

function normalizeObjectionHandling(item: unknown): PlaybookObjectionHandling {
  if (!item || typeof item !== 'object') return { objection: '', response: '' };
  const o = item as Record<string, unknown>;
  return { objection: safeString(o.objection), response: safeString(o.response) };
}

function normalizeContact(item: unknown): { name: string; role: string; email: string } {
  if (!item || typeof item !== 'object') return { name: '', role: '', email: '' };
  const o = item as Record<string, unknown>;
  return { name: safeString(o.name), role: safeString(o.role), email: safeString(o.email) };
}

function normalizeMissionParams(v: unknown): PlaybookMissionParams {
  if (!v || typeof v !== 'object') return emptyPlaybook().mission_params;
  const o = v as Record<string, unknown>;
  const ch = safeString(o.channel).toUpperCase();
  return {
    channel: (ch === 'CALL' || ch === 'EMAIL' || ch === 'LINKEDIN') ? ch : '',
    working_days_per_month: safeNumber(o.working_days_per_month),
    duration_months: safeNumber(o.duration_months),
    rdv_target_per_month: safeNumber(o.rdv_target_per_month),
    start_date: safeString(o.start_date),
  };
}

/**
 * Normalize raw AI output into a strictly typed Playbook.
 * Missing/invalid fields fall back to safe empty defaults.
 */
export function normalizePlaybook(raw: unknown): Playbook {
  if (!raw || typeof raw !== 'object') return emptyPlaybook();
  const o = raw as Record<string, unknown>;
  return {
    company_name: safeString(o.company_name),
    website: safeString(o.website),
    sector: safeString(o.sector),
    target_roles: safeStringArray(o.target_roles),
    target_sectors: safeStringArray(o.target_sectors),
    company_size_min: safeNumber(o.company_size_min),
    company_size_max: safeNumber(o.company_size_max),
    geography: safeStringArray(o.geography),
    value_proposition: safeString(o.value_proposition),
    competitors: safeStringArray(o.competitors),
    strengths: safeStringArray(o.strengths),
    weaknesses: safeStringArray(o.weaknesses),
    opportunities: safeStringArray(o.opportunities),
    threats: safeStringArray(o.threats),
    persona_objectives: safeStringArray(o.persona_objectives),
    persona_pains: safeStringArray(o.persona_pains),
    objections: safeStringArray(o.objections),
    objection_handling: safeObjectArray(o.objection_handling, normalizeObjectionHandling),
    differentiators: safeStringArray(o.differentiators),
    phone_script: safeString(o.phone_script),
    call_scripts: safeStringArray(o.call_scripts),
    email_sequence: safeEmailSequence(o.email_sequence),
    mission_params: normalizeMissionParams(o.mission_params),
    signals_from_call: safeObjectArray(o.signals_from_call, normalizeSignal),
    key_contacts: safeObjectArray(o.key_contacts, normalizeContact),
  };
}
