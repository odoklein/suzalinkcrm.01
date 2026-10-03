"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import {
    Building2,
    Search,
    Plus,
    Edit,
    Trash2,
    Loader2,
    MapPin,
    FileText,
} from "lucide-react";
import { Button, Input, Card, PageHeader, Badge } from "@/components/ui";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BillingClient {
    id: string;
    legalName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    siret?: string | null;
    vatNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    createdAt: string;
    _count?: {
        invoices: number;
    };
}

export default function BillingClientsPage() {
    const { success, error: showError } = useToast();
    const router = useRouter();
    const [clients, setClients] = useState<BillingClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) {
                params.set("search", searchQuery);
            }

            const res = await fetch(`/api/billing/clients?${params.toString()}`);
            const json = await res.json();

            if (json.success) {
                setClients(json.data);
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            console.error("Failed to fetch clients:", err);
            showError("Erreur", "Impossible de charger les clients");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (clientId: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
            return;
        }

        setIsDeleting(clientId);
        try {
            const res = await fetch(`/api/billing/clients/${clientId}`, {
                method: "DELETE",
            });

            const json = await res.json();

            if (json.success) {
                success("Client supprimé", "Le client a été supprimé avec succès");
                setClients(clients.filter((c) => c.id !== clientId));
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            console.error("Delete error:", err);
            showError("Erreur", "Impossible de supprimer le client");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchClients();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Clients de facturation"
                    subtitle="Gérez vos clients pour la facturation"
                />
                <Link href="/manager/billing/clients/new">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau client
                    </Button>
                </Link>
            </div>

            <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Rechercher par nom ou SIRET..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button type="submit" variant="secondary">
                    Rechercher
                </Button>
            </form>

            {isLoading ? (
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                </div>
            ) : clients.length === 0 ? (
                <Card className="p-12 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucun client</h3>
                    <p className="text-slate-600 mb-4">
                        Commencez par ajouter votre premier client de facturation
                    </p>
                    <Link href="/manager/billing/clients/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau client
                        </Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map((client) => (
                        <Card key={client.id} className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <Building2 className="w-5 h-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 line-clamp-1">
                                            {client.legalName}
                                        </h3>
                                        {client.siret && (
                                            <p className="text-xs text-slate-500">SIRET: {client.siret}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push(`/manager/billing/clients/${client.id}`)}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(client.id)}
                                        disabled={isDeleting === client.id}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        {isDeleting === client.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">
                                        {client.address}, {client.postalCode} {client.city}
                                    </span>
                                </div>
                                {client._count && (
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <span>{client._count.invoices} facture(s)</span>
                                    </div>
                                )}
                            </div>

                            {client.vatNumber && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <Badge variant="default">TVA: {client.vatNumber}</Badge>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
