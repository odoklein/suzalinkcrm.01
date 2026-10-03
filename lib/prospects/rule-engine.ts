// ============================================
// PROSPECT RULE ENGINE
// Evaluates rules and executes actions
// ============================================

import { ProspectProfile, ProspectRule, ProspectPipelineStep } from '@prisma/client';

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
  value: any;
}

export interface RuleAction {
  type: 'adjustScore' | 'setScore' | 'requireReview' | 'reject' | 'skipStep' | 'setField' | 'setStatus';
  value?: any;
  reason?: string;
}

export interface RuleEvaluationResult {
  matched: boolean;
  action?: RuleAction;
  reason?: string;
  error?: string;
}

// ============================================
// EVALUATE RULE
// ============================================

export function evaluateRule(
  rule: ProspectRule,
  profile: ProspectProfile
): RuleEvaluationResult {
  try {
    const condition = rule.condition as any as RuleCondition;
    const action = rule.action as any as RuleAction;

    // Evaluate condition
    const matched = evaluateCondition(condition, profile);

    if (!matched) {
      return { matched: false };
    }

    return {
      matched: true,
      action,
      reason: action.reason || `Rule "${rule.name}" matched`,
    };
  } catch (error: any) {
    return {
      matched: false,
      error: error.message || 'Rule evaluation error',
    };
  }
}

// ============================================
// EVALUATE CONDITION
// ============================================

function evaluateCondition(
  condition: RuleCondition,
  profile: ProspectProfile
): boolean {
  const fieldValue = getFieldValue(profile, condition.field);

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue || '').toLowerCase() === String(condition.value || '').toLowerCase();

    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(condition.value || '').toLowerCase());

    case 'startsWith':
      return String(fieldValue || '').toLowerCase().startsWith(String(condition.value || '').toLowerCase());

    case 'endsWith':
      return String(fieldValue || '').toLowerCase().endsWith(String(condition.value || '').toLowerCase());

    case 'regex':
      try {
        const regex = new RegExp(condition.value, 'i');
        return regex.test(String(fieldValue || ''));
      } catch {
        return false;
      }

    case 'in':
      const inArray = Array.isArray(condition.value) ? condition.value : [condition.value];
      return inArray.includes(fieldValue);

    case 'notIn':
      const notInArray = Array.isArray(condition.value) ? condition.value : [condition.value];
      return !notInArray.includes(fieldValue);

    case 'isEmpty':
      return !fieldValue || String(fieldValue).trim() === '';

    case 'isNotEmpty':
      return !!fieldValue && String(fieldValue).trim() !== '';

    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);

    case 'lessThan':
      return Number(fieldValue) < Number(condition.value);

    case 'greaterThanOrEqual':
      return Number(fieldValue) >= Number(condition.value);

    case 'lessThanOrEqual':
      return Number(fieldValue) <= Number(condition.value);

    default:
      return false;
  }
}

// ============================================
// GET FIELD VALUE
// ============================================

function getFieldValue(profile: ProspectProfile, fieldPath: string): any {
  // Support nested paths like "company.website"
  const parts = fieldPath.split('.');
  let value: any = profile as any;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return null;
    }
    value = value[part];
  }

  // Also check customFields
  if (value === null || value === undefined) {
    const customFields = (profile.customFields as any) || {};
    value = customFields[fieldPath] || customFields[parts[parts.length - 1]];
  }

  return value;
}

// ============================================
// APPLY ACTION
// ============================================

export interface ActionResult {
  updatedProfile: Partial<ProspectProfile>;
  reviewRequired?: boolean;
  rejected?: boolean;
  skipStep?: boolean;
  reason?: string;
}

export function applyAction(
  action: RuleAction,
  profile: ProspectProfile
): ActionResult {
  const result: ActionResult = {
    updatedProfile: {},
  };

  switch (action.type) {
    case 'adjustScore':
      result.updatedProfile.qualityScore = Math.max(0, Math.min(100, profile.qualityScore + (action.value || 0)));
      result.reason = action.reason || `Score adjusted by ${action.value}`;
      break;

    case 'setScore':
      result.updatedProfile.qualityScore = Math.max(0, Math.min(100, action.value || 0));
      result.reason = action.reason || `Score set to ${action.value}`;
      break;

    case 'requireReview':
      result.reviewRequired = true;
      result.reason = action.reason || 'Review required by rule';
      break;

    case 'reject':
      result.rejected = true;
      result.reason = action.reason || 'Rejected by rule';
      break;

    case 'skipStep':
      result.skipStep = true;
      result.reason = action.reason || 'Step skipped by rule';
      break;

    case 'setField':
      if (action.value && typeof action.value === 'object') {
        result.updatedProfile = { ...result.updatedProfile, ...action.value };
      }
      result.reason = action.reason || 'Field updated by rule';
      break;

    case 'setStatus':
      result.updatedProfile.status = action.value as any;
      result.reason = action.reason || `Status set to ${action.value}`;
      break;
  }

  return result;
}
