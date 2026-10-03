/**
 * Google Gemini API (generativelanguage.googleapis.com) helper.
 * Uses generateContent with optional JSON response.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

export interface GeminiGenerateOptions {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    /** When true, asks for application/json so response is parseable JSON */
    json?: boolean;
}

export interface GeminiGenerateResult {
    text: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

/**
 * Call Gemini generateContent. Returns the generated text (and optional usage).
 */
export async function geminiGenerate(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    options: GeminiGenerateOptions = {}
): Promise<GeminiGenerateResult> {
    const model = options.model ?? DEFAULT_MODEL;
    const url = `${GEMINI_BASE}/${model}:generateContent`;

    const body: Record<string, unknown> = {
        systemInstruction: {
            parts: [{ text: systemPrompt }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: userPrompt }],
            },
        ],
        generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 3000,
        },
    };

    if (options.json) {
        (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = (err as { error?: { message?: string } })?.error?.message || response.statusText;
        throw new Error(`Gemini API: ${message}`);
    }

    const result = (await response.json()) as {
        candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text == null) {
        throw new Error('Gemini API: empty or invalid response');
    }

    const usage = result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount,
            completionTokens: result.usageMetadata.candidatesTokenCount,
            totalTokens: result.usageMetadata.totalTokenCount,
        }
        : undefined;

    return { text, usage };
}
