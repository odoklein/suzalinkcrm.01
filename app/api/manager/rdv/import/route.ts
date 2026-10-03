import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionService } from "@/lib/services/ActionService";
import { requireRole, withErrorHandler } from "@/lib/api-utils";
import { parseRdvImportDate } from "@/lib/rdv-import-parse-date";

// ============================================
// RDV IMPORT – Create MEETING_BOOKED actions from CSV
// ============================================
// FormData: file (CSV), missionId, listId (optional), mappings (JSON).
// Mappings: { dateColumn, contactEmailColumn?, companyNameColumn?, meetingTypeColumn?, meetingCategoryColumn?, noteColumn?, meetingAddressColumn?, meetingJoinUrlColumn?, meetingPhoneColumn? }
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
type MeetingType = (typeof MEETING_TYPES)[number];
type MeetingCategory = (typeof MEETING_CATEGORIES)[number];

export interface RdvImportMappings {
    dateColumn: string;
    contactEmailColumn?: string;
    companyNameColumn?: string;
    meetingTypeColumn?: string;
    meetingCategoryColumn?: string;
    noteColumn?: string;
    meetingAddressColumn?: string;
    meetingJoinUrlColumn?: string;
    meetingPhoneColumn?: string;
}

type MissingEntityHandling = "skip" | "create_company" | "create_contact_and_company";

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["MANAGER"], request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const missionId = (formData.get("missionId") as string)?.trim();
    const listIdParam = (formData.get("listId") as string)?.trim() || null;
    const mappingsStr = (formData.get("mappings") as string)?.trim();
    const missingEntityHandlingRaw = ((formData.get("missingEntityHandling") as string) || "skip").trim();
    const createCampaignNow = String(formData.get("createCampaignNow") || "").trim().toLowerCase() === "true";
    const createListNow = String(formData.get("createListNow") || "").trim().toLowerCase() === "true";
    const listNameInput = String(formData.get("listName") || "").trim();
    const missingEntityHandling: MissingEntityHandling =
        missingEntityHandlingRaw === "create_company" || missingEntityHandlingRaw === "create_contact_and_company"
            ? missingEntityHandlingRaw
            : "skip";

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

    const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        select: {
            id: true,
            name: true,
            channel: true,
            campaigns: { where: { isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { id: true } },
            lists: { select: { id: true } },
        },
    });
    if (!mission) {
        return NextResponse.json({ success: false, error: "Mission non trouvée" }, { status: 404 });
    }
    let campaignId = mission.campaigns[0]?.id;
    if (!campaignId && createCampaignNow) {
        const safeCampaignName = mission.name;
        const createdCampaign = await prisma.campaign.create({
            data: {
                missionId: mission.id,
                name: safeCampaignName,
                isActive: true,
                icp: "",
                pitch: "",
            },
            select: { id: true },
        });
        campaignId = createdCampaign.id;
    }
    if (!campaignId) {
        return NextResponse.json(
            {
                success: false,
                error: "Aucune campagne active pour cette mission",
                code: "MISSING_ACTIVE_CAMPAIGN",
            },
            { status: 400 }
        );
    }
    const channel = (mission.channel as "CALL" | "EMAIL" | "LINKEDIN") || "CALL";
    let computedListIds = listIdParam
        ? [listIdParam]
        : mission.lists.map((l) => l.id);
    if (computedListIds.length === 0 && createListNow) {
        const safeListName = listNameInput || `Liste import RDV - ${new Date().toLocaleDateString("fr-FR")}`;
        const createdList = await prisma.list.create({
            data: {
                missionId: mission.id,
                name: safeListName,
                type: "CLIENT",
                source: "SAS_RDV_IMPORT",
            },
            select: { id: true },
        });
        computedListIds = [createdList.id];
    }
    const listIds = computedListIds;
    if (listIds.length === 0) {
        return NextResponse.json(
            {
                success: false,
                error: "La mission n'a aucune liste (ou liste fournie invalide)",
                code: "MISSION_HAS_NO_LIST",
            },
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
    const errors: { row: number; message: string }[] = [];
    let skippedInvalidDate = 0;
    let skippedMissingEntity = 0;
    let createdCompanies = 0;
    let createdContacts = 0;
    const fallbackListId = listIdParam || mission.lists[0]?.id || null;

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter).map((v) => v.replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, j) => {
            row[h] = values[j] ?? "";
        });
        const rowNum = i + 1;

        const dateRaw = getVal(row, mappings.dateColumn);
        const callbackDate = dateRaw ? parseRdvImportDate(dateRaw) : undefined;
        if (!callbackDate) {
            skippedInvalidDate++;
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
            if (missingEntityHandling === "skip") {
                skippedMissingEntity++;
                continue;
            }
            if (!fallbackListId) {
                skippedMissingEntity++;
                continue;
            }

            const defaultCompanyName = companyName
                || (contactEmail.includes("@") ? contactEmail.split("@")[1].split(".")[0] : "")
                || "Société importée";
            const normalizedCompanyName = defaultCompanyName.trim() || "Société importée";

            const existingCompany = await prisma.company.findFirst({
                where: {
                    listId: fallbackListId,
                    name: { equals: normalizedCompanyName, mode: "insensitive" },
                },
                select: { id: true },
            });

            if (existingCompany) {
                companyId = existingCompany.id;
            } else {
                const newCompany = await prisma.company.create({
                    data: {
                        listId: fallbackListId,
                        name: normalizedCompanyName,
                    },
                    select: { id: true },
                });
                companyId = newCompany.id;
                createdCompanies++;
            }
        }

        if (missingEntityHandling === "create_contact_and_company" && contactEmail && !contactId && companyId) {
            const existingContact = await prisma.contact.findFirst({
                where: {
                    companyId,
                    email: { equals: contactEmail, mode: "insensitive" },
                },
                select: { id: true },
            });
            if (existingContact) {
                contactId = existingContact.id;
            } else {
                const newContact = await prisma.contact.create({
                    data: {
                        companyId,
                        email: contactEmail,
                    },
                    select: { id: true },
                });
                contactId = newContact.id;
                createdContacts++;
            }
        }

        const meetingTypeRaw = getVal(row, mappings.meetingTypeColumn);
        const meetingType = (MEETING_TYPES as readonly string[]).includes(meetingTypeRaw)
            ? (meetingTypeRaw as MeetingType)
            : "VISIO";
        const meetingCategoryRaw = getVal(row, mappings.meetingCategoryColumn);
        const meetingCategory = (MEETING_CATEGORIES as readonly string[]).includes(meetingCategoryRaw)
            ? (meetingCategoryRaw as MeetingCategory)
            : undefined;
        const note = getVal(row, mappings.noteColumn) || undefined;
        const meetingAddress = getVal(row, mappings.meetingAddressColumn) || undefined;
        const meetingJoinUrl = getVal(row, mappings.meetingJoinUrlColumn) || undefined;
        const meetingPhone = getVal(row, mappings.meetingPhoneColumn) || undefined;

        try {
            await actionService.createAction(
                {
                    contactId: contactId ?? undefined,
                    companyId: companyId,
                    sdrId: session.user.id,
                    campaignId,
                    channel,
                    result: "MEETING_BOOKED",
                    callbackDate,
                    meetingType,
                    meetingCategory,
                    note,
                    meetingAddress,
                    meetingJoinUrl,
                    meetingPhone,
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
        data: {
            created,
            totalRows: lines.length - 1,
            errors,
            skippedInvalidDate,
            skippedMissingEntity,
            createdCompanies,
            createdContacts,
        },
    });
});
