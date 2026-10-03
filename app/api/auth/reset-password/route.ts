import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { recordAuthEvent } from "@/lib/auth-event";

const resetSchema = z.object({
  token: z.string().min(1, "Token requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent");

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Données invalides";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const { token, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Find all unexpired, unused tokens for this email
    const tokens = await prisma.passwordResetToken.findMany({
      where: {
        email: normalizedEmail,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (tokens.length === 0) {
      return Response.json(
        { success: false, error: "Ce lien a expiré ou a déjà été utilisé. Veuillez refaire une demande." },
        { status: 400 }
      );
    }

    // Check the raw token against each hashed token
    let matchedToken: (typeof tokens)[0] | null = null;
    for (const t of tokens) {
      const isMatch = await bcrypt.compare(token, t.token);
      if (isMatch) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      return Response.json(
        { success: false, error: "Lien de réinitialisation invalide. Veuillez refaire une demande." },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: normalizedEmail },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: matchedToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (user?.id) {
      recordAuthEvent({
        outcome: "SUCCESS",
        userId: user.id,
        ip,
        userAgent,
        eventTag: "PASSWORD_RECOVERY_SUCCESS",
      });
    }

    return Response.json({
      success: true,
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return Response.json(
      { success: false, error: "Erreur serveur. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
