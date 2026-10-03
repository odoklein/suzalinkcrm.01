/**
 * Qonto API Service
 * Integrates with Qonto API to fetch bank transactions
 */

const QONTO_API_BASE = "https://api.qonto.eu/v2";

export interface QontoTransaction {
    id: string;
    amount: number; // Amount in cents (negative for debits, positive for credits)
    amount_cents: number;
    side: "debit" | "credit";
    operation_type: string;
    currency: string;
    note?: string;
    reference?: string;
    settled_at: string; // ISO 8601 date
    emitted_at: string; // ISO 8601 date
    status: string;
    label: string;
    counterparty?: {
        name: string;
        iban?: string;
    };
    attachment_ids?: string[];
}

export interface QontoTransactionsResponse {
    transactions: QontoTransaction[];
    meta: {
        current_page: number;
        next_page?: number;
        prev_page?: number;
        total_pages: number;
        total_count: number;
        per_page: number;
    };
}

export class QontoService {
    private apiKey: string;
    private orgId: string;
    private authHeader: string;

    constructor() {
        this.apiKey = process.env.QONTO_API_KEY || "";
        this.orgId = process.env.QONTO_ORG_ID || "";
        
        if (!this.apiKey || !this.orgId) {
            console.warn("QONTO_API_KEY or QONTO_ORG_ID not set. Qonto API calls will fail.");
        }

        // Qonto uses Basic Auth: base64(login:secret)
        // For Qonto, login is the org_id and secret is the api_key
        if (this.apiKey && this.orgId) {
            const credentials = Buffer.from(`${this.orgId}:${this.apiKey}`).toString("base64");
            this.authHeader = `Basic ${credentials}`;
        } else {
            this.authHeader = "";
        }
    }

    /**
     * Fetch transactions from Qonto
     * @param sinceDate Optional date to fetch transactions since (ISO 8601)
     * @param page Page number (default: 1)
     * @param perPage Items per page (default: 100, max: 100)
     */
    async fetchTransactions(
        sinceDate?: string,
        page: number = 1,
        perPage: number = 100
    ): Promise<QontoTransactionsResponse> {
        if (!this.apiKey || !this.orgId) {
            throw new Error("QONTO_API_KEY and QONTO_ORG_ID must be configured");
        }

        try {
            const url = new URL(`${QONTO_API_BASE}/transactions`);
            url.searchParams.set("current_page", page.toString());
            url.searchParams.set("per_page", Math.min(perPage, 100).toString());
            
            if (sinceDate) {
                url.searchParams.set("settled_at_from", sinceDate);
            }

            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: this.authHeader,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Qonto API error: ${response.status} - ${errorText}`);
            }

            const data: QontoTransactionsResponse = await response.json();
            return data;
        } catch (error) {
            console.error("Qonto fetchTransactions error:", error);
            throw error;
        }
    }

    /**
     * Get all transactions (handles pagination)
     */
    async fetchAllTransactions(sinceDate?: string): Promise<QontoTransaction[]> {
        const allTransactions: QontoTransaction[] = [];
        let currentPage = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await this.fetchTransactions(sinceDate, currentPage, 100);
            allTransactions.push(...response.transactions);
            
            hasMore = response.meta.next_page !== null && response.meta.next_page !== undefined;
            currentPage = response.meta.next_page || currentPage + 1;
        }

        return allTransactions;
    }

    /**
     * Get a single transaction by ID
     */
    async getTransaction(transactionId: string): Promise<QontoTransaction | null> {
        if (!this.apiKey || !this.orgId) {
            throw new Error("QONTO_API_KEY and QONTO_ORG_ID must be configured");
        }

        try {
            const url = new URL(`${QONTO_API_BASE}/transactions/${transactionId}`);

            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: this.authHeader,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                const errorText = await response.text();
                throw new Error(`Qonto API error: ${response.status} - ${errorText}`);
            }

            const data: { transaction: QontoTransaction } = await response.json();
            return data.transaction;
        } catch (error) {
            console.error("Qonto getTransaction error:", error);
            throw error;
        }
    }

    /**
     * Convert Qonto amount (cents) to decimal
     */
    static amountToDecimal(amountCents: number): number {
        return amountCents / 100;
    }

    /**
     * Convert decimal to Qonto amount (cents)
     */
    static decimalToAmount(decimal: number): number {
        return Math.round(decimal * 100);
    }
}

export const qontoService = new QontoService();
