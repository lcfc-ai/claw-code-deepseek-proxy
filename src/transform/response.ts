import { ReasoningCache } from "../cache/reasoningCache.js";
import type {
  AssistantResponseMessage,
  ChatCompletionsResponse,
  ModelDescription,
  ModelListResponse,
} from "../types/openai.js";
import { assistantFingerprint } from "../utils/fingerprint.js";

export function rememberReasoningFromResponse(
  response: ChatCompletionsResponse,
  cache: ReasoningCache,
): void {
  const choices = Array.isArray(response.choices) ? response.choices : [];
  for (const choice of choices) {
    const message = choice.message;
    if (!message || typeof message !== "object") {
      continue;
    }

    const reasoning = typeof message.reasoning_content === "string" ? message.reasoning_content : undefined;
    if (reasoning === undefined) {
      continue;
    }

    cache.set(
      assistantFingerprint({
        content: message.content,
        tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
      }),
      reasoning,
    );
  }
}

export function responseSummary(response: ChatCompletionsResponse): Record<string, unknown> {
  return {
    id: response.id,
    model: response.model,
    choice_count: Array.isArray(response.choices) ? response.choices.length : 0,
    has_usage: response.usage !== undefined,
  };
}

export function fallbackModelsResponse(models: string[]): ModelListResponse {
  const data: ModelDescription[] = models.map((id) => ({
    id,
    object: "model",
    owned_by: "deepseek-compat-proxy",
  }));

  return {
    object: "list",
    data,
  };
}
