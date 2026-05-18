export function normalizeUpstreamBaseUrl(value: string): string {
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname === "" || pathname === "/") {
    url.pathname = "/v1/";
    return url.toString();
  }

  if (pathname.endsWith("/chat/completions")) {
    url.pathname = `${pathname.slice(0, -"/chat/completions".length)}/`;
    return url.toString();
  }

  if (pathname.endsWith("/models")) {
    url.pathname = `${pathname.slice(0, -"/models".length)}/`;
    return url.toString();
  }

  url.pathname = `${pathname}/`;
  return url.toString();
}

export function upstreamEndpoint(baseUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), baseUrl).toString();
}

export function upstreamHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (apiKey.trim().length > 0) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}
