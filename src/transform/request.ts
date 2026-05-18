import { ReasoningCache } from "../cache/reasoningCache.js";
import type { ChatCompletionsRequest, JsonObject, OpenAiMessage } from "../types/openai.js";
import { extractReasoningContent, extractTextContent } from "../utils/content.js";
import { assistantFingerprint } from "../utils/fingerprint.js";

export function canonicalModel(model: string): string {
  const parts = model.toLowerCase().split("/");
  return parts[parts.length - 1] ?? model.toLowerCase();
}

function upstreamModelName(model: string): string {
  const trimmed = model.trim();
  const canonical = canonicalModel(trimmed);
  if (canonical.startsWith("deepseek-v4")) {
    return canonical;
  }
  return trimmed;
}

export function isDeepSeekV4Model(model: string): boolean {
  return canonicalModel(model).startsWith("deepseek-v4");
}

function cloneRequest(request: ChatCompletionsRequest): ChatCompletionsRequest {
  return JSON.parse(JSON.stringify(request)) as ChatCompletionsRequest;
}

function normalizeAssistantMessage(
  message: OpenAiMessage,
  cache: ReasoningCache,
  forceDeepSeekV4Rules: boolean,
): OpenAiMessage {
  const normalized = { ...message };
  const text = extractTextContent(message.content);
  const explicitReasoning = typeof message.reasoning_content === "string" ? message.reasoning_content : undefined;
  const extractedReasoning = explicitReasoning ?? extractReasoningContent(message.content);
  const fingerprint = assistantFingerprint({
    content: message.content,
    tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
  });
  const cachedReasoning = cache.get(fingerprint);
  const reasoning = extractedReasoning ?? cachedReasoning;
  const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

  if (text.length > 0) {
    normalized.content = text;
  } else if (forceDeepSeekV4Rules) {
    delete normalized.content;
  } else if (normalized.content === null) {
    delete normalized.content;
  }

  if (reasoning !== undefined) {
    normalized.reasoning_content = reasoning;
  } else if (forceDeepSeekV4Rules && hasToolCalls) {
    normalized.reasoning_content = "";
  }

  return normalized;
}

function normalizeMessage(message: OpenAiMessage, cache: ReasoningCache, deepSeekV4: boolean): OpenAiMessage {
  if (message.role !== "assistant") {
    return { ...message };
  }

  return normalizeAssistantMessage(message, cache, deepSeekV4);
}

export interface PreparedRequest {
  upstreamRequest: ChatCompletionsRequest;
  clientRequestedStream: boolean;
  deepSeekV4: boolean;
}

export function prepareUpstreamRequest(
  incomingRequest: ChatCompletionsRequest,
  cache: ReasoningCache,
  bufferStreaming: boolean,
): PreparedRequest {
  const upstreamRequest = cloneRequest(incomingRequest);
  const deepSeekV4 = isDeepSeekV4Model(incomingRequest.model);
  upstreamRequest.model = upstreamModelName(incomingRequest.model);

  upstreamRequest.messages = incomingRequest.messages.map((message) =>
    normalizeMessage(message, cache, deepSeekV4),
  );

  if (deepSeekV4 && upstreamRequest.thinking === undefined) {
    upstreamRequest.thinking = { type: "enabled" };
  }

  const clientRequestedStream = incomingRequest.stream === true;
  if (bufferStreaming && clientRequestedStream) {
    upstreamRequest.stream = false;
  }

  return {
    upstreamRequest,
    clientRequestedStream,
    deepSeekV4,
  };
}

export function requestSummary(input: ChatCompletionsRequest): JsonObject {
  return {
    model: input.model,
    stream: input.stream === true,
    message_count: input.messages.length,
    tool_count: Array.isArray(input.tools) ? input.tools.length : 0,
  };
}
