// ============================================
// PLAYBOOK IMPORT TYPES
// Shared between parse API response and import API request
// ============================================

export interface ParsedPlaybookClient {
  name: string;
  website?: string | null;
  sector?: string | null;
  industry?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ParsedPlaybookMission {
  name: string;
  channel: 'CALL' | 'EMAIL' | 'LINKEDIN';
  objective?: string | null;
}

export interface ParsedPlaybookCampaign {
  /** ICP / ciblage: postes, secteurs, taille, zone */
  icp: string;
  postesCibles?: string[];
  secteurs?: string[];
  taille?: string | null;
  zone?: string | null;
  pitch?: string | null;
}

export interface ParsedPlaybookScriptSection {
  title?: string;
  content: string;
}

export interface ParsedPlaybookScript {
  sections?: ParsedPlaybookScriptSection[];
  /** Single script text (if no sections) */
  fullScript?: string | null;
  objections?: string[];
  /** Mapped to Campaign.script { intro, discovery, objection, closing } */
  intro?: string | null;
  discovery?: string | null;
  objection?: string | null;
  closing?: string | null;
}

export interface ParsedPlaybookEmailTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  /** e.g. "J+1", "J+3" */
  delayLabel?: string | null;
  order?: number;
}

export interface ParsedPlaybook {
  client: ParsedPlaybookClient | null;
  missions: ParsedPlaybookMission[];
  campaign: ParsedPlaybookCampaign | null;
  script: ParsedPlaybookScript | null;
  emailTemplates: ParsedPlaybookEmailTemplate[];
  valueProposition?: string | null;
  /** Sections the AI could not map */
  unknownSections?: string[];
  /** Optional: source filename for display */
  sourceFileName?: string | null;
}

export interface PlaybookImportResult {
  clientId: string;
  missionIds: string[];
  campaignIds: string[];
  templateIds: string[];
}
