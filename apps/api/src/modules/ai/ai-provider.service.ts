import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AiCompletionInput = {
  system: string;
  user: string;
  jsonMode?: boolean;
};

@Injectable()
export class AiProviderService {
  constructor(private readonly config: ConfigService) {}

  get model() {
    return this.config.get<string>("AI_MODEL", "gpt-4.1-mini");
  }

  async complete(input: AiCompletionInput): Promise<{ content: string; raw: unknown; tokenUsage?: unknown }> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      const placeholder = input.jsonMode
        ? JSON.stringify({ summary: "AI provider not configured", recommendations: [] }, null, 2)
        : "AI provider not configured. Configure OPENAI_API_KEY or a private model adapter.";
      return {
        content: placeholder,
        raw: {
          model: this.model,
          placeholder: true,
          input
        }
      };
    }

    const baseUrl = this.config.get<string>("AI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user }
          ],
          temperature: 0.3,
          ...(input.jsonMode ? { response_format: { type: "json_object" } } : {})
        }),
        signal: controller.signal
      });

      const raw = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
      if (!response.ok) {
        throw new ServiceUnavailableException(raw.error?.message ?? "AI provider request failed");
      }

      const content = raw.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new ServiceUnavailableException("AI provider returned an empty response");
      }

      return {
        content,
        raw,
        tokenUsage: raw.usage
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "AI provider unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }
}

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: unknown;
  error?: { message?: string };
};
