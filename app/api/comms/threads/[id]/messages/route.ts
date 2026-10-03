// ============================================
// API: /api/comms/threads/[id]/messages
// Add, edit, and delete messages in a thread
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addMessage, addAttachmentsToMessage, editMessage, deleteMessage } from "@/lib/comms/service";
import {
    publishMessageCreated,
    publishMessageUpdated,
    publishMessageDeleted,
} from "@/lib/comms/realtime";
import type { CreateMessageRequest } from "@/lib/comms/types";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/comms/threads/[id]/messages - Add a message (JSON or FormData with files)
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id: threadId } = await params;
        const contentType = request.headers.get("content-type") ?? "";
        let content: string;
        let mentionIds: string[] | undefined;
        let files: File[] = [];

        if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            const c = form.get("content");
            content = typeof c === "string" ? c.trim() : "";
            const m = form.get("mentionIds");
            if (typeof m === "string" && m) {
                try {
                    mentionIds = JSON.parse(m) as string[];
                } catch {
                    mentionIds = undefined;
                }
            }
            const fs = form.getAll("files").filter((f): f is File => f instanceof File);
            files = fs;
        } else {
            const body = await request.json();
            content = body.content?.trim() ?? "";
            mentionIds = body.mentionIds;
        }

        if (!content && files.length === 0) {
            return NextResponse.json(
                { error: "Le contenu du message ou au moins un fichier est requis" },
                { status: 400 }
            );
        }
        if (!content) {
            content = "[Pièces jointes]";
        }

        const messageRequest: CreateMessageRequest = {
            threadId,
            content,
            mentionIds,
        };

        const messageId = await addMessage(messageRequest, session.user.id);

        if (files.length > 0) {
            const bufs = await Promise.all(
                files.map(async (f) => ({
                    buffer: Buffer.from(await f.arrayBuffer()),
                    filename: f.name,
                    mimeType: f.type || "application/octet-stream",
                    size: f.size,
                }))
            );
            await addAttachmentsToMessage(messageId, bufs, session.user.id);
        }

        const msg = await prisma.commsMessage.findUnique({
            where: { id: messageId },
            select: { createdAt: true },
        });
        const createdAtIso = msg?.createdAt.toISOString() ?? new Date().toISOString();
        if (msg) {
            await publishMessageCreated(
                threadId,
                messageId,
                session.user.id,
                session.user.name ?? "Utilisateur",
                content,
                createdAtIso
            );
        }

        return NextResponse.json({ id: messageId, createdAt: createdAtIso }, { status: 201 });
    } catch (error) {
        console.error("Error adding message:", error);
        const message = error instanceof Error ? error.message : "Erreur lors de l'envoi";
        const isForbidden = message.includes("participant") || message.includes("autorisé");
        return NextResponse.json(
            { error: message },
            { status: isForbidden ? 403 : 500 }
        );
    }
}

// PATCH /api/comms/threads/[id]/messages - Edit a message
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.messageId || !body.content) {
            return NextResponse.json(
                { error: "messageId et content sont requis" },
                { status: 400 }
            );
        }

        const existing = await prisma.commsMessage.findUnique({
            where: { id: body.messageId },
            select: { threadId: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Message non trouvé" }, { status: 404 });
        }

        await editMessage(body.messageId, body.content.trim(), session.user.id);
        await publishMessageUpdated(
            existing.threadId,
            body.messageId,
            body.content.trim()
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error editing message:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la modification" },
            { status: 500 }
        );
    }
}

// DELETE /api/comms/threads/[id]/messages - Delete a message
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.messageId) {
            return NextResponse.json(
                { error: "messageId est requis" },
                { status: 400 }
            );
        }

        const existing = await prisma.commsMessage.findUnique({
            where: { id: body.messageId },
            select: { threadId: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Message non trouvé" }, { status: 404 });
        }

        const isManager = session.user.role === "MANAGER";
        await deleteMessage(body.messageId, session.user.id, isManager);
        await publishMessageDeleted(existing.threadId, body.messageId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting message:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la suppression" },
            { status: 500 }
        );
    }
}
