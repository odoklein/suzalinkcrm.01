// ============================================
// PROSPECT SCORING SERVICE
// Calculates quality and confidence scores
// ============================================

import { ProspectProfile } from '@prisma/client';

export interface ScoringResult {
  qualityScore: number; // 0-100: How good is this prospect?
  confidenceScore: number; // 0-100: How complete/confident is the data?
}

// ============================================
// CALCULATE SCORES
// ============================================

export function calculateScores(profile: ProspectProfile): ScoringResult {
  return {
    qualityScore: calculateQualityScore(profile),
    confidenceScore: calculateConfidenceScore(profile),
  };
}

// ============================================
// QUALITY SCORE (0-100)
// Based on data quality and completeness
// ============================================

function calculateQualityScore(profile: ProspectProfile): number {
  let score = 0;

  // Contact information (40 points max)
  if (profile.firstName && profile.lastName) score += 10;
  if (profile.email) {
    score += 10;
    // Bonus for professional email domains
    if (profile.email && !isFreeEmailProvider(profile.email)) {
      score += 5;
    }
  }
  if (profile.phone) score += 10;
  if (profile.linkedin) score += 5;

  // Company information (30 points max)
  if (profile.companyName) score += 10;
  if (profile.companyWebsite) score += 5;
  if (profile.companyIndustry) score += 5;
  if (profile.companyCountry) score += 5;
  if (profile.companySize) score += 5;

  // Title/role (15 points max)
  if (profile.title) {
    score += 10;
    // Bonus for decision-maker titles
    if (isDecisionMakerTitle(profile.title)) {
      score += 5;
    }
  }

  // Data completeness bonus (15 points max)
  const hasMultipleChannels = [profile.email, profile.phone, profile.linkedin].filter(Boolean).length;
  if (hasMultipleChannels >= 2) score += 10;
  if (hasMultipleChannels >= 3) score += 5;

  return Math.min(100, score);
}

// ============================================
// CONFIDENCE SCORE (0-100)
// Based on data completeness and reliability
// ============================================

function calculateConfidenceScore(profile: ProspectProfile): number {
  let score = 0;

  // Required fields (50 points)
  if (profile.firstName) score += 10;
  if (profile.lastName) score += 10;
  if (profile.email) {
    score += 15;
    // Higher confidence for validated email formats
    if (isValidEmail(profile.email)) {
      score += 5;
    }
  }
  if (profile.companyName) score += 10;

  // Contact channels (30 points)
  if (profile.phone) score += 10;
  if (profile.linkedin) score += 10;
  if (profile.email && profile.phone) score += 10; // Multiple channels

  // Company data (20 points)
  if (profile.companyWebsite) score += 5;
  if (profile.companyIndustry) score += 5;
  if (profile.companyCountry) score += 5;
  if (profile.title) score += 5;

  return Math.min(100, score);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isFreeEmailProvider(email: string): boolean {
  const freeProviders = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'mail.com',
    'protonmail.com',
    'yandex.com',
  ];
  const domain = email.split('@')[1]?.toLowerCase();
  return freeProviders.includes(domain || '');
}

function isDecisionMakerTitle(title: string): boolean {
  const decisionMakerKeywords = [
    'ceo',
    'cto',
    'cfo',
    'founder',
    'co-founder',
    'president',
    'director',
    'vp',
    'vice president',
    'head of',
    'manager',
    'owner',
  ];
  const lowerTitle = title.toLowerCase();
  return decisionMakerKeywords.some(keyword => lowerTitle.includes(keyword));
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
