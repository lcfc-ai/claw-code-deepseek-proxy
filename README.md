# DeepSeek Compat Proxy

一个给 `claw-code` 使用的 OpenAI 兼容代理，用来把 DeepSeek V4 接到 `claw-code` 上，尽量不去改主项目代码。

这个项目主要解决 `claw-code` 直连 DeepSeek 时常见的几个兼容性问题，比如：

- 自动为 `deepseek-v4-*` 请求补上 `thinking: { "type": "enabled" }`
- 尽量恢复 assistant 历史消息里的 `reasoning_content`
- 把上游非流式结果重放成更稳定的 OpenAI 风格 SSE
- 提供 `GET /healthz`、`GET /v1/models`、`POST /v1/chat/completions`

## 适用场景

如果你希望继续按 OpenAI 兼容接口来使用 `claw-code`，但实际模型想走 DeepSeek V4，那么这个代理就是中间层。

`claw-code`
-> OpenAI-compatible API
-> 本代理
-> DeepSeek API

## 功能说明

- 自动识别 `deepseek-v4-pro`、`deepseek-v4-flash` 等模型名
- 支持 `openai/deepseek-v4-pro` 这种带 provider 前缀的写法
- 对 `stream=true` 请求默认启用缓冲兼容模式
- 控制台默认输出简洁日志，不打印完整 prompt 和 API Key
- `/v1/models` 优先转发上游，失败时回退到本地配置的模型列表

## 已知限制

- 当前主要针对文本和 tool-call 场景做兼容
- 缓冲流式模式会牺牲一点首 token 延迟，换取更稳的兼容性
- reasoning 缓存只保存在内存中，进程重启后会丢失

## 环境要求

- Node.js 20+
- 一个可用的 DeepSeek API Key

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 复制配置文件

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Windows cmd:

```bat
copy .env.example .env
```

### 3. 修改 `.env`

最少需要把 `UPSTREAM_API_KEY` 配好：

```ini
HOST=127.0.0.1
PORT=8787
UPSTREAM_BASE_URL=https://api.deepseek.com/v1
UPSTREAM_API_KEY=your_deepseek_key
BUFFER_STREAMING=true
SIMPLE_REQUEST_LOGS=true
UPSTREAM_MODELS=deepseek-v4-pro,deepseek-v4-flash
```

说明：

- `UPSTREAM_API_KEY` 是首选配置
- 如果没填，程序也会尝试读取 `DEEPSEEK_API_KEY`
- 再不行会继续尝试 `OPENAI_API_KEY`

### 4. 启动代理

开发模式：

```bash
npm run start:src
```

构建后启动：

```bash
npm run build
npm start
```

Windows 下也可以直接双击或执行仓库根目录里的：

```bat
start-deepseek-proxy.cmd
```

这个脚本会做几件事：

- 如果 `.env` 不存在，就从 `.env.example` 复制一份
- 如果 `UPSTREAM_API_KEY` 为空，会直接提示并退出
- 如果 `node_modules` 不存在，会自动执行 `npm install`
- 如果 `dist/server.js` 不存在，会自动执行 `npm run build`
- 最后启动 `node dist/server.js`

如果仓库根目录下有 `runtime\node.exe`，脚本会优先使用这个内置 Node 运行时，而不是系统里的 `node`

### 5. 检查服务是否正常

启动后默认监听：

```text
http://127.0.0.1:8787
```

健康检查：

```text
http://127.0.0.1:8787/healthz
```

如果服务正常，你会拿到类似这样的返回：

```json
{
  "ok": true,
  "upstream_base_url": "https://api.deepseek.com/v1",
  "buffered_streaming": true
}
```

## 如何接到 `claw-code`

启动好代理后，把 `claw-code` 指向本地代理地址即可。

PowerShell 示例：

```powershell
$env:OPENAI_BASE_URL="http://127.0.0.1:8787/v1"
$env:OPENAI_API_KEY="local-proxy"
claw --model "openai/deepseek-v4-pro"
```

也可以用：

```powershell
claw --model "openai/deepseek-v4-flash"
```

说明：

- 这里的 `OPENAI_API_KEY` 只是给本地代理占位用，可以随便填一个非空值，比如 `local-proxy`
- 真正发给 DeepSeek 的密钥来自代理进程里的 `UPSTREAM_API_KEY`
- 虽然也支持直接写 `deepseek-v4-pro`，但更推荐 `openai/deepseek-v4-pro` 这种形式，兼容性更稳

## 可用接口

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

## 配置项

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 本地监听地址 |
| `PORT` | `8787` | 本地监听端口 |
| `UPSTREAM_BASE_URL` | `https://api.deepseek.com/v1` | 上游 DeepSeek 兼容接口地址 |
| `UPSTREAM_API_KEY` | 空 | 上游 API Key，优先使用 |
| `DEEPSEEK_API_KEY` | 空 | `UPSTREAM_API_KEY` 未设置时的回退 |
| `OPENAI_API_KEY` | 空 | 前两者都未设置时的最终回退 |
| `BUFFER_STREAMING` | `true` | 是否把流式请求转换成缓冲后再重放 |
| `CACHE_TTL_MS` | `1800000` | reasoning 缓存保留时长，单位毫秒 |
| `LOG_LEVEL` | `info` | Fastify 日志级别 |
| `SIMPLE_REQUEST_LOGS` | `true` | 是否输出简洁请求日志 |
| `UPSTREAM_MODELS` | `deepseek-v4-pro,deepseek-v4-flash` | `/v1/models` 回退时返回的模型列表 |

## 打包给别的机器使用

如果你要把它作为一个便携目录发给别人，通常至少需要带上这些内容：

- `dist/`
- `node_modules/`
- `.env`
- `start-deepseek-proxy.cmd`
- 可选的 `runtime/node.exe`

这样对方即使没有全局安装 Node.js，也可以直接通过启动脚本运行。

## 常见说明

### 1. 为什么默认开启 `BUFFER_STREAMING=true`

因为某些客户端在处理 DeepSeek 的流式响应时兼容性不够稳定。这个代理会先拿完整结果，再按 OpenAI 风格 SSE 重放给客户端，通常更稳。

### 2. `/v1/models` 返回的是哪里来的

优先去请求上游 DeepSeek 的 `models` 接口；如果失败，就回退到 `UPSTREAM_MODELS` 里配置的模型列表。

### 3. 为什么日志里看不到完整 prompt

这是刻意设计的。默认日志只打印摘要信息，例如路径、模型、状态码、耗时，避免把完整请求内容和密钥直接打到控制台里。

## License

如果你准备公开发布，可以在这里补充许可证信息。
