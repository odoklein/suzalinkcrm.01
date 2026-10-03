"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, useToast } from "@/components/ui";
import { Linkedin, User, Building2, Loader2, ChevronRight } from "lucide-react";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { LINKEDIN_RESULT_CODES } from "@/lib/constants/actionStatusPresets";
import type { ProspectionActionData } from "./ProspectionChannelWorkspace";

interface LinkedInProspectionPanelProps {
    missionId?: string | null;
    listId?: string | null;
}

export function LinkedInProspectionPanel({ missionId, listId }: LinkedInProspectionPanelProps) {
    const { success, error: showError } = useToast();
    const [currentAction, setCurrentAction] = useState<ProspectionActionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [note, setNote] = useState("");

    const fetchNext = useCallback(async () => {
        setIsLoading(true);
        setNote("");
        try {
            const params = new URLSearchParams({ channel: "LINKEDIN" });
            if (missionId) params.set("missionId", missionId);
            if (listId) params.set("listId", listId);
            const res = await fetch(`/api/actions/next?${params.toString()}`);
            const json = await res.json();
            const n = json.data;
            if (json.success && json.hasNext && n) {
                setCurrentAction({
                    contactId: n.contact?.id ?? null,
                    companyId: n.company?.id,
                    contact: n.contact,
                    company: n.company,
                    campaignId: n.campaignId,
                    channel: "LINKEDIN",
                    missionName: n.missionName,
                    script: n.script,
                    clientBookingUrl: n.clientBookingUrl,
                    lastAction: n.lastAction,
                });
            } else {
                setCurrentAction(null);
            }
        } catch (err) {
            console.error(err);
            showError("Erreur", "Impossible de charger le prochain contact");
            setCurrentAction(null);
        } finally {
            setIsLoading(false);
        }
    }, [missionId, listId, showError]);

    useEffect(() => {
        fetchNext();
    }, [fetchNext]);

    const logAction = useCallback(async (result: string) => {
        if (!currentAction) return;
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: currentAction.contactId,
                    companyId: currentAction.companyId,
                    campaignId: currentAction.campaignId,
                    channel: "LINKEDIN",
                    result,
                    note: note.trim() || undefined,
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Action enregistrée", "Passons au contact suivant.");
                fetchNext();
            } else {
                showError("Erreur", json.error || "Impossible d'enregistrer l'action");
            }
        } catch (err) {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsSubmitting(false);
        }
    }, [currentAction, note, fetchNext, success, showError]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="w-10 h-10 text-sky-500 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Chargement du prochain contact...</p>
            </div>
        );
    }

    if (!currentAction) {
        return (
            <Card className="text-center py-16 border border-slate-200 rounded-2xl">
                <Linkedin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Aucun contact LinkedIn à traiter</h3>
                <p className="text-slate-500 mt-1">Tous les contacts de la file ont été traités ou la file est vide.</p>
            </Card>
        );
    }

    const contact = currentAction.contact;
    const company = currentAction.company;
    const displayName = contact
        ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || company?.name
        : company?.name;
    const linkedinUrl = contact?.linkedin
        ? (contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`)
        : null;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6 border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                        <User className="w-6 h-6 text-sky-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{displayName}</h2>
                        {company?.name && (
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                <Building2 className="w-4 h-4" />
                                {company.name}
                            </p>
                        )}
                    </div>
                </div>

                {linkedinUrl && (
                    <a
                        href={linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 h-11 w-full text-sm font-medium text-white bg-[#0A66C2] hover:bg-[#004182] rounded-xl transition-colors mb-4"
                    >
                        <Linkedin className="w-5 h-5" />
                        Ouvrir le profil LinkedIn
                    </a>
                )}

                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loguer une action</p>
                    <div className="grid grid-cols-2 gap-2">
                        {LINKEDIN_RESULT_CODES.map((code) => (
                            <Button
                                key={code}
                                variant="outline"
                                onClick={() => logAction(code)}
                                disabled={isSubmitting}
                                className="justify-center"
                            >
                                {ACTION_RESULT_LABELS[code] ?? code}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note (optionnel)</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ajouter une note..."
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                    />
                </div>

                <Button
                    variant="ghost"
                    onClick={fetchNext}
                    disabled={isSubmitting}
                    className="mt-4 gap-2 text-slate-600"
                >
                    <ChevronRight className="w-4 h-4" />
                    Passer au suivant
                </Button>
            </Card>
        </div>
    );
}
