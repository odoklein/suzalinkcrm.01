// ============================================
// BROADCAST EMAILS API
// GET  /api/manager/broadcast-emails  — history (paginated)
// POST /api/manager/broadcast-emails  — send a broadcast campaign
// ============================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from "@/lib/api-utils";
import { sendTransactionalEmail } from "@/lib/email/transactional";

// ── Validation ────────────────────────────────────────────────────────────────

const sendBroadcastSchema = z.object({
  subject: z.string().trim().min(1, "L'objet est requis").max(500),
  bodyHtml: z.string().trim().min(1, "Le contenu HTML est requis"),
  audienceType: z.enum(["ALL_CLIENTS", "ALL_COMMERCIALS", "INTERNAL_TEAM", "SELECTION"]),
  // Required only when audienceType === "SELECTION"
  recipientIds: z.array(z.string()).optional(),
});

// ── GET — History ─────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.broadcastEmail.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sentBy: { select: { id: true, name: true, email: true } },
        recipients: {
          select: {
            id: true,
            email: true,
            name: true,
            wasSent: true,
            openedAt: true,
            openCount: true,
            lastOpenedAt: true,
          },
          orderBy: { email: "asc" },
        },
      },
    }),
    prisma.broadcastEmail.count(),
  ]);

  return successResponse({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// ── POST — Send broadcast ─────────────────────────────────────────────────────

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(["MANAGER"], request);

  const body = await request.json();
  const parsed = sendBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 400);
  }

  const { subject, bodyHtml, audienceType, recipientIds } = parsed.data;

  // ── Resolve recipients ──────────────────────────────────────────────────────
  let recipients: { email: string; name: string }[] = [];

  if (audienceType === "ALL_CLIENTS") {
    const users = await prisma.user.findMany({
      where: { role: "CLIENT", isActive: true, email: { not: "" } },
      select: { email: true, name: true },
    });
    recipients = users.map((u) => ({ email: u.email, name: u.name }));
  } else if (audienceType === "ALL_COMMERCIALS") {
    const users = await prisma.user.findMany({
      where: { role: "COMMERCIAL", isActive: true, email: { not: "" } },
      select: { email: true, name: true },
    });
    recipients = users.map((u) => ({ email: u.email, name: u.name }));
  } else if (audienceType === "INTERNAL_TEAM") {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        email: { not: "" },
        role: { in: ["MANAGER", "SDR", "BOOKER", "DEVELOPER", "BUSINESS_DEVELOPER"] },
      },
      select: { email: true, name: true },
    });
    recipients = users.map((u) => ({ email: u.email, name: u.name }));
  } else {
    // SELECTION
    if (!recipientIds || recipientIds.length === 0) {
      return errorResponse("Sélectionnez au moins un destinataire", 400);
    }
    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds }, isActive: true, email: { not: "" } },
      select: { email: true, name: true },
    });
    recipients = users.map((u) => ({ email: u.email, name: u.name }));
  }

  if (recipients.length === 0) {
    return errorResponse("Aucun destinataire valide trouvé pour cette audience", 400);
  }

  // ── Create record in DB ────────────────────────────────────────────────────
  const broadcast = await prisma.broadcastEmail.create({
    data: {
      subject,
      bodyHtml,
      audienceType,
      recipientEmails: recipients,
      recipientCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      status: "SENDING",
      sentById: session.user.id,
      recipients: {
        create: recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
        })),
      },
    },
    include: {
      recipients: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  // ── Send emails ────────────────────────────────────────────────────────────
  let sentCount = 0;
  let failedCount = 0;

  const appBaseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const recipientsByEmail = new Map(
    broadcast.recipients.map((recipient) => [recipient.email.toLowerCase(), recipient])
  );

  for (const recipient of recipients) {
    const dbRecipient = recipientsByEmail.get(recipient.email.toLowerCase());
    const trackingPixel = dbRecipient
      ? `<img src="${appBaseUrl}/api/broadcast-open?id=${dbRecipient.id}" width="1" height="1" alt="" style="display:none;" />`
      : "";
    const htmlWithTrackingPixel = `${bodyHtml}${trackingPixel}`;

    const ok = await sendTransactionalEmail({
      to: recipient.email,
      subject,
      html: htmlWithTrackingPixel,
    });

    if (dbRecipient) {
      await prisma.broadcastEmailRecipient.update({
        where: { id: dbRecipient.id },
        data: {
          wasSent: ok,
          sendError: ok ? null : "Envoi SMTP échoué",
        },
      });
    }

    if (ok) {
      sentCount++;
    } else {
      failedCount++;
    }
  }

  const finalStatus =
    sentCount === 0
      ? "FAILED"
      : failedCount === 0
      ? "SENT"
      : "PARTIAL";

  const updated = await prisma.broadcastEmail.update({
    where: { id: broadcast.id },
    data: {
      status: finalStatus,
      sentCount,
      failedCount,
      sentAt: new Date(),
    },
    include: {
      sentBy: { select: { id: true, name: true, email: true } },
      recipients: {
        select: {
          id: true,
          email: true,
          name: true,
          wasSent: true,
          openedAt: true,
          openCount: true,
          lastOpenedAt: true,
        },
        orderBy: { email: "asc" },
      },
    },
  });

  return successResponse(updated, 201);
});
