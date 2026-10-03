/**
 * Invoice Service - EU 2026 Compliant
 * Handles invoice CRUD, validation, credit notes, cancellation, and audit trail
 */

import { prisma } from "@/lib/prisma";
import { Prisma, InvoiceStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { facturXService } from "./facturx-service";
import { storageService } from "@/lib/storage/storage-service";

export interface CreateInvoiceData {
    billingClientId: string;
    companyIssuerId: string;
    issueDate: Date;
    dueDate: Date;
    paymentTermsDays?: number;
    paymentTermsText?: string;
    latePenaltyRate?: number;
    earlyPaymentDiscount?: string;
    notes?: string;
    currency?: string;
    items: Array<{
        description: string;
        quantity: number;
        unitPriceHt: number;
        vatRate: number;
    }>;
}

export interface UpdateInvoiceData {
    billingClientId?: string;
    issueDate?: Date;
    dueDate?: Date;
    paymentTermsDays?: number;
    paymentTermsText?: string;
    latePenaltyRate?: number;
    earlyPaymentDiscount?: string;
    notes?: string;
    items?: Array<{
        description: string;
        quantity: number;
        unitPriceHt: number;
        vatRate: number;
    }>;
}

export class InvoiceService {
    /**
     * Calculate totals for invoice items
     */
    private calculateItemTotals(
        quantity: number,
        unitPriceHt: number,
        vatRate: number
    ): { totalHt: number; totalVat: number; totalTtc: number } {
        const totalHt = quantity * unitPriceHt;
        const totalVat = totalHt * (vatRate / 100);
        const totalTtc = totalHt + totalVat;

        return {
            totalHt: Math.round(totalHt * 100) / 100,
            totalVat: Math.round(totalVat * 100) / 100,
            totalTtc: Math.round(totalTtc * 100) / 100,
        };
    }

    /**
     * Calculate invoice totals from items
     */
    private calculateInvoiceTotals(items: Array<{ totalHt: number; totalVat: number; totalTtc: number }>) {
        const totals = items.reduce(
            (acc, item) => ({
                totalHt: acc.totalHt + item.totalHt,
                totalVat: acc.totalVat + item.totalVat,
                totalTtc: acc.totalTtc + item.totalTtc,
            }),
            { totalHt: 0, totalVat: 0, totalTtc: 0 }
        );

        return {
            totalHt: Math.round(totals.totalHt * 100) / 100,
            totalVat: Math.round(totals.totalVat * 100) / 100,
            totalTtc: Math.round(totals.totalTtc * 100) / 100,
        };
    }

    /**
     * Generate next sequential invoice number
     * Format: FA-YYYY-NNNN for invoices, AV-YYYY-NNNN for credit notes
     */
    async generateInvoiceNumber(documentType: "INVOICE" | "CREDIT_NOTE" = "INVOICE"): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = documentType === "CREDIT_NOTE" ? "AV" : "FA";
        const pattern = `${prefix}-${year}-`;

        // Get the highest invoice number for this year and type
        const lastInvoice = await prisma.invoice.findFirst({
            where: {
                invoiceNumber: {
                    startsWith: pattern,
                },
            },
            orderBy: {
                invoiceNumber: "desc",
            },
            select: {
                invoiceNumber: true,
            },
        });

        if (!lastInvoice?.invoiceNumber) {
            return `${pattern}0001`;
        }

        // Extract number from "FA-2026-0001" format
        const match = lastInvoice.invoiceNumber.match(new RegExp(`${prefix}-${year}-(\\d+)`));
        if (!match) {
            return `${pattern}0001`;
        }

        const nextNumber = parseInt(match[1], 10) + 1;
        return `${pattern}${nextNumber.toString().padStart(4, "0")}`;
    }

    /**
     * Create audit log entry
     */
    private async createAuditLog(
        invoiceId: string,
        action: string,
        userId: string,
        details?: Record<string, any>
    ) {
        await prisma.invoiceAuditLog.create({
            data: {
                invoiceId,
                action,
                userId,
                details: details || undefined,
            },
        });
    }

    /**
     * Create a new draft invoice
     */
    async createInvoice(data: CreateInvoiceData, userId: string) {
        // Calculate item totals
        const itemsWithTotals = data.items.map((item, index) => {
            const totals = this.calculateItemTotals(item.quantity, item.unitPriceHt, item.vatRate);
            return {
                ...item,
                ...totals,
                order: index,
            };
        });

        // Calculate invoice totals
        const invoiceTotals = this.calculateInvoiceTotals(itemsWithTotals);

        // Get company issuer defaults for payment terms
        const issuer = await prisma.companyIssuer.findUnique({
            where: { id: data.companyIssuerId },
        });

        // Create invoice with items
        const invoice = await prisma.invoice.create({
            data: {
                status: InvoiceStatus.DRAFT,
                documentType: "INVOICE",
                billingClientId: data.billingClientId,
                companyIssuerId: data.companyIssuerId,
                issueDate: data.issueDate,
                dueDate: data.dueDate,
                currency: data.currency || "EUR",
                totalHt: new Decimal(invoiceTotals.totalHt),
                totalVat: new Decimal(invoiceTotals.totalVat),
                totalTtc: new Decimal(invoiceTotals.totalTtc),
                paymentTermsDays: data.paymentTermsDays || issuer?.defaultPaymentTermsDays || 30,
                paymentTermsText: data.paymentTermsText || null,
                latePenaltyRate: new Decimal(data.latePenaltyRate ?? Number(issuer?.defaultLatePenaltyRate ?? 0)),
                earlyPaymentDiscount: data.earlyPaymentDiscount || issuer?.defaultEarlyPaymentDiscount || null,
                notes: data.notes || null,
                createdById: userId,
                items: {
                    create: itemsWithTotals.map((item) => ({
                        description: item.description,
                        quantity: new Decimal(item.quantity),
                        unitPriceHt: new Decimal(item.unitPriceHt),
                        vatRate: new Decimal(item.vatRate),
                        totalHt: new Decimal(item.totalHt),
                        totalVat: new Decimal(item.totalVat),
                        totalTtc: new Decimal(item.totalTtc),
                        order: item.order,
                    })),
                },
            },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Create audit log
        await this.createAuditLog(invoice.id, "CREATED", userId);

        return invoice;
    }

    /**
     * Update a draft invoice (only if status is DRAFT)
     */
    async updateInvoice(id: string, data: UpdateInvoiceData, userId: string) {
        // Check invoice exists and is draft
        const existing = await prisma.invoice.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!existing) {
            throw new Error("Invoice not found");
        }

        if (existing.status !== InvoiceStatus.DRAFT) {
            throw new Error("Cannot update invoice that is not in DRAFT status");
        }

        // If items are being updated, recalculate totals
        let invoiceTotals = {
            totalHt: Number(existing.totalHt),
            totalVat: Number(existing.totalVat),
            totalTtc: Number(existing.totalTtc),
        };

        if (data.items) {
            const itemsWithTotals = data.items.map((item, index) => {
                const totals = this.calculateItemTotals(item.quantity, item.unitPriceHt, item.vatRate);
                return {
                    ...item,
                    ...totals,
                    order: index,
                };
            });

            invoiceTotals = this.calculateInvoiceTotals(itemsWithTotals);

            // Delete existing items and create new ones
            await prisma.invoiceItem.deleteMany({
                where: { invoiceId: id },
            });
        }

        // Update invoice
        const invoice = await prisma.invoice.update({
            where: { id },
            data: {
                ...(data.billingClientId && { billingClientId: data.billingClientId }),
                ...(data.issueDate && { issueDate: data.issueDate }),
                ...(data.dueDate && { dueDate: data.dueDate }),
                ...(data.paymentTermsDays !== undefined && { paymentTermsDays: data.paymentTermsDays }),
                ...(data.paymentTermsText !== undefined && { paymentTermsText: data.paymentTermsText }),
                ...(data.latePenaltyRate !== undefined && { latePenaltyRate: new Decimal(data.latePenaltyRate) }),
                ...(data.earlyPaymentDiscount !== undefined && { earlyPaymentDiscount: data.earlyPaymentDiscount }),
                ...(data.notes !== undefined && { notes: data.notes }),
                totalHt: new Decimal(invoiceTotals.totalHt),
                totalVat: new Decimal(invoiceTotals.totalVat),
                totalTtc: new Decimal(invoiceTotals.totalTtc),
                ...(data.items && {
                    items: {
                        create: data.items.map((item, index) => {
                            const totals = this.calculateItemTotals(item.quantity, item.unitPriceHt, item.vatRate);
                            return {
                                description: item.description,
                                quantity: new Decimal(item.quantity),
                                unitPriceHt: new Decimal(item.unitPriceHt),
                                vatRate: new Decimal(item.vatRate),
                                totalHt: new Decimal(totals.totalHt),
                                totalVat: new Decimal(totals.totalVat),
                                totalTtc: new Decimal(totals.totalTtc),
                                order: index,
                            };
                        }),
                    },
                }),
            },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: {
                    orderBy: { order: "asc" },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return invoice;
    }

    /**
     * Validate invoice: generate number, create PDF, lock invoice
     */
    async validateInvoice(id: string, userId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: {
                    orderBy: { order: "asc" },
                },
                relatedInvoice: {
                    select: { invoiceNumber: true },
                },
            },
        });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        if (invoice.status !== InvoiceStatus.DRAFT) {
            throw new Error("Invoice is already validated");
        }

        if (!invoice.items || invoice.items.length === 0) {
            throw new Error("Invoice must have at least one item");
        }

        // Generate invoice number based on document type
        const invoiceNumber = await this.generateInvoiceNumber(
            invoice.documentType as "INVOICE" | "CREDIT_NOTE"
        );

        // Generate Factur-X PDF
        const pdfBuffer = await facturXService.generateFacturXPDF({
            ...invoice,
            invoiceNumber,
        } as any);

        // Upload PDF to storage
        const { key, url } = await storageService.upload(
            pdfBuffer,
            {
                filename: `${invoiceNumber}.pdf`,
                mimeType: "application/pdf",
                size: pdfBuffer.length,
                folder: "invoices",
            },
            userId
        );

        // Update invoice: set number, PDF URL, status, and validated date
        const validatedInvoice = await prisma.invoice.update({
            where: { id },
            data: {
                invoiceNumber,
                status: InvoiceStatus.VALIDATED,
                facturxPdfUrl: url,
                validatedAt: new Date(),
            },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: {
                    orderBy: { order: "asc" },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Create audit log
        await this.createAuditLog(invoice.id, "VALIDATED", userId, {
            invoiceNumber,
        });

        return validatedInvoice;
    }

    /**
     * Mark invoice as sent
     */
    async markAsSent(id: string, userId: string) {
        const invoice = await prisma.invoice.findUnique({ where: { id } });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        if (invoice.status !== InvoiceStatus.VALIDATED) {
            throw new Error("Invoice must be validated before sending");
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                status: InvoiceStatus.SENT,
                sentAt: new Date(),
            },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: { orderBy: { order: "asc" } },
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        await this.createAuditLog(id, "SENT", userId);

        return updated;
    }

    /**
     * Cancel an invoice
     */
    async cancelInvoice(id: string, userId: string, reason?: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { payments: true },
        });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        if (invoice.status === InvoiceStatus.PAID) {
            throw new Error("Cannot cancel a paid invoice. Create a credit note instead.");
        }

        if (invoice.status === InvoiceStatus.CANCELLED) {
            throw new Error("Invoice is already cancelled");
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                status: InvoiceStatus.CANCELLED,
                cancelledAt: new Date(),
            },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: { orderBy: { order: "asc" } },
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        await this.createAuditLog(id, "CANCELLED", userId, {
            reason: reason || "Annulation manuelle",
        });

        return updated;
    }

    /**
     * Create a credit note from an existing invoice
     */
    async createCreditNote(invoiceId: string, userId: string, items?: Array<{
        description: string;
        quantity: number;
        unitPriceHt: number;
        vatRate: number;
    }>) {
        const originalInvoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: { orderBy: { order: "asc" } },
            },
        });

        if (!originalInvoice) {
            throw new Error("Original invoice not found");
        }

        if (originalInvoice.status === InvoiceStatus.DRAFT || originalInvoice.status === InvoiceStatus.CANCELLED) {
            throw new Error("Cannot create credit note for a draft or cancelled invoice");
        }

        // Use provided items or mirror original invoice items
        const creditItems = items || originalInvoice.items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPriceHt: Number(item.unitPriceHt),
            vatRate: Number(item.vatRate),
        }));

        // Calculate item totals
        const itemsWithTotals = creditItems.map((item, index) => {
            const totals = this.calculateItemTotals(item.quantity, item.unitPriceHt, item.vatRate);
            return { ...item, ...totals, order: index };
        });

        const invoiceTotals = this.calculateInvoiceTotals(itemsWithTotals);

        // Create credit note
        const creditNote = await prisma.invoice.create({
            data: {
                status: InvoiceStatus.DRAFT,
                documentType: "CREDIT_NOTE",
                billingClientId: originalInvoice.billingClientId,
                companyIssuerId: originalInvoice.companyIssuerId,
                issueDate: new Date(),
                dueDate: new Date(),
                currency: (originalInvoice as any).currency || "EUR",
                totalHt: new Decimal(invoiceTotals.totalHt),
                totalVat: new Decimal(invoiceTotals.totalVat),
                totalTtc: new Decimal(invoiceTotals.totalTtc),
                paymentTermsDays: (originalInvoice as any).paymentTermsDays || 0,
                paymentTermsText: "Avoir - remboursement",
                latePenaltyRate: new Decimal(0),
                notes: `Avoir relatif à la facture ${originalInvoice.invoiceNumber || originalInvoice.id}`,
                relatedInvoiceId: originalInvoice.id,
                createdById: userId,
                items: {
                    create: itemsWithTotals.map((item) => ({
                        description: item.description,
                        quantity: new Decimal(item.quantity),
                        unitPriceHt: new Decimal(item.unitPriceHt),
                        vatRate: new Decimal(item.vatRate),
                        totalHt: new Decimal(item.totalHt),
                        totalVat: new Decimal(item.totalVat),
                        totalTtc: new Decimal(item.totalTtc),
                        order: item.order,
                    })),
                },
            },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: true,
                relatedInvoice: {
                    select: { id: true, invoiceNumber: true },
                },
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        await this.createAuditLog(creditNote.id, "CREDIT_NOTE_CREATED", userId, {
            relatedInvoiceId: originalInvoice.id,
            relatedInvoiceNumber: originalInvoice.invoiceNumber,
        });

        // Also log on the original invoice
        await this.createAuditLog(originalInvoice.id, "CREDIT_NOTE_ISSUED", userId, {
            creditNoteId: creditNote.id,
        });

        return creditNote;
    }

    /**
     * Get invoice by ID with all relations
     */
    async getInvoice(id: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                billingClient: true,
                companyIssuer: true,
                items: {
                    orderBy: { order: "asc" },
                },
                payments: {
                    include: {
                        confirmedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
                relatedInvoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        status: true,
                    },
                },
                creditNotes: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        status: true,
                        totalTtc: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
                auditLogs: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return invoice;
    }

    /**
     * List invoices with filters and pagination
     */
    async listInvoices(filters: {
        status?: InvoiceStatus;
        documentType?: string;
        billingClientId?: string;
        dateFrom?: Date;
        dateTo?: Date;
        search?: string;
    }, pagination: { page: number; limit: number }) {
        const where: Prisma.InvoiceWhereInput = {};

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.documentType) {
            where.documentType = filters.documentType as any;
        }

        if (filters.billingClientId) {
            where.billingClientId = filters.billingClientId;
        }

        if (filters.dateFrom || filters.dateTo) {
            where.issueDate = {};
            if (filters.dateFrom) {
                where.issueDate.gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                where.issueDate.lte = filters.dateTo;
            }
        }

        if (filters.search) {
            where.OR = [
                { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
                { billingClient: { legalName: { contains: filters.search, mode: "insensitive" } } },
            ];
        }

        const skip = (pagination.page - 1) * pagination.limit;

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    billingClient: {
                        select: {
                            id: true,
                            legalName: true,
                        },
                    },
                    _count: {
                        select: {
                            items: true,
                            payments: true,
                            creditNotes: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: pagination.limit,
            }),
            prisma.invoice.count({ where }),
        ]);

        return {
            invoices,
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }

    /**
     * Get audit log for an invoice
     */
    async getAuditLog(invoiceId: string) {
        return prisma.invoiceAuditLog.findMany({
            where: { invoiceId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * Get billing statistics
     */
    async getBillingStats() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const [
            totalInvoices,
            totalCreditNotes,
            statusCounts,
            overdueInvoices,
        ] = await Promise.all([
            prisma.invoice.count({ where: { documentType: "INVOICE" } }),
            prisma.invoice.count({ where: { documentType: "CREDIT_NOTE" } }),
            prisma.invoice.groupBy({
                by: ["status"],
                _count: true,
                where: { documentType: "INVOICE" },
            }),
            prisma.invoice.count({
                where: {
                    documentType: "INVOICE",
                    status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.SENT] },
                    dueDate: { lt: now },
                },
            }),
        ]);

        return {
            totalInvoices,
            totalCreditNotes,
            statusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr.status] = curr._count;
                return acc;
            }, {} as Record<string, number>),
            overdueInvoices,
        };
    }
}

export const invoiceService = new InvoiceService();
