"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/components/ui";
import { ArrowLeft, Save, Loader2, Building2 } from "lucide-react";
import { Button, Input, Card, PageHeader } from "@/components/ui";
import Link from "next/link";

interface BillingClient {
    id?: string;
    legalName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    siret: string;
    vatNumber: string;
    email: string;
    phone: string;
}

export default function EditBillingClientPage() {
    const { success, error: showError } = useToast();
    const router = useRouter();
    const params = useParams();
    const clientId = params.id as string;
    const isNew = clientId === "new";

    const [isLoading, setIsLoading] = useState(!isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [client, setClient] = useState<BillingClient>({
        legalName: "",
        address: "",
        city: "",
        postalCode: "",
        country: "France",
        siret: "",
        vatNumber: "",
        email: "",
        phone: "",
    });

    useEffect(() => {
        if (!isNew) {
            fetchClient();
        }
    }, [clientId]);

    const fetchClient = async () => {
        try {
            const res = await fetch(`/api/billing/clients/${clientId}`);
            const json = await res.json();

            if (json.success) {
                setClient({
                    id: json.data.id,
                    legalName: json.data.legalName || "",
                    address: json.data.address || "",
                    city: json.data.city || "",
                    postalCode: json.data.postalCode || "",
                    country: json.data.country || "France",
                    siret: json.data.siret || "",
                    vatNumber: json.data.vatNumber || "",
                    email: json.data.email || "",
                    phone: json.data.phone || "",
                });
            } else {
                showError("Erreur", json.error);
                router.push("/manager/billing/clients");
            }
        } catch (err) {
            console.error("Failed to fetch client:", err);
            showError("Erreur", "Impossible de charger le client");
            router.push("/manager/billing/clients");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!client.legalName || !client.address || !client.city || !client.postalCode) {
            showError("Erreur", "Veuillez remplir tous les champs obligatoires");
            return;
        }

        setIsSaving(true);
        try {
            const url = isNew
                ? "/api/billing/clients"
                : `/api/billing/clients/${clientId}`;
            const method = isNew ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(client),
            });

            const json = await res.json();

            if (json.success) {
                success(
                    isNew ? "Client créé" : "Client modifié",
                    isNew ? "Le client a été créé avec succès" : "Le client a été modifié avec succès"
                );
                router.push("/manager/billing/clients");
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            console.error("Save error:", err);
            showError("Erreur", "Impossible de sauvegarder le client");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <Link href="/manager/billing/clients">
                    <Button variant="ghost" size="sm" className="mb-2">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour
                    </Button>
                </Link>
                <PageHeader
                    title={isNew ? "Nouveau client" : "Modifier le client"}
                    subtitle={isNew ? "Créez un nouveau client de facturation" : "Modifiez les informations du client"}
                />
            </div>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                    <div className="p-3 rounded-lg bg-slate-100">
                        <Building2 className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-900">Informations du client</h2>
                        <p className="text-sm text-slate-600">Les champs marqués * sont obligatoires</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nom légal *
                        </label>
                        <Input
                            value={client.legalName}
                            onChange={(e) => setClient({ ...client, legalName: e.target.value })}
                            placeholder="Nom de l'entreprise"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Adresse *
                        </label>
                        <Input
                            value={client.address}
                            onChange={(e) => setClient({ ...client, address: e.target.value })}
                            placeholder="Adresse complète"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Code postal *
                            </label>
                            <Input
                                value={client.postalCode}
                                onChange={(e) => setClient({ ...client, postalCode: e.target.value })}
                                placeholder="75001"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Ville *
                            </label>
                            <Input
                                value={client.city}
                                onChange={(e) => setClient({ ...client, city: e.target.value })}
                                placeholder="Paris"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Pays
                        </label>
                        <Input
                            value={client.country}
                            onChange={(e) => setClient({ ...client, country: e.target.value })}
                            placeholder="France"
                        />
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-4">
                        <h3 className="font-medium text-slate-900 mb-3">Informations fiscales</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    SIRET
                                </label>
                                <Input
                                    value={client.siret}
                                    onChange={(e) => setClient({ ...client, siret: e.target.value })}
                                    placeholder="12345678901234"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Numéro de TVA
                                </label>
                                <Input
                                    value={client.vatNumber}
                                    onChange={(e) => setClient({ ...client, vatNumber: e.target.value })}
                                    placeholder="FR12345678901"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-4">
                        <h3 className="font-medium text-slate-900 mb-3">Contact</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    value={client.email}
                                    onChange={(e) => setClient({ ...client, email: e.target.value })}
                                    placeholder="contact@entreprise.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Téléphone
                                </label>
                                <Input
                                    value={client.phone}
                                    onChange={(e) => setClient({ ...client, phone: e.target.value })}
                                    placeholder="+33 1 23 45 67 89"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-slate-200">
                    <Link href="/manager/billing/clients" className="flex-1">
                        <Button variant="secondary" className="w-full">
                            Annuler
                        </Button>
                    </Link>
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {isNew ? "Créer" : "Enregistrer"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
