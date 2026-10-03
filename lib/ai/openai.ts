export interface OpenAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface OpenAIChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface OpenAIChatResult {
    text: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    model?: string;
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

export async function openaiChatComplete(
    apiKey: string,
    messages: OpenAIMessage[],
    options: OpenAIChatOptions = {}
): Promise<OpenAIChatResult> {
    const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options.model ?? DEFAULT_MODEL,
            messages,
            temperature: options.temperature ?? 0.35,
            max_tokens: options.maxTokens ?? 1200,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message =
            (err as { error?: { message?: string } })?.error?.message ||
            response.statusText ||
            "OpenAI request failed";
        throw new Error(`OpenAI API: ${message}`);
    }

    const result = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
        };
        model?: string;
    };

    const text = result.choices?.[0]?.message?.content?.trim();
    if (!text) {
        throw new Error("OpenAI API: empty response");
    }

    return {
        text,
        model: result.model,
        usage: result.usage
            ? {
                promptTokens: result.usage.prompt_tokens,
                completionTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens,
            }
            : undefined,
    };
}
