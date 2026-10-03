import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionService } from "@/lib/services/ActionService";
import { parseRdvImportDate } from "@/lib/rdv-import-parse-date";

// ============================================
// SDR RDV IMPORT – Create MEETING_BOOKED actions from CSV/XLSX
// ============================================
// FormData: file (CSV/XLSX), missionId, listId (optional), mappings (JSON).
// Mappings: { dateColumn, statusColumn?, contactEmailColumn?, companyNameColumn?, firstNameColumn?, lastNameColumn?, 
//             meetingTypeColumn?, meetingCategoryColumn?, noteColumn?, meetingAddressColumn?, meetingJoinUrlColumn?, 
//             meetingPhoneColumn?, campaignColumn?, mobileColumn?, functionColumn? }
// Only creates RDV actions; contact/company must exist in mission lists.
// ============================================

function parseCSVLine(line: string, delimiter: string = ","): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function detectDelimiter(firstLine: string): string {
    const delimiters = [",", ";", "\t", "|"];
    let maxCount = 0;
    let detected = ",";
    for (const d of delimiters) {
        const count = (firstLine.match(new RegExp(`\\${d}`, "g")) || []).length;
        if (count > maxCount) {
            maxCount = count;
            detected = d;
        }
    }
    return detected;
}

const MEETING_TYPES = ["VISIO", "PHYSIQUE", "TELEPHONIQUE"] as const;
const MEETING_CATEGORIES = ["EXPLORATOIRE", "BESOIN"] as const;
const MEETING_STATUSES = ["Planifié", "Réalisé", "Absent", "Annulé", "Replanifié par l'équipe"] as const;

export interface RdvImportMappings {
    dateColumn: string;
    statusColumn?: string;
    contactEmailColumn?: string;
    companyNameColumn?: string;
    firstNameColumn?: string;
    lastNameColumn?: string;
    meetingTypeColumn?: string;
    meetingCategoryColumn?: string;
    noteColumn?: string;
    meetingAddressColumn?: string;
    meetingJoinUrlColumn?: string;
    meetingPhoneColumn?: string;
    campaignColumn?: string;
    mobileColumn?: string;
    functionColumn?: string;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        // Check if user is SDR
        if (session.user.role !== "SDR") {
            return NextResponse.json(
                { success: false, error: "Accès réservé aux SDR" },
                { status: 403 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const missionId = (formData.get("missionId") as string)?.trim();
        const listIdParam = (formData.get("listId") as string)?.trim() || null;
        const mappingsStr = (formData.get("mappings") as string)?.trim();

        if (!file || !missionId || !mappingsStr) {
            return NextResponse.json(
                { success: false, error: "Fichier, mission et mappings requis" },
                { status: 400 }
            );
        }

        let mappings: RdvImportMappings;
        try {
            mappings = JSON.parse(mappingsStr) as RdvImportMappings;
        } catch {
            return NextResponse.json(
                { success: false, error: "mappings invalide (JSON attendu)" },
                { status: 400 }
            );
        }
        if (!mappings.dateColumn) {
            return NextResponse.json(
                { success: false, error: "La colonne date est obligatoire" },
                { status: 400 }
            );
        }
        if (!mappings.contactEmailColumn && !mappings.companyNameColumn) {
            return NextResponse.json(
                { success: false, error: "Indiquez une colonne email contact ou nom de société" },
                { status: 400 }
            );
        }

        // Verify mission exists and SDR has access to it
        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
            select: {
                id: true,
                channel: true,
                campaigns: { where: { isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { id: true } },
                lists: { select: { id: true } },
            },
        });
        if (!mission) {
            return NextResponse.json({ success: false, error: "Mission non trouvée" }, { status: 404 });
        }
        
        const campaignId = mission.campaigns[0]?.id;
        if (!campaignId) {
            return NextResponse.json(
                { success: false, error: "Aucune campagne active pour cette mission" },
                { status: 400 }
            );
        }
        
        const channel = (mission.channel as "CALL" | "EMAIL" | "LINKEDIN") || "CALL";
        const listIds = listIdParam
            ? [listIdParam]
            : mission.lists.map((l) => l.id);
        if (listIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "La mission n'a aucune liste (ou liste fournie invalide)" },
                { status: 400 }
            );
        }

        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
            return NextResponse.json(
                { success: false, error: "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données" },
                { status: 400 }
            );
        }
        const delimiter = detectDelimiter(lines[0]);
        const headers = parseCSVLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, ""));

        const getVal = (row: Record<string, string>, col: string | undefined): string =>
            (col && row[col] !== undefined ? row[col] : "").trim();

        let created = 0;
        let skipped = 0;
        const errors: { row: number; message: string }[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i], delimiter).map((v) => v.replace(/^"|"$/g, ""));
            const row: Record<string, string> = {};
            headers.forEach((h, j) => {
                row[h] = values[j] ?? "";
            });
            const rowNum = i + 1;

            // Check status if mapped - skip cancelled/no-show meetings based on status
            const statusRaw = mappings.statusColumn ? getVal(row, mappings.statusColumn) : "";
            const normalizedStatus = statusRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            // Skip rows with certain statuses (Annulé/Absent may be handled differently)
            // We'll still import them but mark them appropriately
            const isCancelled = /annul|cancel/.test(normalizedStatus);
            const isNoShow = /absent|no.show/.test(normalizedStatus);
            const isCompleted = /realis|done|complete/.test(normalizedStatus);

            const dateRaw = getVal(row, mappings.dateColumn);
            const callbackDate = dateRaw ? parseRdvImportDate(dateRaw) : undefined;
            if (!callbackDate) {
                errors.push({ row: rowNum, message: "Date invalide ou manquante" });
                continue;
            }

            const contactEmail = mappings.contactEmailColumn
                ? getVal(row, mappings.contactEmailColumn).toLowerCase()
                : "";
            const companyName = mappings.companyNameColumn
                ? getVal(row, mappings.companyNameColumn).replace(/\s+/g, " ").trim()
                : "";

            let contactId: string | null = null;
            let companyId: string | null = null;

            // Try to find contact by email
            if (contactEmail) {
                const contact = await prisma.contact.findFirst({
                    where: {
                        email: { equals: contactEmail, mode: "insensitive" },
                        company: { listId: { in: listIds } },
                    },
                    select: { id: true, companyId: true },
                });
                if (contact) {
                    contactId = contact.id;
                    companyId = contact.companyId;
                }
            }
            
            // Fallback to company name search
            if (!companyId && companyName) {
                const company = await prisma.company.findFirst({
                    where: {
                        listId: { in: listIds },
                        name: { equals: companyName, mode: "insensitive" },
                    },
                    select: { id: true },
                });
                if (company) companyId = company.id;
            }

            if (!companyId) {
                errors.push({
                    row: rowNum,
                    message: contactEmail
                        ? `Contact ou société non trouvé (email: ${contactEmail}, société: ${companyName || "—"})`
                        : `Société non trouvée (nom: ${companyName || "—"})`,
                });
                continue;
            }

            // Determine meeting type from location URL or explicit column
            let meetingType: "VISIO" | "PHYSIQUE" | "TELEPHONIQUE" = "VISIO";
            const meetingTypeRaw = getVal(row, mappings.meetingTypeColumn);
            const joinUrlRaw = mappings.meetingJoinUrlColumn ? getVal(row, mappings.meetingJoinUrlColumn) : "";
            
            if (MEETING_TYPES.includes(meetingTypeRaw as any)) {
                meetingType = meetingTypeRaw as "VISIO" | "PHYSIQUE" | "TELEPHONIQUE";
            } else if (joinUrlRaw) {
                // If there's a URL with meet.google.com, zoom, teams, etc., it's VISIO
                if (/meet\.google|zoom\.us|teams\.microsoft|webex|cal\.com/i.test(joinUrlRaw)) {
                    meetingType = "VISIO";
                } else if (/^https?:\/\//.test(joinUrlRaw)) {
                    meetingType = "VISIO";
                }
            }

            // Infer from address presence
            const addressRaw = mappings.meetingAddressColumn ? getVal(row, mappings.meetingAddressColumn) : "";
            if (addressRaw && !joinUrlRaw && meetingType === "VISIO") {
                meetingType = "PHYSIQUE";
            }

            const meetingCategoryRaw = getVal(row, mappings.meetingCategoryColumn);
            const meetingCategory = MEETING_CATEGORIES.includes(meetingCategoryRaw as any)
                ? (meetingCategoryRaw as "EXPLORATOIRE" | "BESOIN")
                : undefined;

            // Build note from available columns
            const noteParts: string[] = [];
            if (mappings.noteColumn) {
                const noteVal = getVal(row, mappings.noteColumn);
                if (noteVal) noteParts.push(noteVal);
            }
            if (mappings.campaignColumn) {
                const campaignVal = getVal(row, mappings.campaignColumn);
                if (campaignVal) noteParts.push(`Campagne: ${campaignVal}`);
            }
            if (mappings.functionColumn) {
                const functionVal = getVal(row, mappings.functionColumn);
                if (functionVal) noteParts.push(`Fonction: ${functionVal}`);
            }
            if (mappings.mobileColumn) {
                const mobileVal = getVal(row, mappings.mobileColumn);
                if (mobileVal) noteParts.push(`Mobile: ${mobileVal}`);
            }
            if (statusRaw && statusRaw !== "Planifié") {
                noteParts.push(`Statut importé: ${statusRaw}`);
            }
            
            const note = noteParts.length > 0 ? noteParts.join(" | ") : undefined;
            
            const meetingAddress = addressRaw || undefined;
            const meetingJoinUrl = joinUrlRaw || undefined;
            const meetingPhone = mappings.meetingPhoneColumn ? getVal(row, mappings.meetingPhoneColumn) || undefined : undefined;

            try {
                await actionService.createAction(
                    {
                        contactId: contactId ?? undefined,
                        companyId: companyId,
                        sdrId: session.user.id,
                        campaignId,
                        channel,
                        result: isCancelled ? "MEETING_CANCELLED" : "MEETING_BOOKED",
                        callbackDate,
                        meetingType,
                        meetingCategory,
                        note,
                        meetingAddress,
                        meetingJoinUrl,
                        meetingPhone,
                        cancellationReason: isCancelled ? "Importé comme annulé" : undefined,
                    },
                    null
                );
                created++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Erreur création action";
                errors.push({ row: rowNum, message: msg });
            }
        }

        return NextResponse.json({
            success: true,
            data: { created, skipped, totalRows: lines.length - 1, errors },
        });
    } catch (error) {
        console.error("Error importing SDR meetings:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
