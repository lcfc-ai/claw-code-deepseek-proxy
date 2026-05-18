# DeepSeek Compat Proxy

Small OpenAI-compatible proxy for using `claw-code` with DeepSeek V4 models without patching the main Rust codebase.

It focuses on the failure modes discussed in:

- `ultraworkers/claw-code#3005`
- `ultraworkers/claw-code#3011`
- `ultraworkers/claw-code#2982`
- `ultraworkers/claw-code#3032`

## What it does

- Adds `thinking: { "type": "enabled" }` for `deepseek-v4-*` requests.
- Repairs assistant history by restoring `reasoning_content` when possible.
- Defaults to a buffered compatibility mode for `stream=true` requests:
  - upstream call is sent as non-streaming
  - proxy replays a stable OpenAI-style SSE stream back to the client
- Exposes a lightweight `/healthz` and `/v1/models`.
- Prints simple console request logs by default.

## Limits

- First version is tuned for text + tool-call flows, not multimodal payloads.
- Buffered streaming trades first-token latency for compatibility.
- Reasoning cache is in-memory only.

## Quick start

```bash
cd deepseek-compat-proxy
npm install
cp .env.example .env
```

Edit `.env`:

```ini
UPSTREAM_BASE_URL=https://api.deepseek.com/v1
UPSTREAM_API_KEY=your-deepseek-key
PORT=8787
SIMPLE_REQUEST_LOGS=true
```

Run from source:

```bash
npm run start:src
```

Build:

```bash
npm run build
```

Run built output:

```bash
npm run start
```

Then point `claw-code` at the proxy.

PowerShell:

```powershell
$env:OPENAI_BASE_URL="http://127.0.0.1:8787/v1"
$env:OPENAI_API_KEY="local-proxy"
claw --model "openai/deepseek-v4-pro"
```

The proxy also accepts the bare model name `deepseek-v4-pro`, but the `openai/` prefix is safer when your shell has multiple provider credentials loaded.

## Windows cmd helpers

From the repo root there are three helper scripts:

```bat
scripts\start-deepseek-proxy.cmd
scripts\start-claw-deepseek-proxy.cmd
scripts\start-deepseek-stack.cmd
```

The last one opens the proxy in a separate window, waits for `/healthz`, and then launches `claw` against the proxy.

There is also a local launcher kept next to the build output:

```bat
deepseek-compat-proxy\start-deepseek-proxy.cmd
```

It installs dependencies when needed, builds `dist\` when missing, and starts `node dist\server.js`.

## Customer machines without Node.js installed

The current project can be delivered as a portable folder so the customer does not need a system-wide Node.js install.

Package it with:

- `dist\`
- `node_modules\`
- `.env`
- `start-deepseek-proxy.cmd`
- `runtime\node.exe`

The local launcher already prefers `runtime\node.exe` when present.

From the repo root you can assemble that folder with:

```bat
scripts\package-deepseek-proxy.cmd
```

By default this writes the portable proxy to:

```text
out\proxy
```

## Endpoints

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

## Notes

- If you want the proxy to forward `GET /v1/models` to DeepSeek, set a valid upstream key.
- If upstream `models` fetch fails, the proxy falls back to `UPSTREAM_MODELS`.
- Request logs are intentionally summary-only: model, path, counts, status, and latency. They do not print your API key or full prompt text.
