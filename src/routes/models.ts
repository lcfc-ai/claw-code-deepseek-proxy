import type { FastifyInstance } from "fastify";

import type { ProxyConfig } from "../env.js";
import type { ModelListResponse } from "../types/openai.js";
import { fallbackModelsResponse } from "../transform/response.js";
import { upstreamEndpoint, upstreamHeaders } from "../utils/upstream.js";

export async function registerModelsRoute(
  app: FastifyInstance,
  config: ProxyConfig,
): Promise<void> {
  app.get("/v1/models", async (_request, reply) => {
    try {
      const upstreamResponse = await fetch(upstreamEndpoint(config.upstreamBaseUrl, "models"), {
        method: "GET",
        headers: upstreamHeaders(config.upstreamApiKey),
      });

      if (upstreamResponse.ok) {
        const body = (await upstreamResponse.json()) as ModelListResponse;
        return reply.send(body);
      }
    } catch (error) {
      app.log.warn({ err: error }, "Upstream models fetch failed, falling back to configured models");
    }

    return reply.send(fallbackModelsResponse(config.fallbackModels));
  });
}
