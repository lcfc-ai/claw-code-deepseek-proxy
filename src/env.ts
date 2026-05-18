import { normalizeUpstreamBaseUrl } from "./utils/upstream.js";

export interface ProxyConfig {
  host: string;
  port: number;
  logLevel: string;
  simpleRequestLogs: boolean;
  upstreamBaseUrl: string;
  upstreamApiKey: string;
  bufferStreaming: boolean;
  cacheTtlMs: number;
  fallbackModels: string[];
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseCsvEnv(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function loadConfig(): ProxyConfig {
  const upstreamApiKey =
    process.env.UPSTREAM_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "";

  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: parseIntEnv(process.env.PORT, 8787),
    logLevel: process.env.LOG_LEVEL ?? "info",
    simpleRequestLogs: parseBoolEnv(process.env.SIMPLE_REQUEST_LOGS, true),
    upstreamBaseUrl: normalizeUpstreamBaseUrl(
      process.env.UPSTREAM_BASE_URL ?? "https://api.deepseek.com/v1",
    ),
    upstreamApiKey,
    bufferStreaming: parseBoolEnv(process.env.BUFFER_STREAMING, true),
    cacheTtlMs: parseIntEnv(process.env.CACHE_TTL_MS, 30 * 60 * 1000),
    fallbackModels: parseCsvEnv(process.env.UPSTREAM_MODELS, [
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ]),
  };
}
