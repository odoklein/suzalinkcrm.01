// ============================================
// RULE RECOMMENDATIONS ENGINE
// Suggests common validation and scoring rules
// ============================================

import { ProspectPipelineStep } from '@prisma/client';

export interface RuleRecommendation {
  id: string;
  name: string;
  description: string;
  step: ProspectPipelineStep;
  condition: {
    field: string;
    operator: string;
    value: any;
  };
  action: {
    type: string;
    value: any;
    reason: string;
  };
  priority: number;
  category: 'validation' | 'scoring' | 'routing';
}

// ============================================
// RECOMMENDED RULES
// ============================================

export const RULE_RECOMMENDATIONS: RuleRecommendation[] = [
  // Validation rules
  {
    id: 'validate-free-email',
    name: 'Valider les emails professionnels',
    description: 'Réduire le score pour les fournisseurs d\'email gratuits',
    step: ProspectPipelineStep.VALIDATE,
    condition: {
      field: 'email',
      operator: 'endsWith',
      value: '@gmail.com',
    },
    action: {
      type: 'adjustScore',
      value: -30,
      reason: 'Fournisseur d\'email gratuit détecté',
    },
    priority: 50,
    category: 'validation',
  },
  {
    id: 'validate-missing-phone',
    name: 'Requérir téléphone pour révision',
    description: 'Marquer pour révision si téléphone manquant',
    step: ProspectPipelineStep.VALIDATE,
    condition: {
      field: 'phone',
      operator: 'isEmpty',
      value: null,
    },
    action: {
      type: 'requireReview',
      value: null,
      reason: 'Téléphone manquant - révision requise',
    },
    priority: 40,
    category: 'validation',
  },
  {
    id: 'validate-missing-company',
    name: 'Rejeter si entreprise manquante',
    description: 'Rejeter les prospects sans nom d\'entreprise',
    step: ProspectPipelineStep.VALIDATE,
    condition: {
      field: 'companyName',
      operator: 'isEmpty',
      value: null,
    },
    action: {
      type: 'reject',
      value: null,
      reason: 'Nom d\'entreprise manquant',
    },
    priority: 60,
    category: 'validation',
  },

  // Scoring rules
  {
    id: 'score-decision-maker',
    name: 'Bonus pour décideurs',
    description: 'Augmenter le score pour les titres de décideurs',
    step: ProspectPipelineStep.SCORE,
    condition: {
      field: 'title',
      operator: 'contains',
      value: 'CEO',
    },
    action: {
      type: 'adjustScore',
      value: 20,
      reason: 'Titre de décideur détecté',
    },
    priority: 30,
    category: 'scoring',
  },
  {
    id: 'score-linkedin-present',
    name: 'Bonus LinkedIn',
    description: 'Augmenter le score si LinkedIn présent',
    step: ProspectPipelineStep.SCORE,
    condition: {
      field: 'linkedin',
      operator: 'isNotEmpty',
      value: null,
    },
    action: {
      type: 'adjustScore',
      value: 10,
      reason: 'Profil LinkedIn présent',
    },
    priority: 20,
    category: 'scoring',
  },
  {
    id: 'score-multiple-channels',
    name: 'Bonus canaux multiples',
    description: 'Augmenter le score pour plusieurs canaux de contact',
    step: ProspectPipelineStep.SCORE,
    condition: {
      field: 'qualityScore',
      operator: 'greaterThan',
      value: 60,
    },
    action: {
      type: 'adjustScore',
      value: 15,
      reason: 'Données complètes avec canaux multiples',
    },
    priority: 10,
    category: 'scoring',
  },

  // Routing rules (examples - would need mission IDs)
  {
    id: 'route-saas-industry',
    name: 'Router SaaS vers mission spécifique',
    description: 'Assigner automatiquement les prospects SaaS',
    step: ProspectPipelineStep.ROUTE,
    condition: {
      field: 'companyIndustry',
      operator: 'equals',
      value: 'SaaS',
    },
    action: {
      type: 'setField',
      value: { assignedMissionId: 'MISSION_ID_PLACEHOLDER' },
      reason: 'Industrie SaaS - routage automatique',
    },
    priority: 50,
    category: 'routing',
  },
];

// ============================================
// GET RECOMMENDATIONS BY STEP
// ============================================

export function getRecommendationsByStep(step: ProspectPipelineStep): RuleRecommendation[] {
  return RULE_RECOMMENDATIONS.filter((r) => r.step === step);
}

// ============================================
// GET RECOMMENDATIONS BY CATEGORY
// ============================================

export function getRecommendationsByCategory(
  category: 'validation' | 'scoring' | 'routing'
): RuleRecommendation[] {
  return RULE_RECOMMENDATIONS.filter((r) => r.category === category);
}

// ============================================
// GET ALL RECOMMENDATIONS
// ============================================

export function getAllRecommendations(): RuleRecommendation[] {
  return RULE_RECOMMENDATIONS;
}
