import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enrichCallActionsParallel } from '@/lib/call-enrichment/enrich-sync-parallel';

// POST /api/sdr/calls/sync
// Finds the SDR's recent CALL actions (last 24h) that haven't been successfully enriched yet,
// runs Allo enrichment on each, and returns per-action results.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  }

  const role = session.user.role as string;
  if (role !== 'SDR' && role !== 'BUSINESS_DEVELOPER' && role !== 'BOOKER') {
    return NextResponse.json({ success: false, error: 'Réservé aux SDR/BD' }, { status: 403 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

  // callEnrichmentAt is only set on successful enrichment (with actual Allo data).
  // Failed attempts (NO_MATCH, NO_PHONE, etc.) leave callEnrichmentAt null.
  // So querying callEnrichmentAt: null captures both never-tried AND previously failed.
  const actions = await prisma.action.findMany({
    where: {
      sdrId: session.user.id,
      channel: 'CALL',
      createdAt: { gte: since },
      callEnrichmentAt: null, // not yet successfully enriched
    },
    select: {
      id: true,
      createdAt: true,
      callEnrichmentError: true,
      callEnrichmentAt: true,
      callSummary: true,
      callRecordingUrl: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  console.log(`[sync-calls] found ${actions.length} unenriched CALL actions for sdrId=${session.user.id} since=${since.toISOString()}`);
  actions.forEach((a) => {
    console.log(`[sync-calls]   actionId=${a.id} createdAt=${a.createdAt.toISOString()} prevError=${a.callEnrichmentError ?? 'none'}`);
  });

  const results = await enrichCallActionsParallel(actions, '[sync-calls]');

  const enriched = results.filter((r) => r.status === 'enriched').length;
  const noMatch  = results.filter((r) => r.status === 'no_match').length;
  const noPhone  = results.filter((r) => r.status === 'no_phone').length;
  const errors   = results.filter((r) => r.status === 'error').length;

  console.log(`[sync-calls] done — enriched=${enriched} noMatch=${noMatch} noPhone=${noPhone} errors=${errors} total=${actions.length}`);

  return NextResponse.json({
    success: true,
    data: { total: actions.length, enriched, noMatch, noPhone, errors, results },
  });
}
