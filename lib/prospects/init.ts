// ============================================
// PROSPECT ORCHESTRATION INITIALIZATION
// Call this on application startup
// ============================================

import { initializeProspectWorkers } from './queue/workers';

let isInitialized = false;

/**
 * Initialize Prospect Orchestration Engine
 * Call this once on server startup
 */
export function initializeProspectOrchestration() {
  if (isInitialized) {
    console.warn('[POE] Already initialized, skipping...');
    return;
  }

  try {
    // Only initialize workers if Redis is available
    // Workers will handle Redis connection errors gracefully
    initializeProspectWorkers();
    isInitialized = true;
    console.log('[POE] Prospect Orchestration Engine initialized');
  } catch (error) {
    console.error('[POE] Failed to initialize:', error);
    // Don't throw - allow app to start even if POE fails
  }
}

/**
 * Check if POE is initialized
 */
export function isProspectOrchestrationInitialized(): boolean {
  return isInitialized;
}
