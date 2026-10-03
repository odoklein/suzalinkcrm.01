/**
 * Payment Matching Service
 * Matches Qonto transactions to invoices and handles payment reconciliation
 */

import { prisma } from "@/lib/prisma";
import { qontoService, QontoTransaction } from "./qonto-service";
import { PaymentMatchStatus, InvoiceStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export type MatchType = "STRONG" | "WEAK";

export interface PaymentMatch {
    invoiceId: string;
    transaction: QontoTransaction;
    matchType: MatchType;
    confidence: number;
}

export class PaymentMatchingService {
    /**
     * Calculate Levenshtein distance for fuzzy string matching
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j - 1] + 1
                    );
                }
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Calculate similarity score between two strings (0-1)
     */
    private stringSimilarity(str1: string, str2: string): number {
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0) return 1;
        const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
        return 1 - distance / maxLen;
    }

    /**
     * Check if amount matches within tolerance
     */
    private amountMatches(amount1: number, amount2: number, tolerance: number = 0.01): boolean {
        return Math.abs(amount1 - amount2) <= tolerance;
    }

    /**
     * Extract invoice number from transaction reference
     */
    private extractInvoiceNumber(reference: string): string | null {
        // Look for patterns like "INV-001", "INV001", "FACTURE-001", etc.
        const patterns = [
            /INV-?(\d+)/i,
            /FACTURE-?(\d+)/i,
            /FACT-?(\d+)/i,
            /(\d{3,})/,
        ];

        for (const pattern of patterns) {
            const match = reference.match(pattern);
            if (match) {
                // Normalize to INV-XXX format
                const num = match[1];
                return `INV-${num.padStart(3, "0")}`;
            }
        }

        return null;
    }

    /**
     * Match a single transaction to invoices
     */
    async matchTransactionToInvoice(
        transaction: QontoTransaction,
        invoices: Array<{
            id: string;
            invoiceNumber: string | null;
            totalTtc: Decimal;
            status: InvoiceStatus;
            billingClient: {
                legalName: string;
            };
        }>
    ): Promise<PaymentMatch | null> {
        // Only match credit transactions (incoming payments)
        if (transaction.side !== "credit" || transaction.amount <= 0) {
            return null;
        }

        const transactionAmount = qontoService.amountToDecimal(transaction.amount_cents);

        // Filter to open invoices (not paid)
        const openInvoices = invoices.filter(
            (inv) => inv.status === InvoiceStatus.VALIDATED || inv.status === InvoiceStatus.SENT
        );

        // Check for strong match: invoice number in reference AND amount matches
        if (transaction.reference) {
            const extractedInvoiceNumber = this.extractInvoiceNumber(transaction.reference);
            if (extractedInvoiceNumber) {
                const matchingInvoice = openInvoices.find(
                    (inv) => inv.invoiceNumber === extractedInvoiceNumber
                );

                if (matchingInvoice) {
                    const invoiceAmount = Number(matchingInvoice.totalTtc);
                    if (this.amountMatches(transactionAmount, invoiceAmount)) {
                        return {
                            invoiceId: matchingInvoice.id,
                            transaction,
                            matchType: "STRONG",
                            confidence: 1.0,
                        };
                    }
                }
            }
        }

        // Check for weak match: amount matches AND counterparty name similar
        if (transaction.counterparty?.name) {
            const counterpartyName = transaction.counterparty.name.trim();

            for (const invoice of openInvoices) {
                const invoiceAmount = Number(invoice.totalTtc);
                if (this.amountMatches(transactionAmount, invoiceAmount)) {
                    const similarity = this.stringSimilarity(
                        counterpartyName,
                        invoice.billingClient.legalName
                    );

                    // Require at least 70% similarity for weak match
                    if (similarity >= 0.7) {
                        return {
                            invoiceId: invoice.id,
                            transaction,
                            matchType: "WEAK",
                            confidence: similarity,
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Create a payment match record
     */
    async createPaymentMatch(
        invoiceId: string,
        transaction: QontoTransaction,
        matchType: MatchType
    ) {
        // Check if transaction already matched
        const existing = await prisma.invoicePayment.findUnique({
            where: { qontoTransactionId: transaction.id },
        });

        if (existing) {
            return existing;
        }

        // Check if invoice already has a confirmed payment
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { payments: true },
        });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        const hasConfirmedPayment = invoice.payments.some(
            (p) => p.status === PaymentMatchStatus.CONFIRMED
        );

        if (hasConfirmedPayment) {
            throw new Error("Invoice already has a confirmed payment");
        }

        // Create payment match
        const payment = await prisma.invoicePayment.create({
            data: {
                invoiceId,
                qontoTransactionId: transaction.id,
                amount: new Decimal(qontoService.amountToDecimal(transaction.amount_cents)),
                paymentDate: new Date(transaction.settled_at),
                status: PaymentMatchStatus.MATCHED,
            },
            include: {
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                    },
                },
            },
        });

        return payment;
    }

    /**
     * Sync Qonto transactions and match to invoices
     */
    async syncQontoPayments(sinceDate?: string): Promise<{
        matched: number;
        errors: Array<{ transactionId: string; error: string }>;
    }> {
        const errors: Array<{ transactionId: string; error: string }> = [];
        let matched = 0;

        try {
            // Fetch all transactions from Qonto
            const transactions = await qontoService.fetchAllTransactions(sinceDate);

            // Get all open invoices
            const invoices = await prisma.invoice.findMany({
                where: {
                    status: {
                        in: [InvoiceStatus.VALIDATED, InvoiceStatus.SENT],
                    },
                },
                include: {
                    billingClient: {
                        select: {
                            legalName: true,
                        },
                    },
                    payments: {
                        select: {
                            qontoTransactionId: true,
                            status: true,
                        },
                    },
                },
            });

            // Get already matched transaction IDs
            const matchedTransactionIds = new Set(
                invoices.flatMap((inv) => inv.payments.map((p) => p.qontoTransactionId))
            );

            // Filter out already matched transactions
            const unmatchedTransactions = transactions.filter(
                (t) => !matchedTransactionIds.has(t.id)
            );

            // Match each transaction
            for (const transaction of unmatchedTransactions) {
                try {
                    const match = await this.matchTransactionToInvoice(transaction, invoices);

                    if (match) {
                        await this.createPaymentMatch(
                            match.invoiceId,
                            match.transaction,
                            match.matchType
                        );
                        matched++;
                    }
                } catch (error) {
                    errors.push({
                        transactionId: transaction.id,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        } catch (error) {
            errors.push({
                transactionId: "SYNC_ERROR",
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return { matched, errors };
    }

    /**
     * Confirm a matched payment
     */
    async confirmPayment(paymentId: string, userId: string) {
        const payment = await prisma.invoicePayment.findUnique({
            where: { id: paymentId },
            include: { invoice: true },
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        if (payment.status === PaymentMatchStatus.CONFIRMED) {
            throw new Error("Payment already confirmed");
        }

        // Update payment status
        const confirmedPayment = await prisma.invoicePayment.update({
            where: { id: paymentId },
            data: {
                status: PaymentMatchStatus.CONFIRMED,
                confirmedAt: new Date(),
                confirmedById: userId,
            },
        });

        // Update invoice status to PAID
        await prisma.invoice.update({
            where: { id: payment.invoiceId },
            data: {
                status: InvoiceStatus.PAID,
                paidAt: new Date(),
            },
        });

        return confirmedPayment;
    }

    /**
     * Reject a payment match
     */
    async rejectPayment(paymentId: string) {
        const payment = await prisma.invoicePayment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        if (payment.status === PaymentMatchStatus.CONFIRMED) {
            throw new Error("Cannot reject a confirmed payment");
        }

        // Delete the payment match
        await prisma.invoicePayment.delete({
            where: { id: paymentId },
        });

        return { success: true };
    }
}

export const paymentMatchingService = new PaymentMatchingService();
