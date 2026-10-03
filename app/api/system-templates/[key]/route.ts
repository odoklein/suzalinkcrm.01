import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from "@/lib/api-utils";
import { z } from "zod";
import { DEFAULT_RDV_TEMPLATE_HTML, DEFAULT_RDV_TEMPLATE_SUBJECT } from "@/lib/email/templates/rdv-notification";
import {
  DEFAULT_PASSWORD_RECOVERY_HTML,
  DEFAULT_PASSWORD_RECOVERY_SUBJECT,
  DEFAULT_PASSWORD_OTP_HTML,
  DEFAULT_PASSWORD_OTP_SUBJECT,
} from "@/lib/email/templates/security-auth";

const ALLOWED_KEYS = [
  "rdv_notification",
  "password_recovery",
  "password_otp",
] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

const DEFAULT_TEMPLATES: Record<AllowedKey, { name: string; subject: string; bodyHtml: string }> = {
  rdv_notification: {
    name: "Notification nouveau RDV",
    subject: DEFAULT_RDV_TEMPLATE_SUBJECT,
    bodyHtml: DEFAULT_RDV_TEMPLATE_HTML,
  },
  password_recovery: {
    name: "Recuperation mot de passe (lien)",
    subject: DEFAULT_PASSWORD_RECOVERY_SUBJECT,
    bodyHtml: DEFAULT_PASSWORD_RECOVERY_HTML,
  },
  password_otp: {
    name: "Code OTP recuperation mot de passe",
    subject: DEFAULT_PASSWORD_OTP_SUBJECT,
    bodyHtml: DEFAULT_PASSWORD_OTP_HTML,
  },
};

const updateTemplateSchema = z.object({
  subject: z.string().min(1, "Le sujet est requis"),
  bodyHtml: z.string().min(1, "Le contenu HTML est requis"),
});

// ============================================
// GET /api/system-templates/[key]
// Returns the current template (DB or default)
// ============================================

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) => {
  await requireRole(["MANAGER"], request);
  const { key } = await params;

  if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
    return errorResponse("Template inconnu", 404);
  }

  const defaults = DEFAULT_TEMPLATES[key as AllowedKey];

  const record = await (prisma as any).systemEmailTemplate.findUnique({
    where: { key },
  });

  return successResponse({
    key,
    name: defaults.name,
    subject: record?.subject ?? defaults.subject,
    bodyHtml: record?.bodyHtml ?? defaults.bodyHtml,
    isCustomized: !!record,
    defaultSubject: defaults.subject,
    defaultBodyHtml: defaults.bodyHtml,
  });
});

// ============================================
// PUT /api/system-templates/[key]
// Save a custom template to the DB
// ============================================

export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) => {
  await requireRole(["MANAGER"], request);
  const { key } = await params;

  if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
    return errorResponse("Template inconnu", 404);
  }

  const body = await request.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 400);
  }

  const { subject, bodyHtml } = parsed.data;
  const defaults = DEFAULT_TEMPLATES[key as AllowedKey];

  const record = await (prisma as any).systemEmailTemplate.upsert({
    where: { key },
    update: { subject, bodyHtml },
    create: { key, name: defaults.name, subject, bodyHtml },
  });

  return successResponse(record);
});

// ============================================
// DELETE /api/system-templates/[key]
// Reset to default (removes custom record)
// ============================================

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) => {
  await requireRole(["MANAGER"], request);
  const { key } = await params;

  if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
    return errorResponse("Template inconnu", 404);
  }

  await (prisma as any).systemEmailTemplate.deleteMany({ where: { key } });

  return successResponse({ reset: true });
});
