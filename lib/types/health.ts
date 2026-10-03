// ============================================
// PROSPECTION HEALTH SYSTEM — TYPE DEFINITIONS
// ============================================
//
// Every metric is designed for explainability:
//   - Each status includes a human-readable explanation of how it was computed
//   - Thresholds are named constants (see HEALTH_THRESHOLDS below)
//   - Sparse-data guards prevent misleading states when data is insufficient
//
// Data model note: All metrics are computed on-demand from the Action table.
// A future ListHealthSnapshot model (see migration notes) can cache these
// results for improved performance at scale.

// ============================================
// THRESHOLDS (single source of truth)
// ============================================

export const HEALTH_THRESHOLDS = {
    /** Min contacts for a non-trivial health assessment */
    SPARSE_CONTACT_MIN: 5,
    /** Min actions for a meaningful rate calculation */
    SPARSE_ACTION_MIN: 3,
    /** Coverage % at which a list is considered fully prospected */
    FULLY_PROSPECTED_COVERAGE: 80,
    /** Coverage % below which, combined with inactivity, triggers AT_RISK */
    AT_RISK_COVERAGE_MAX: 20,
    /** Days since last action that triggers AT_RISK (combined with low coverage) */
    AT_RISK_INACTIVITY_DAYS: 7,
    /** Days since last action that triggers STALLED regardless of coverage */
    STALLED_INACTIVITY_DAYS: 30,
    /** List age in days below which ETA/velocity predictions are suppressed */
    NEW_LIST_DAYS: 3,
    /** Velocity change % that counts as RISING vs STABLE */
    VELOCITY_RISING_THRESHOLD: 0.10,  // +10% vs 30d average
    /** Velocity change % that counts as DECLINING vs STABLE */
    VELOCITY_DECLINING_THRESHOLD: -0.20, // -20% vs 30d average
    /** Bad-contact rate that triggers a quality warning hint */
    BAD_CONTACT_HINT_THRESHOLD: 0.25, // 25%
    /** Days without activity that triggers a stagnation alert */
    STAGNATION_MODERATE_DAYS: 7,
    STAGNATION_HIGH_DAYS: 14,
    STAGNATION_CRITICAL_DAYS: 30,
} as const;

// ============================================
// CORE STATUS ENUMS
// ============================================

/**
 * The overall prospection health of a list.
 *
 * Classification logic (evaluated in order):
 *  1. INSUFFICIENT_DATA — totalContacts < SPARSE_CONTACT_MIN
 *  2. STALLED           — no action in >30 days OR zero actions ever
 *  3. FULLY_PROSPECTED  — coverageRate >= 80%
 *  4. AT_RISK           — coverageRate < 20% AND daysSinceLastAction > 7
 *  5. IN_PROGRESS       — everything else (active work underway)
 */
export type HealthStatus =
    | 'FULLY_PROSPECTED'   // ≥80% contacts have been attempted; list is near exhaustion
    | 'IN_PROGRESS'        // Active prospection; 20–79% covered or recent activity
    | 'AT_RISK'            // <20% covered AND >7 days since last action
    | 'STALLED'            // No action in >30 days, or zero actions ever recorded
    | 'INSUFFICIENT_DATA'; // Fewer than 5 contacts — metrics are unreliable

export type VelocityTrend =
    | 'RISING'    // 7-day rate ≥ 30-day rate + 10%
    | 'STABLE'    // Within ±20% of 30-day rate
    | 'DECLINING' // 7-day rate < 30-day rate - 20%
    | 'UNKNOWN';  // Not enough data to determine trend

export type ConfidenceLevel =
    | 'HIGH'         // ≥20 actions, consistent recent velocity
    | 'MEDIUM'       // 10–19 actions, or velocity declining slightly
    | 'LOW'          // 3–9 actions, or no recent activity
    | 'INSUFFICIENT'; // <3 actions — no reliable estimate possible

// ============================================
// METRIC INTERFACES
// ============================================

export interface ActionResultBreakdown {
    /** INTERESTED, CALLBACK_REQUESTED, MEETING_BOOKED, REPLIED, PROJET_A_SUIVRE, RELANCE, RAPPEL */
    positive: number;
    /** NOT_INTERESTED, REFUS, REFUS_ARGU, REFUS_CATEGORIQUE, DISQUALIFIED, HORS_CIBLE */
    negative: number;
    /** NO_RESPONSE, BARRAGE_STANDARD, BARRAGE_SECRETAIRE, GERE_PAR_SIEGE, MAIL_UNIQUEMENT, CONNECTION_SENT, MESSAGE_SENT */
    neutral: number;
    /** BAD_CONTACT, NUMERO_KO, FAUX_NUMERO, MAUVAIS_INTERLOCUTEUR, INVALIDE */
    badContact: number;
    /** MEETING_BOOKED (subset of positive) */
    meetings: number;
}

/**
 * Velocity metrics computed over two time windows.
 *
 * actionsPerDay7d  = total actions in last 7 days / 7
 * actionsPerDay30d = total actions in last 30 days / 30
 * newContactsPerDay7d  = distinct contacts first-actioned in last 7 days / 7
 * newContactsPerDay30d = distinct contacts first-actioned in last 30 days / 30
 *
 * trend is determined by comparing actionsPerDay7d vs actionsPerDay30d
 * using the thresholds in HEALTH_THRESHOLDS.
 */
export interface VelocityMetrics {
    actionsPerDay7d: number;
    actionsPerDay30d: number;
    newContactsPerDay7d: number;
    newContactsPerDay30d: number;
    trend: VelocityTrend;
    /** Human-readable explanation of the trend */
    trendExplanation: string;
}

/**
 * Prediction for when the list will reach full prospection coverage.
 *
 * Formula:
 *   remainingContacts = totalContacts - contactedContacts
 *   etaDays = remainingContacts / newContactsPerDay7d   (if velocity > 0)
 *
 * Confidence factors:
 *   HIGH   — velocity consistent (7d ≈ 30d), ≥20 actions
 *   MEDIUM — some velocity, 10–19 actions or slight decline
 *   LOW    — very low velocity (<1 contact/day), <10 actions
 *   INSUFFICIENT — velocity is 0 or list has sparse data
 */
export interface ETAPrediction {
    /** Estimated days to reach FULLY_PROSPECTED. null = cannot predict. */
    etaDays: number | null;
    /** ISO date string of the predicted completion date. null = cannot predict. */
    etaDate: string | null;
    /** How many contacts still need to be prospected */
    remainingContacts: number;
    confidence: ConfidenceLevel;
    /** Why this confidence level was assigned */
    confidenceExplanation: string;
}

export interface SDRContribution {
    sdrId: string;
    sdrName: string;
    actionCount: number;
    contactsReached: number;
    meetingsBooked: number;
}

/**
 * Actionable manager hints surfaced for each list.
 * type POSITIVE = celebrate a success indicator
 * type WARNING  = needs attention soon
 * type CRITICAL = needs immediate action
 * type INFO     = neutral contextual information
 */
export interface ActionableHint {
    type: 'POSITIVE' | 'WARNING' | 'CRITICAL' | 'INFO';
    /** Short one-line message shown in the UI */
    message: string;
    /** Optional longer explanation */
    detail?: string;
}

// ============================================
// FULL HEALTH METRICS (per list)
// ============================================

export interface ListHealthMetrics {
    listId: string;
    listName: string;
    /** ISO timestamp of when these metrics were computed */
    computedAt: string;

    // ── Coverage ──────────────────────────────────
    totalContacts: number;
    totalCompanies: number;
    /** Contacts + companies in the list */
    totalTargets: number;
    /** Contacts that have received at least 1 action */
    contactedContacts: number;
    /** Companies touched either directly or via contact actions */
    contactedCompanies: number;
    /** Contacted contacts + contacted companies */
    contactedTargets: number;
    /**
     * coverageRate = contactedContacts / totalContacts * 100
     * null when totalContacts === 0
     */
    coverageRate: number | null;

    // ── Activity ──────────────────────────────────
    totalActions: number;
    actions7d: number;
    actions30d: number;
    /** Days elapsed since the most recent action. null = no action ever. */
    daysSinceLastAction: number | null;
    lastActionAt: string | null;

    // ── Quality ───────────────────────────────────
    resultBreakdown: ActionResultBreakdown;
    /**
     * positiveRate = positive actions / totalActions * 100
     * null when totalActions === 0
     */
    positiveRate: number | null;
    /** badContactRate = badContact actions / totalActions * 100 */
    badContactRate: number | null;
    /** meetingRate = MEETING_BOOKED / totalActions * 100 */
    meetingRate: number | null;

    // ── Velocity & Prediction ────────────────────
    velocity: VelocityMetrics;
    eta: ETAPrediction;

    // ── Activity Score (0–100 composite) ─────────
    /**
     * activityScore = weighted composite:
     *   40% coverage rate
     *   20% recent activity intensity (actions7d / (totalContacts * 0.05) capped at 100)
     *   20% positive rate
     *   20% velocity trend (100=rising, 50=stable, 0=declining)
     */
    activityScore: number;
    activityScoreExplanation: string;

    // ── Status ────────────────────────────────────
    status: HealthStatus;
    /** French label for display */
    statusLabel: string;
    /** Why this status was assigned */
    statusExplanation: string;

    // ── People ────────────────────────────────────
    topSdrs: SDRContribution[];
    uniqueSdrCount: number;

    // ── Hints ─────────────────────────────────────
    hints: ActionableHint[];

    // ── Metadata ──────────────────────────────────
    /** True if list was created less than NEW_LIST_DAYS ago — ETA unreliable */
    isNewList: boolean;
    /** True if data is too sparse for reliable metrics */
    hasSparseData: boolean;
}

// ============================================
// LIGHTWEIGHT SUMMARY (for lists table)
// ============================================

export interface ListHealthSummary {
    listId: string;
    listName: string;
    missionId: string;
    missionName: string;
    clientId: string;
    clientName: string;
    status: HealthStatus;
    statusLabel: string;
    coverageRate: number | null;
    activityScore: number;
    totalContacts: number;
    totalCompanies: number;
    totalTargets: number;
    contactedContacts: number;
    contactedCompanies: number;
    contactedTargets: number;
    actions7d: number;
    daysSinceLastAction: number | null;
    velocity: Pick<VelocityMetrics, 'trend' | 'actionsPerDay7d' | 'trendExplanation'>;
    eta: Pick<ETAPrediction, 'etaDays' | 'etaDate' | 'confidence'>;
    hints: ActionableHint[];
    hasSparseData: boolean;
    isNewList: boolean;
}

// ============================================
// CLIENT-LEVEL INTELLIGENCE
// ============================================

export interface StagnationAlert {
    listId: string;
    listName: string;
    missionId: string;
    missionName: string;
    /** Days since any action was recorded on this list */
    daysSinceLastAction: number;
    lastActionAt: string | null;
    coverageRate: number | null;
    totalContacts: number;
    /** MODERATE: 7–14 days | HIGH: 14–30 days | CRITICAL: >30 days */
    severity: 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export interface ClientListsIntelligence {
    clientId: string;
    clientName: string;
    computedAt: string;
    dateRange: { from: string; to: string };

    // ── Summary counts ───────────────────────────
    totalLists: number;
    fullyProspectedCount: number;
    inProgressCount: number;
    atRiskCount: number;
    stalledCount: number;
    insufficientDataCount: number;

    // ── Aggregate coverage ───────────────────────
    totalContacts: number;
    totalCompanies: number;
    totalTargets: number;
    totalContactedContacts: number;
    totalContactedCompanies: number;
    totalContactedTargets: number;
    overallCoverageRate: number | null;
    totalActions: number;
    totalActions7d: number;
    totalMeetings: number;

    // ── Individual list summaries ─────────────────
    lists: ListHealthSummary[];

    // ── Rankings ─────────────────────────────────
    /** Top 3 lists by activityScore */
    topPerformers: ListHealthSummary[];
    /** Bottom 3 lists by activityScore (among those with sufficient data) */
    bottomPerformers: ListHealthSummary[];

    // ── Alerts ───────────────────────────────────
    stagnationAlerts: StagnationAlert[];
}

// ============================================
// API FILTER OPTIONS
// ============================================

export interface HealthQueryOptions {
    sdrIds?: string[];
    from?: Date;
    to?: Date;
}

export interface BulkHealthQueryOptions extends HealthQueryOptions {
    missionId?: string;
    clientId?: string;
    listIds?: string[];
    includeArchived?: boolean;
}

// ============================================
// RAW DB QUERY RESULT (internal)
// ============================================

/** Shape returned by the SQL aggregation query — bigint fields from COUNT() */
export interface RawListHealthRow {
    list_id: string;
    total_contacts: bigint;
    total_companies: bigint;
    total_actions: bigint;
    actions_7d: bigint;
    actions_30d: bigint;
    last_action_at: Date | null;
    unique_sdrs: bigint;
    contacted_contacts: bigint;
    contacted_companies: bigint;
    new_contacts_7d: bigint;
    new_contacts_30d: bigint;
    positive_count: bigint;
    meetings_count: bigint;
    bad_contact_count: bigint;
    negative_count: bigint;
    neutral_count: bigint;
}
