/**
 * Reminder Service
 * Handles detection of overdue invoices and reminder scheduling
 */

import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";

export interface OverdueInvoice {
    id: string;
    invoiceNumber: string | null;
    totalTtc: number;
    dueDate: Date;
    daysOverdue: number;
    urgencyLevel: "low" | "medium" | "high" | "critical";
    billingClient: {
        id: string;
        legalName: string;
        email: string | null;
    };
}

export interface AgingBucket {
    label: string;
    range: string;
    count: number;
    totalHt: number;
    totalTtc: number;
}

export class ReminderService {
    /**
     * Get all overdue invoices with urgency classification
     */
    async getOverdueInvoices(): Promise<OverdueInvoice[]> {
        const now = new Date();

        const invoices = await prisma.invoice.findMany({
            where: {
                documentType: "INVOICE",
                status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.SENT] },
                dueDate: { lt: now },
            },
            include: {
                billingClient: {
                    select: {
                        id: true,
                        legalName: true,
                        email: true,
                    },
                },
            },
            orderBy: { dueDate: "asc" },
        });

        return invoices.map((inv) => {
            const daysOverdue = Math.floor(
                (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            let urgencyLevel: OverdueInvoice["urgencyLevel"] = "low";
            if (daysOverdue > 60) urgencyLevel = "critical";
            else if (daysOverdue > 30) urgencyLevel = "high";
            else if (daysOverdue > 15) urgencyLevel = "medium";

            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                totalTtc: Number(inv.totalTtc),
                dueDate: inv.dueDate,
                daysOverdue,
                urgencyLevel,
                billingClient: inv.billingClient,
            };
        });
    }

    /**
     * Generate aging report (creances par anciennete)
     */
    async getAgingReport(): Promise<AgingBucket[]> {
        const now = new Date();

        const unpaidInvoices = await prisma.invoice.findMany({
            where: {
                documentType: "INVOICE",
                status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
            },
            select: {
                totalHt: true,
                totalTtc: true,
                dueDate: true,
            },
        });

        const buckets: AgingBucket[] = [
            { label: "Non échu", range: "< 0 jours", count: 0, totalHt: 0, totalTtc: 0 },
            { label: "0-15 jours", range: "0-15 jours", count: 0, totalHt: 0, totalTtc: 0 },
            { label: "16-30 jours", range: "16-30 jours", count: 0, totalHt: 0, totalTtc: 0 },
            { label: "31-60 jours", range: "31-60 jours", count: 0, totalHt: 0, totalTtc: 0 },
            { label: "61-90 jours", range: "61-90 jours", count: 0, totalHt: 0, totalTtc: 0 },
            { label: "> 90 jours", range: "> 90 jours", count: 0, totalHt: 0, totalTtc: 0 },
        ];

        for (const inv of unpaidInvoices) {
            const daysOverdue = Math.floor(
                (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            let bucketIndex = 0;
            if (daysOverdue < 0) bucketIndex = 0;
            else if (daysOverdue <= 15) bucketIndex = 1;
            else if (daysOverdue <= 30) bucketIndex = 2;
            else if (daysOverdue <= 60) bucketIndex = 3;
            else if (daysOverdue <= 90) bucketIndex = 4;
            else bucketIndex = 5;

            buckets[bucketIndex].count++;
            buckets[bucketIndex].totalHt += Number(inv.totalHt);
            buckets[bucketIndex].totalTtc += Number(inv.totalTtc);
        }

        // Round values
        return buckets.map((b) => ({
            ...b,
            totalHt: Math.round(b.totalHt * 100) / 100,
            totalTtc: Math.round(b.totalTtc * 100) / 100,
        }));
    }

    /**
     * Calculate DSO (Days Sales Outstanding)
     */
    async calculateDSO(): Promise<number> {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Get total accounts receivable (unpaid invoices)
        const unpaidResult = await prisma.invoice.aggregate({
            where: {
                documentType: "INVOICE",
                status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
            },
            _sum: { totalTtc: true },
        });

        // Get total revenue in last 30 days
        const revenueResult = await prisma.invoice.aggregate({
            where: {
                documentType: "INVOICE",
                status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
                issueDate: { gte: thirtyDaysAgo },
            },
            _sum: { totalTtc: true },
        });

        const accountsReceivable = Number(unpaidResult._sum.totalTtc || 0);
        const revenue30d = Number(revenueResult._sum.totalTtc || 0);

        if (revenue30d === 0) return 0;

        const dso = (accountsReceivable / revenue30d) * 30;
        return Math.round(dso);
    }

    /**
     * Get monthly revenue data for charting
     */
    async getMonthlyRevenue(months: number = 12): Promise<Array<{ month: string; revenue: number; invoiceCount: number }>> {
        const results: Array<{ month: string; revenue: number; invoiceCount: number }> = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const monthData = await prisma.invoice.aggregate({
                where: {
                    documentType: "INVOICE",
                    status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
                    issueDate: {
                        gte: startOfMonth,
                        lte: endOfMonth,
                    },
                },
                _sum: { totalTtc: true },
                _count: true,
            });

            const monthLabel = startOfMonth.toLocaleDateString("fr-FR", {
                month: "short",
                year: "2-digit",
            });

            results.push({
                month: monthLabel,
                revenue: Math.round(Number(monthData._sum.totalTtc || 0) * 100) / 100,
                invoiceCount: monthData._count,
            });
        }

        return results;
    }

    /**
     * Get VAT summary for declaration
     */
    async getVatSummary(startDate: Date, endDate: Date) {
        const invoices = await prisma.invoice.findMany({
            where: {
                status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
                issueDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                items: true,
            },
        });

        const vatByRate = new Map<number, {
            basisAmount: number;
            vatAmount: number;
            invoiceCount: number;
        }>();

        let totalHt = 0;
        let totalVat = 0;
        let totalTtc = 0;

        for (const invoice of invoices) {
            const multiplier = invoice.documentType === "CREDIT_NOTE" ? -1 : 1;
            totalHt += Number(invoice.totalHt) * multiplier;
            totalVat += Number(invoice.totalVat) * multiplier;
            totalTtc += Number(invoice.totalTtc) * multiplier;

            for (const item of invoice.items) {
                const rate = Number(item.vatRate);
                const existing = vatByRate.get(rate) || { basisAmount: 0, vatAmount: 0, invoiceCount: 0 };
                existing.basisAmount += Number(item.totalHt) * multiplier;
                existing.vatAmount += Number(item.totalVat) * multiplier;
                existing.invoiceCount++;
                vatByRate.set(rate, existing);
            }
        }

        return {
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            totals: {
                totalHt: Math.round(totalHt * 100) / 100,
                totalVat: Math.round(totalVat * 100) / 100,
                totalTtc: Math.round(totalTtc * 100) / 100,
            },
            byRate: Array.from(vatByRate.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([rate, amounts]) => ({
                    rate,
                    basisAmount: Math.round(amounts.basisAmount * 100) / 100,
                    vatAmount: Math.round(amounts.vatAmount * 100) / 100,
                    invoiceCount: amounts.invoiceCount,
                })),
            invoiceCount: invoices.filter((i) => i.documentType === "INVOICE").length,
            creditNoteCount: invoices.filter((i) => i.documentType === "CREDIT_NOTE").length,
        };
    }
}

export const reminderService = new ReminderService();
