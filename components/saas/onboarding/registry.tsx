"use client";

import type { ComponentType } from "react";
import type { OnboardingStepKey } from "@/lib/saas/onboarding-steps";
import type { AccountView, OnboardingState, StepComponentProps } from "./types";
import {
    CompanyStep,
    PhoneLineStep,
    ProfileStep,
    WorkspacesStep,
    companyDefaults,
    profileDefaults,
    workspacesDefaults,
} from "./SetupSteps";
import { CallOutcomesStep, ImportContactsStep, importDefaults, outcomesDefaults, type ImportDraft } from "./DataSteps";
import { CockpitStep, ExclusionsStep, TeamStep, cockpitDefaults, exclusionsDefaults, exclusionsPayload, teamDefaults, teamPayload } from "./TeamSteps";
import { ApiStep, ClientViewerStep, WhiteLabelStep, apiDefaults, clientViewerDefaults, clientViewerPayload, whiteLabelDefaults } from "./BrandSteps";
import { FirstCallStep, GoLiveStep, firstCallDefaults } from "./AdoptionSteps";

export interface StepUi {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Component: ComponentType<StepComponentProps<any>>;
    defaults: (state: OnboardingState, account: AccountView) => unknown;
    /** Draft → API payload (when they differ). */
    toPayload?: (draft: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any
    /** Whether the form has enough to try "complete" (the server still validates). */
    ready?: (draft: any, state: OnboardingState) => boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
    /** Restoring a saved draft on top of defaults is unsafe for this step: always start fresh. */
    freshOnEdit?: boolean;
    /** Label of the main button. */
    cta?: string;
}

export const STEP_UI: Record<OnboardingStepKey, StepUi> = {
    profile: { Component: ProfileStep, defaults: profileDefaults, ready: (d) => Boolean(d.jobRole) },
    company: {
        Component: CompanyStep,
        defaults: companyDefaults,
        ready: (d) => d.offer.trim().length >= 15 && d.targetIndustries.length > 0 && d.targetCompanySizes.length > 0 && Boolean(d.averageDealSize),
    },
    phone_line: {
        Component: PhoneLineStep,
        defaults: () => ({}),
        ready: (_d, s) => s.resources.phoneLines.some((l) => l.verifiedAt),
    },
    workspaces: { Component: WorkspacesStep, defaults: workspacesDefaults, ready: (d) => d.workspaces.every((w: { name: string }) => w.name.trim()) },
    import_contacts: {
        Component: ImportContactsStep,
        defaults: importDefaults,
        freshOnEdit: true,
        ready: (d: ImportDraft) => d.source === "demo" || (d.source === "file" && d.validCount > 0),
        toPayload: (d: ImportDraft) => (d.source === "file" ? { ...d, sample: d.sample.slice(0, 5) } : d),
        cta: "Importer",
    },
    call_outcomes: { Component: CallOutcomesStep, defaults: outcomesDefaults },
    team: {
        Component: TeamStep,
        defaults: teamDefaults,
        freshOnEdit: true,
        toPayload: teamPayload,
        ready: (d) => d.soloForNow || teamPayload(d).invites.length > 0,
        cta: "Envoyer les invitations",
    },
    exclusions: { Component: ExclusionsStep, defaults: exclusionsDefaults, toPayload: exclusionsPayload },
    manager_cockpit: { Component: CockpitStep, defaults: cockpitDefaults },
    white_label: { Component: WhiteLabelStep, defaults: whiteLabelDefaults, ready: (d) => Boolean(d.customDomain && d.brandName) },
    client_viewer: {
        Component: ClientViewerStep,
        defaults: clientViewerDefaults,
        freshOnEdit: true,
        toPayload: clientViewerPayload,
        ready: (d) => clientViewerPayload(d).invites.length > 0,
        cta: "Inviter",
    },
    api_webhooks: { Component: ApiStep, defaults: apiDefaults },
    first_call: {
        Component: FirstCallStep,
        defaults: firstCallDefaults,
        freshOnEdit: true,
        ready: (d) => Boolean(d.outcome),
        toPayload: (d) => ({ ...d, meetingAt: d.meetingAt || undefined }),
        cta: "Valider l'appel",
    },
    go_live: { Component: GoLiveStep, defaults: () => ({}), ready: (_d, s) => s.summary.canFinish, cta: "Lancer mon espace" },
};

/** Saved draft merged over defaults, so a partial or older draft never crashes a form. */
export function initialDraft(key: OnboardingStepKey, data: unknown, state: OnboardingState, account: AccountView, editingCompleted: boolean) {
    const ui = STEP_UI[key];
    const base = ui.defaults(state, account);
    if (!data || typeof data !== "object" || Array.isArray(data)) return base;
    if (editingCompleted && ui.freshOnEdit) return base;
    if (typeof base !== "object" || base === null) return base;
    return { ...(base as Record<string, unknown>), ...(data as Record<string, unknown>) };
}
