import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),
});

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return Response.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const body = await request.json();
        const parsed = changePasswordSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.errors[0]?.message ?? "Données invalides";
            return Response.json({ success: false, error: msg }, { status: 400 });
        }

        const { currentPassword, newPassword } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, password: true },
        });

        if (!user) {
            return Response.json({ success: false, error: "Utilisateur non trouvé" }, { status: 404 });
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return Response.json(
                { success: false, error: "Mot de passe actuel incorrect" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        return Response.json({
            success: true,
            message: "Mot de passe modifié avec succès",
        });
    } catch (error) {
        console.error("Error changing password:", error);
        return Response.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
