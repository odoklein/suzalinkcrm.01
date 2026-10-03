"use client";

import type { Channel } from "@/lib/types";
import { EmailProspectionPanel } from "./EmailProspectionPanel";
import { LinkedInProspectionPanel } from "./LinkedInProspectionPanel";

export interface ProspectionActionData {
    contactId: string | null;
    companyId: string;
    contact: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        linkedin?: string | null;
        status: string;
    } | null;
    company: {
        id: string;
        name: string;
        industry?: string | null;
        website?: string | null;
        country?: string | null;
        phone?: string | null;
    };
    campaignId: string;
    channel: string;
    missionName?: string;
    script?: string;
    clientBookingUrl?: string;
    lastAction?: { result: string; note?: string; createdAt: string } | null;
}

export interface ProspectionChannelWorkspaceProps {
    channel: Channel;
    role: "SDR" | "MANAGER";
    missionId?: string | null;
    listId?: string | null;
    /** For SDR: render custom CALL content (existing call UI). When channel is CALL and this is provided, this is rendered. */
    callContent?: React.ReactNode;
}

/**
 * Unified prospection workspace: switches layout by channel.
 * - CALL: renders callContent (existing call UI from page) or null.
 * - EMAIL: renders EmailProspectionPanel.
 * - LINKEDIN: renders LinkedInProspectionPanel.
 */
export function ProspectionChannelWorkspace({
    channel,
    role,
    missionId,
    listId,
    callContent,
}: ProspectionChannelWorkspaceProps) {
    if (channel === "CALL") {
        return <>{callContent ?? null}</>;
    }
    if (channel === "EMAIL") {
        return (
            <EmailProspectionPanel
                missionId={missionId}
                listId={listId}
            />
        );
    }
    if (channel === "LINKEDIN") {
        return (
            <LinkedInProspectionPanel
                missionId={missionId}
                listId={listId}
            />
        );
    }
    return null;
}
