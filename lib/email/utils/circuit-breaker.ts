// ============================================
// CIRCUIT BREAKER FOR MAILBOX OPERATIONS
// Prevents cascading failures from problematic mailboxes
// ============================================

interface CircuitState {
    failures: number;
    lastFailure: Date | null;
    status: 'closed' | 'open' | 'half-open';
}

// In-memory circuit state per mailbox
const circuits = new Map<string, CircuitState>();

// Configuration
const FAILURE_THRESHOLD = 5;          // Open circuit after 5 consecutive failures
const RECOVERY_TIME_MS = 300000;      // 5 minutes before attempting recovery
const HALF_OPEN_ATTEMPTS = 1;         // Number of test requests in half-open state

/**
 * Check if operations can be executed for a mailbox
 * Returns false if the circuit is open (mailbox is in failure state)
 */
export function canExecute(mailboxId: string): boolean {
    const state = circuits.get(mailboxId);

    // No state or closed circuit - allow execution
    if (!state || state.status === 'closed') {
        return true;
    }

    // Open circuit - check if recovery time has passed
    if (state.status === 'open') {
        const elapsed = Date.now() - (state.lastFailure?.getTime() || 0);
        if (elapsed > RECOVERY_TIME_MS) {
            // Transition to half-open to allow one test request
            state.status = 'half-open';
            circuits.set(mailboxId, state);
            return true;
        }
        return false;
    }

    // Half-open - allow execution to test recovery
    return true;
}

/**
 * Record a successful operation - reset the circuit
 */
export function recordSuccess(mailboxId: string): void {
    circuits.set(mailboxId, {
        failures: 0,
        lastFailure: null,
        status: 'closed',
    });
}

/**
 * Record a failed operation - may open the circuit
 */
export function recordFailure(mailboxId: string): void {
    const state = circuits.get(mailboxId) || {
        failures: 0,
        lastFailure: null,
        status: 'closed' as const,
    };

    state.failures++;
    state.lastFailure = new Date();

    // If in half-open and failed, go back to fully open
    if (state.status === 'half-open') {
        state.status = 'open';
    } else if (state.failures >= FAILURE_THRESHOLD) {
        state.status = 'open';
    }

    circuits.set(mailboxId, state);
}

/**
 * Get current circuit state for a mailbox (for debugging/monitoring)
 */
export function getCircuitState(mailboxId: string): CircuitState | null {
    return circuits.get(mailboxId) || null;
}

/**
 * Manually reset a circuit (for admin operations)
 */
export function resetCircuit(mailboxId: string): void {
    circuits.delete(mailboxId);
}

/**
 * Get all open circuits (for monitoring)
 */
export function getOpenCircuits(): { mailboxId: string; state: CircuitState }[] {
    const openCircuits: { mailboxId: string; state: CircuitState }[] = [];
    for (const [mailboxId, state] of circuits) {
        if (state.status === 'open' || state.status === 'half-open') {
            openCircuits.push({ mailboxId, state });
        }
    }
    return openCircuits;
}
