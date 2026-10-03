// ============================================
// MESSAGE TEMPLATES API
// CRUD for reusable message templates
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getTemplates,
    createTemplate,
    deleteTemplate,
    incrementTemplateUsage,
    type CreateTemplateRequest,
} from "@/lib/comms/templates";

// GET - List templates (own + shared)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const templates = await getTemplates(session.user.id);
        return NextResponse.json(templates);
    } catch (error) {
        console.error("Error fetching templates:", error);
        return NextResponse.json(
            { error: "Failed to fetch templates" },
            { status: 500 }
        );
    }
}

// POST - Create a template
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.name || !body.content) {
            return NextResponse.json(
                { error: "Name and content are required" },
                { status: 400 }
            );
        }

        const data: CreateTemplateRequest = {
            name: body.name,
            category: body.category,
            content: body.content,
            variables: body.variables,
            isShared: body.isShared,
        };

        const template = await createTemplate(session.user.id, data);
        return NextResponse.json(template, { status: 201 });
    } catch (error) {
        console.error("Error creating template:", error);
        return NextResponse.json(
            { error: "Failed to create template" },
            { status: 500 }
        );
    }
}

// DELETE - Delete a template
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const templateId = searchParams.get("id");

        if (!templateId) {
            return NextResponse.json(
                { error: "Template ID is required" },
                { status: 400 }
            );
        }

        const deleted = await deleteTemplate(session.user.id, templateId);

        if (!deleted) {
            return NextResponse.json(
                { error: "Template not found or not authorized" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting template:", error);
        return NextResponse.json(
            { error: "Failed to delete template" },
            { status: 500 }
        );
    }
}

// PATCH - Increment usage (when template is used)
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.templateId) {
            return NextResponse.json(
                { error: "Template ID is required" },
                { status: 400 }
            );
        }

        await incrementTemplateUsage(body.templateId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating template usage:", error);
        return NextResponse.json(
            { error: "Failed to update template" },
            { status: 500 }
        );
    }
}
