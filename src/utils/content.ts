import type { JsonObject, JsonValue } from "../types/openai.js";

function blockFieldAsString(block: JsonObject, key: string): string | undefined {
  const value = block[key];
  return typeof value === "string" ? value : undefined;
}

export function extractTextContent(content: JsonValue | undefined): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      continue;
    }
    const objectBlock = block as JsonObject;
    const type = blockFieldAsString(objectBlock, "type");
    if (type === "text") {
      const text = blockFieldAsString(objectBlock, "text");
      if (text) {
        parts.push(text);
      }
    }
  }

  return parts.join("");
}

export function extractReasoningContent(content: JsonValue | undefined): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      continue;
    }
    const objectBlock = block as JsonObject;
    const type = blockFieldAsString(objectBlock, "type");
    if (!type) {
      continue;
    }

    if (type === "thinking" || type === "reasoning" || type === "analysis") {
      const value =
        blockFieldAsString(objectBlock, "thinking") ??
        blockFieldAsString(objectBlock, "reasoning") ??
        blockFieldAsString(objectBlock, "text");
      if (value) {
        parts.push(value);
      }
    }
  }

  const joined = parts.join("");
  return joined.length > 0 ? joined : undefined;
}
