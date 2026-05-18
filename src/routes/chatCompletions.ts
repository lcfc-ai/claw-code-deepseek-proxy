import type { FastifyInstance } from "fastify";

import { ReasoningCache } from "../cache/reasoningCache.js";
import type { ProxyConfig } from "../env.js";
import { writeBufferedCompletionAsSse } from "../stream/sse.js";
import type { ChatCompletionsRequest, ChatCompletionsResponse } from "../types/openai.js";
import { prepareUpstreamRequest, requestSummary } from "../transform/request.js";
import { rememberReasoningFromResponse, responseSummary } from "../transform/response.js";
import { simpleLog } from "../utils/simpleLog.js";
import { upstreamEndpoint, upstreamHeaders } from "../utils/upstream.js";

interface ChatRouteDeps {
  config: ProxyConfig;
  cache: ReasoningCache;
}

export async function registerChatCompletionsRoute(
  app: FastifyInstance,
  deps: ChatRouteDeps,
): Promise<void> {
  app.post("/v1/chat/completions", async (request, reply) => {
    const body = request.body as ChatCompletionsRequest | undefined;

    if (!body || typeof body !== "object" || typeof body.model !== "string" || !Array.isArray(body.messages)) {
      return reply.code(400).send({
        error: {
          message: "Expected an OpenAI-compatible chat completions payload.",
          type: "invalid_request_error",
        },
      });
    }

    const prepared = prepareUpstreamRequest(body, deps.cache, deps.config.bufferStreaming);
    const startedAtNs = process.hrtime.bigint();
    const clientRequest = requestSummary(body);
    const upstreamRequest = requestSummary(prepared.upstreamRequest);

    app.log.info(
      {
        client_request: clientRequest,
        upstream_request: upstreamRequest,
        buffered_streaming: deps.config.bufferStreaming,
        deepseek_v4: prepared.deepSeekV4,
      },
      "Proxying chat completion",
    );
    simpleLog(deps.config.simpleRequestLogs, "chat.request", {
      id: request.id,
      model: body.model,
      upstream_model: prepared.upstreamRequest.model,
      stream: body.stream === true,
      buffered: deps.config.bufferStreaming,
      messages: Number(clientRequest.message_count),
      tools: Number(clientRequest.tool_count),
      deepseek_v4: prepared.deepSeekV4,
    });

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamEndpoint(deps.config.upstreamBaseUrl, "chat/completions"), {
        method: "POST",
        headers: upstreamHeaders(deps.config.upstreamApiKey),
        body: JSON.stringify(prepared.upstreamRequest),
      });
    } catch (error) {
      app.log.error({ err: error }, "Upstream chat completion request errored");
      simpleLog(deps.config.simpleRequestLogs, "chat.upstream_error", {
        id: request.id,
        model: prepared.upstreamRequest.model,
        detail: "network_error",
      });
      return reply.code(502).send({
        error: {
          message: "Failed to reach the upstream DeepSeek-compatible endpoint.",
          type: "bad_gateway",
        },
      });
    }

    const rawText = await upstreamResponse.text();
    let upstreamJson: unknown = null;
    if (rawText.length > 0) {
      try {
        upstreamJson = JSON.parse(rawText);
      } catch {
        upstreamJson = null;
      }
    }

    if (!upstreamResponse.ok) {
      const upstreamMessage =
        upstreamJson &&
        typeof upstreamJson === "object" &&
        "error" in upstreamJson &&
        upstreamJson.error &&
        typeof upstreamJson.error === "object" &&
        "message" in upstreamJson.error &&
        typeof upstreamJson.error.message === "string"
          ? upstreamJson.error.message
          : undefined;

      app.log.warn(
        {
          status: upstreamResponse.status,
          response_body: upstreamJson ?? rawText,
        },
        "Upstream chat completion failed",
      );
      simpleLog(deps.config.simpleRequestLogs, "chat.upstream_failed", {
        id: request.id,
        model: prepared.upstreamRequest.model,
        status: upstreamResponse.status,
        detail: upstreamMessage?.slice(0, 160) ?? "upstream_error",
      });

      return reply
        .code(upstreamResponse.status)
        .send(
          upstreamJson ?? {
            error: {
              message: rawText || "Upstream request failed.",
              type: "upstream_error",
            },
          },
        );
    }

    if (!upstreamJson || typeof upstreamJson !== "object") {
      return reply.code(502).send({
        error: {
          message: "Upstream returned a non-JSON success response.",
          type: "bad_gateway",
        },
      });
    }

    const completion = upstreamJson as ChatCompletionsResponse;
    rememberReasoningFromResponse(completion, deps.cache);
    app.log.info({ upstream_response: responseSummary(completion) }, "Upstream chat completion succeeded");
    simpleLog(deps.config.simpleRequestLogs, "chat.upstream_ok", {
      id: request.id,
      model: completion.model ?? prepared.upstreamRequest.model,
      status: upstreamResponse.status,
      choices: Array.isArray(completion.choices) ? completion.choices.length : 0,
      duration_ms: (Number(process.hrtime.bigint() - startedAtNs) / 1_000_000).toFixed(1),
    });

    if (prepared.clientRequestedStream && deps.config.bufferStreaming) {
      reply.hijack();
      simpleLog(deps.config.simpleRequestLogs, "chat.buffered_sse", {
        id: request.id,
        model: completion.model ?? prepared.upstreamRequest.model,
      });
      writeBufferedCompletionAsSse(reply.raw, completion);
      return reply;
    }

    return reply.send(completion);
  });
}
