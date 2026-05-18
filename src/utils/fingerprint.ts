import type { JsonObject, JsonValue, ToolCall } from "../types/openai.js";

function stableStringify(value: JsonValue | undefined): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const objectValue = value as JsonObject;
  const keys = Object.keys(objectValue).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}

export function assistantFingerprint(input: {
  content?: JsonValue;
  tool_calls?: ToolCall[];
}): string {
  return stableStringify({
    content: input.content ?? null,
    tool_calls: input.tool_calls ?? [],
  });
}
