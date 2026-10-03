/**
 * Global in-process semaphore for Allo API calls.
 * Prevents concurrent auto-enrichment bursts when multiple bookings arrive simultaneously.
 * Only effective in long-running (non-serverless) deployments — on Vercel, each function
 * instance is isolated. Set ALLO_ENRICH_CONCURRENCY env to override (default 1).
 */

const MAX = Math.max(1, parseInt(process.env.ALLO_ENRICH_CONCURRENCY ?? "1", 10));

let active = 0;
const queue: Array<() => void> = [];

function release() {
  active -= 1;
  if (queue.length > 0) {
    const next = queue.shift()!;
    active += 1;
    next();
  }
}

export function acquireAlloSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryRun = () => resolve(release);
    if (active < MAX) {
      active += 1;
      tryRun();
    } else {
      queue.push(tryRun);
    }
  });
}
