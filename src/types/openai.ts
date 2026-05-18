export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface JsonArray extends Array<JsonValue> {}

export interface ToolCallFunction extends JsonObject {
  name?: string;
  arguments?: string;
}

export interface ToolCall extends JsonObject {
  id?: string;
  index?: number;
  type?: string;
  function?: ToolCallFunction;
}

export interface OpenAiMessage extends JsonObject {
  role: string;
  content?: JsonValue;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
}

export interface ChatCompletionsRequest extends JsonObject {
  model: string;
  messages: OpenAiMessage[];
  stream?: boolean;
  thinking?: JsonValue;
  tools?: JsonValue;
  tool_choice?: JsonValue;
}

export interface AssistantResponseMessage extends JsonObject {
  role?: string;
  content?: JsonValue;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
}

export interface ChatChoice extends JsonObject {
  index?: number;
  message?: AssistantResponseMessage;
  finish_reason?: string | null;
}

export interface Usage extends JsonObject {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatCompletionsResponse extends JsonObject {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: ChatChoice[];
  usage?: Usage;
}

export interface ModelDescription extends JsonObject {
  id: string;
  object: string;
  owned_by: string;
}

export interface ModelListResponse extends JsonObject {
  object: string;
  data: ModelDescription[];
}
