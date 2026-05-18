import "dotenv/config";

import Fastify from "fastify";

import { ReasoningCache } from "./cache/reasoningCache.js";
import { loadConfig } from "./env.js";
import { registerChatCompletionsRoute } from "./routes/chatCompletions.js";
import { registerModelsRoute } from "./routes/models.js";
import { simpleLog } from "./utils/simpleLog.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  const reasoningCache = new ReasoningCache(config.cacheTtlMs);
  setInterval(() => reasoningCache.sweep(), config.cacheTtlMs).unref();

  app.addHook("onRequest", async (request) => {
    (request.raw as { __proxyStartAtNs?: bigint }).__proxyStartAtNs = process.hrtime.bigint();
    simpleLog(config.simpleRequestLogs, "http.request", {
      id: request.id,
      method: request.method,
      path: request.url,
      ip: request.ip,
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAtNs = (request.raw as { __proxyStartAtNs?: bigint }).__proxyStartAtNs;
    const durationMs =
      startedAtNs !== undefined ? Number(process.hrtime.bigint() - startedAtNs) / 1_000_000 : undefined;

    simpleLog(config.simpleRequestLogs, "http.response", {
      id: request.id,
      method: request.method,
      path: request.url,
      status: reply.statusCode,
      duration_ms: durationMs !== undefined ? durationMs.toFixed(1) : undefined,
    });
  });

  app.get("/healthz", async () => ({
    ok: true,
    upstream_base_url: config.upstreamBaseUrl,
    buffered_streaming: config.bufferStreaming,
  }));

  await registerModelsRoute(app, config);
  await registerChatCompletionsRoute(app, {
    config,
    cache: reasoningCache,
  });

  const address = await app.listen({
    host: config.host,
    port: config.port,
  });
  app.log.info({ address }, "DeepSeek compatibility proxy listening");
  simpleLog(config.simpleRequestLogs, "proxy.ready", {
    address,
    buffered_streaming: config.bufferStreaming,
    upstream_base_url: config.upstreamBaseUrl,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
