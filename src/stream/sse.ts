import type { ServerResponse } from "node:http";

import type {
  ChatChoice,
  ChatCompletionsResponse,
  ToolCall,
} from "../types/openai.js";
import { extractTextContent } from "../utils/content.js";

function writeChunk(raw: ServerResponse, payload: Record<string, unknown>): void {
  raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function baseChunk(response: ChatCompletionsResponse, choiceIndex: number): Record<string, unknown> {
  return {
    id: response.id ?? `chatcmpl_proxy_${Date.now()}`,
    object: "chat.completion.chunk",
    created: response.created ?? Math.floor(Date.now() / 1000),
    model: response.model ?? "deepseek-proxy",
    choices: [
      {
        index: choiceIndex,
        delta: {},
        finish_reason: null,
      },
    ],
  };
}

function toolCallsDelta(toolCalls: ToolCall[]): ToolCall[] {
  return toolCalls.map((toolCall, index) => ({
    index,
    id: typeof toolCall.id === "string" ? toolCall.id : `call_${index}`,
    type: typeof toolCall.type === "string" ? toolCall.type : "function",
    function: {
      name:
        toolCall.function && typeof toolCall.function.name === "string"
          ? toolCall.function.name
          : `tool_${index}`,
      arguments:
        toolCall.function && typeof toolCall.function.arguments === "string"
          ? toolCall.function.arguments
          : "{}",
    },
  }));
}

function emitChoice(raw: ServerResponse, response: ChatCompletionsResponse, choice: ChatChoice, index: number): void {
  const message = choice.message ?? {};
  const roleChunk = baseChunk(response, index);
  (roleChunk.choices as Array<Record<string, unknown>>)[0].delta = { role: message.role ?? "assistant" };
  writeChunk(raw, roleChunk);

  if (typeof message.reasoning_content === "string" && message.reasoning_content.length > 0) {
    const reasoningChunk = baseChunk(response, index);
    (reasoningChunk.choices as Array<Record<string, unknown>>)[0].delta = {
      reasoning_content: message.reasoning_content,
    };
    writeChunk(raw, reasoningChunk);
  }

  const text = extractTextContent(message.content);
  if (text.length > 0) {
    const textChunk = baseChunk(response, index);
    (textChunk.choices as Array<Record<string, unknown>>)[0].delta = { content: text };
    writeChunk(raw, textChunk);
  }

  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  if (toolCalls.length > 0) {
    const toolChunk = baseChunk(response, index);
    (toolChunk.choices as Array<Record<string, unknown>>)[0].delta = {
      tool_calls: toolCallsDelta(toolCalls),
    };
    writeChunk(raw, toolChunk);
  }

  const finishChunk = baseChunk(response, index);
  (finishChunk.choices as Array<Record<string, unknown>>)[0].finish_reason =
    choice.finish_reason ?? (toolCalls.length > 0 ? "tool_calls" : "stop");
  writeChunk(raw, finishChunk);
}

export function writeBufferedCompletionAsSse(
  raw: ServerResponse,
  response: ChatCompletionsResponse,
): void {
  raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  const choices = Array.isArray(response.choices) ? response.choices : [];
  for (let index = 0; index < choices.length; index += 1) {
    emitChoice(raw, response, choices[index]!, index);
  }

  if (response.usage !== undefined) {
    writeChunk(raw, {
      id: response.id ?? `chatcmpl_proxy_${Date.now()}`,
      object: "chat.completion.chunk",
      created: response.created ?? Math.floor(Date.now() / 1000),
      model: response.model ?? "deepseek-proxy",
      choices: [],
      usage: response.usage,
    });
  }

  raw.write("data: [DONE]\n\n");
  raw.end();
}
