/**
 * E-Reporting Service - EU 2026 Future-Proofing
 * Handles transaction type classification and PDP/PPF integration preparation
 * 
 * France's e-invoicing mandate (September 2026):
 * - B2B domestic: transmitted via PDP or PPF (e-invoicing)
 * - B2C, intra-EU, export: reported via PDP or PPF (e-reporting)
 * 
 * This service prepares the data model for future PDP integration.
 */

import { prisma } from "@/lib/prisma";

type TransactionType =
    | "B2B_DOMESTIC"
    | "B2B_INTRA_EU"
    | "B2B_EXPORT"
    | "B2C_DOMESTIC"
    | "B2C_INTRA_EU"
    | "B2C_EXPORT";

// EU member state ISO 3166-1 alpha-2 codes
const EU_COUNTRIES = new Set([
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const COUNTRY_NAME_MAP: Record<string, string> = {
    france: "FR", allemagne: "DE", belgique: "BE", luxembourg: "LU",
    suisse: "CH", espagne: "ES", italie: "IT", "pays-bas": "NL",
    "royaume-uni": "GB", portugal: "PT", autriche: "AT", irlande: "IE",
    pologne: "PL", grece: "GR", "republique tcheque": "CZ",
    danemark: "DK", finlande: "FI", suede: "SE", hongrie: "HU",
    roumanie: "RO", bulgarie: "BG", croatie: "HR", slovaquie: "SK",
    slovenie: "SI", estonie: "EE", lettonie: "LV", lituanie: "LT",
    malte: "MT", chypre: "CY",
};

export class EReportingService {
    /**
     * Get ISO 3166-1 alpha-2 country code from country name or code
     */
    private getCountryCode(country: string): string {
        if (country.length === 2) return country.toUpperCase();
        return COUNTRY_NAME_MAP[country.toLowerCase()] || "FR";
    }

    /**
     * Classify transaction type based on issuer and client countries
     * and whether the client has a VAT number (B2B vs B2C indicator)
     */
    classifyTransaction(
        issuerCountry: string,
        clientCountry: string,
        clientHasVatNumber: boolean
    ): TransactionType {
        const issuerCode = this.getCountryCode(issuerCountry);
        const clientCode = this.getCountryCode(clientCountry);

        const isB2B = clientHasVatNumber;
        const isDomestic = issuerCode === clientCode && issuerCode === "FR";
        const isIntraEU = !isDomestic && EU_COUNTRIES.has(clientCode);
        const isExport = !isDomestic && !isIntraEU;

        if (isB2B) {
            if (isDomestic) return "B2B_DOMESTIC";
            if (isIntraEU) return "B2B_INTRA_EU";
            return "B2B_EXPORT";
        } else {
            if (isDomestic) return "B2C_DOMESTIC";
            if (isIntraEU) return "B2C_INTRA_EU";
            return "B2C_EXPORT";
        }
    }

    /**
     * Auto-classify an invoice's transaction type based on its data
     */
    async classifyInvoice(invoiceId: string): Promise<TransactionType> {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                billingClient: true,
                companyIssuer: true,
            },
        });

        if (!invoice) throw new Error("Invoice not found");

        const transactionType = this.classifyTransaction(
            invoice.companyIssuer.country,
            invoice.billingClient.country,
            !!invoice.billingClient.vatNumber
        );

        // Update the invoice
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { transactionType },
        });

        return transactionType;
    }

    /**
     * Determine if an invoice requires e-invoicing (PDP/PPF) or e-reporting
     */
    getComplianceRequirement(transactionType: TransactionType): {
        method: "e-invoicing" | "e-reporting";
        description: string;
        platform: string;
    } {
        switch (transactionType) {
            case "B2B_DOMESTIC":
                return {
                    method: "e-invoicing",
                    description: "Facture B2B domestique - transmission obligatoire via PDP ou PPF",
                    platform: "PDP (Plateforme de Dématérialisation Partenaire) ou PPF (Portail Public de Facturation)",
                };
            case "B2B_INTRA_EU":
                return {
                    method: "e-reporting",
                    description: "Transaction B2B intra-UE - e-reporting obligatoire",
                    platform: "PDP ou PPF (déclaration)",
                };
            case "B2B_EXPORT":
                return {
                    method: "e-reporting",
                    description: "Transaction B2B export hors UE - e-reporting obligatoire",
                    platform: "PDP ou PPF (déclaration)",
                };
            case "B2C_DOMESTIC":
                return {
                    method: "e-reporting",
                    description: "Transaction B2C domestique - e-reporting obligatoire",
                    platform: "PDP ou PPF (déclaration)",
                };
            case "B2C_INTRA_EU":
                return {
                    method: "e-reporting",
                    description: "Transaction B2C intra-UE - e-reporting obligatoire",
                    platform: "PDP ou PPF (déclaration)",
                };
            case "B2C_EXPORT":
                return {
                    method: "e-reporting",
                    description: "Transaction B2C export hors UE - e-reporting obligatoire",
                    platform: "PDP ou PPF (déclaration)",
                };
        }
    }

    /**
     * Get e-reporting status summary
     */
    async getEReportingStatus() {
        const [byTransactionType, byPdpStatus] = await Promise.all([
            prisma.invoice.groupBy({
                by: ["transactionType"],
                _count: true,
                where: {
                    status: { notIn: ["DRAFT", "CANCELLED"] },
                },
            }),
            prisma.invoice.groupBy({
                by: ["pdpSubmissionStatus"],
                _count: true,
                where: {
                    status: { notIn: ["DRAFT", "CANCELLED"] },
                },
            }),
        ]);

        return {
            byTransactionType: byTransactionType.map((item) => ({
                type: item.transactionType,
                count: item._count,
                requirement: this.getComplianceRequirement(item.transactionType as TransactionType),
            })),
            byPdpStatus: byPdpStatus.reduce((acc, item) => {
                acc[item.pdpSubmissionStatus] = item._count;
                return acc;
            }, {} as Record<string, number>),
        };
    }

    /**
     * Prepare invoice data for PDP submission
     * This returns the data structure that would be sent to a PDP
     */
    async prepareForPdpSubmission(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: { orderBy: { order: "asc" } },
            },
        });

        if (!invoice) throw new Error("Invoice not found");
        if (invoice.status === "DRAFT") throw new Error("Cannot submit draft invoice to PDP");

        return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            documentType: invoice.documentType,
            transactionType: invoice.transactionType,
            issuer: {
                siret: invoice.companyIssuer.siret,
                vatNumber: invoice.companyIssuer.vatNumber,
                legalName: invoice.companyIssuer.legalName,
                country: invoice.companyIssuer.country,
            },
            client: {
                siret: invoice.billingClient.siret,
                vatNumber: invoice.billingClient.vatNumber,
                legalName: invoice.billingClient.legalName,
                country: invoice.billingClient.country,
            },
            amounts: {
                totalHt: Number(invoice.totalHt),
                totalVat: Number(invoice.totalVat),
                totalTtc: Number(invoice.totalTtc),
                currency: (invoice as any).currency || "EUR",
            },
            dates: {
                issueDate: invoice.issueDate.toISOString(),
                dueDate: invoice.dueDate.toISOString(),
            },
            facturxPdfUrl: invoice.facturxPdfUrl,
            // PDP-specific fields would be added when integrating with a specific PDP
            _meta: {
                preparedAt: new Date().toISOString(),
                complianceRequirement: this.getComplianceRequirement(
                    invoice.transactionType as TransactionType
                ),
            },
        };
    }

    /**
     * Simulate PDP submission (for future integration)
     * In production, this would call the actual PDP API
     */
    async simulatePdpSubmission(invoiceId: string, userId: string) {
        const preparedData = await this.prepareForPdpSubmission(invoiceId);

        // Update status to PENDING
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                pdpSubmissionStatus: "PENDING",
                pdpSubmittedAt: new Date(),
                pdpResponseData: {
                    simulatedSubmission: true,
                    preparedData: preparedData._meta,
                    note: "PDP integration not yet configured. This is a simulation.",
                },
            },
        });

        // Log in audit trail
        await prisma.invoiceAuditLog.create({
            data: {
                invoiceId,
                action: "PDP_SUBMISSION_SIMULATED",
                userId,
                details: {
                    transactionType: preparedData.transactionType,
                    complianceMethod: preparedData._meta.complianceRequirement.method,
                },
            },
        });

        return preparedData;
    }
}

export const eReportingService = new EReportingService();
