import type { OnboardingPhase, OnboardingStepKey, StepStatus } from "@/lib/saas/onboarding-steps";

/** Client view of loadOnboardingState() after JSON (dates are ISO strings). */
export interface OnboardingStepView {
    key: OnboardingStepKey;
    title: string;
    summary: string;
    why: string;
    phase: OnboardingPhase;
    required: boolean;
    minutes: number;
    adminOnly: boolean;
    status: StepStatus;
    data: unknown;
    completedAt: string | null;
}

export interface OnboardingState {
    steps: OnboardingStepView[];
    summary: {
        total: number;
        done: number;
        percent: number;
        requiredRemaining: OnboardingStepKey[];
        nextStep: OnboardingStepKey | null;
        canFinish: boolean;
    };
    completedAt: string | null;
    resources: {
        workspaces: { id: string; name: string; description: string | null; color: string | null }[];
        phoneLines: {
            id: string;
            provider: "ALLO" | "ONOFF";
            phoneNumber: string;
            label: string | null;
            webhookUrl: string;
            verifiedAt: string | null;
            lastEventAt: string | null;
        }[];
        members: { id: string; email: string; name: string; role: string; status: string; inviteExpiresAt: string | null }[];
        imports: { id: string; fileName: string; rowCount: number; validCount: number; duplicateCount: number; createdAt: string }[];
        apiKeys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[];
    };
    usage: { seats: number; workspaces: number; phoneLines: number; contacts: number };
    quotas: {
        seats: number;
        workspaces: number | null;
        phoneLines: number | null;
        contacts: number;
        aiFichesPerMonth: number;
        includedSeats: number;
        maxSeats: number | null;
        callVaultHours: number;
        storageGb: number;
    };
    whiteLabel: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
}

export interface AccountView {
    name: string;
    planCode: string;
    planName: string;
    status: string;
    memberName: string;
    memberEmail: string;
    isAdmin: boolean;
}

export interface StepComponentProps<T> {
    value: T;
    onChange: (next: T) => void;
    state: OnboardingState;
    account: AccountView;
    refresh: () => Promise<void>;
    /** Result of the last "complete" (invite links, generated fiche…). */
    result: Record<string, unknown> | null;
    disabled: boolean;
}
