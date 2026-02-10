# Nightcord Nako Chatbot API

<div align="center">

![GitHub License](https://img.shields.io/github/license/bili-47177171806/nako?style=flat-square&color=884499)
![GitHub stars](https://img.shields.io/github/stars/bili-47177171806/nako?style=flat-square&color=884499)
![GitHub forks](https://img.shields.io/github/forks/bili-47177171806/nako?style=flat-square&color=884499)
![GitHub issues](https://img.shields.io/github/issues/bili-47177171806/nako?style=flat-square&color=884499)
![GitHub last commit](https://img.shields.io/github/last-commit/bili-47177171806/nako?style=flat-square&color=884499)
![GitHub repo size](https://img.shields.io/github/repo-size/bili-47177171806/nako?style=flat-square&color=884499)
[![CodeFactor](https://img.shields.io/codefactor/grade/github/bili-47177171806/nako?style=flat-square&color=884499)](https://www.codefactor.io/repository/github/bili-47177171806/nako)

</div>

一个基于 Cloudflare Workers AI 的聊天机器人 API，具有动态人格系统和智能表情推荐功能。

## 功能

- **无状态设计**：不使用数据库，对话历史由前端传入
- **AI 模型**：使用 Cloudflare Workers AI 的 Qwen 3 30B 模型
- **响应模式**：支持流式（SSE）和非流式两种响应方式
- **表情推荐**：基于 Vectorize 向量搜索的表情包推荐功能
- **角色扮演**：基于预设人格配置生成对话回复
- **CORS 支持**：可直接从前端调用
- **TypeScript**：完整的类型定义

## API 接口

### POST /api/chat

发送消息给 Nako 并获取回复。

### POST /api/recommend

根据文本内容推荐表情包。

#### 非流式模式（默认）

**请求体：**
```json
{
  "userId": "UserA",
  "message": "今天天气真好啊",
  "history": [
    {
      "userId": "UserB",
      "message": "早上好",
      "isBot": false
    },
    {
      "userId": "Nako",
      "message": "哼...早什么早",
      "isBot": true
    }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "response": "哼,天气好又怎样...[stamp0004]",
  "reasoningContent": "思考过程（如果模型支持）",
  "usage": {
    "promptTokens": 411,
    "completionTokens": 187,
    "totalTokens": 598
  }
}
```

**响应格式说明：**
- `success`: 请求是否成功
- `response`: Nako 的回复文本，表情包以 `[stamp0004]` 格式嵌入在文本中
- `reasoningContent`: （可选）模型的内部推理过程（从 `choices[0].message.reasoning_content` 提取）
- `usage`: Token 使用统计
  - `promptTokens`: 输入 token 数（系统提示词 + 历史记录 + 用户消息）
  - `completionTokens`: 回复 token 数
  - `totalTokens`: 总 token 数

**注意：**
- 表情包通过向量搜索自动推荐，以 `[assetbundleName]` 格式插入回复文本末尾
- `reasoningContent` 字段仅在模型支持时返回，Qwen 3 30B 通常不支持此功能

#### 流式模式

**请求体：**
```json
{
  "userId": "UserA",
  "message": "今天天气真好啊",
  "stream": true,
  "history": []
}
```

**响应：**
Server-Sent Events (SSE) 流，`Content-Type: text/event-stream`

流式响应遵循 OpenAI Chat Completion 格式，每个数据块包含部分回复：

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"哼"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"，"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"天气"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"好"},"logprobs":null,"finish_reason":null}]}

data: [DONE]
```

**注意：** 表情包推荐会在流结束前作为额外的 chunk 追加到回复末尾。

### POST /api/recommend

根据文本提示推荐表情包。

**请求体：**
```json
{
  "prompt": "好开心啊",
  "excludeRecent": ["之前的消息1", "之前的消息2[stamp0001]"],
  "topK": 5
}
```

**参数：**
- `prompt` (必需): 用于搜索匹配表情包的文本描述
- `excludeRecent` (可选): 最近消息数组，用于提取并排除已使用的表情包
- `topK` (可选): 返回的表情包数量（1-20，默认：5）

**响应：**
```json
{
  "success": true,
  "stickers": [
    {
      "assetbundleName": "stamp0004",
      "name": "流歌：好开心啊",
      "score": 0.8234
    },
    {
      "assetbundleName": "stamp0123",
      "name": "铃：一起加油吧～！",
      "score": 0.7891
    },
    {
      "assetbundleName": "stamp0456",
      "name": "未来：请多关照",
      "score": 0.7654
    }
  ],
  "query": "好开心啊"
}
```

**字段说明：**
- `assetbundleName`: 表情包标识符
- `name`: 表情包显示名称
- `score`: 相似度分数（0-1，越高越匹配）

**示例（POST）：**
```bash
curl -X POST https://your-worker.workers.dev/api/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "开心快乐",
    "topK": 3
  }'
```

### GET /api/recommend

使用查询参数的 GET 方式，功能与 POST 相同。

**查询参数：**
- `prompt` (必需): 文本描述
- `topK` (可选): 返回结果数量（1-20，默认：5）
- `excludeRecent` (可选): 逗号分隔的最近消息列表

**示例（GET）：**
```bash
curl "https://your-worker.workers.dev/api/recommend?prompt=开心快乐&topK=3"
```

**带排除项：**
```bash
curl "https://your-worker.workers.dev/api/recommend?prompt=开心&excludeRecent=之前用过[stamp0001],另一条消息"
```

## 开发

### 环境要求

- Node.js 18+
- Cloudflare 账号（需开通 Workers AI）

### 本地开发

1. 克隆仓库：
```bash
git clone https://github.com/bili-47177171806/nako.git
cd nako
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
```bash
# 复制示例配置
cp .env.example .env
cp wrangler.jsonc.example wrangler.jsonc

# 编辑 .env 填入你的 Cloudflare 配置
# 编辑 wrangler.jsonc 配置你的域名（可选）
```

4. 启动本地服务：
```bash
npm run dev
```

5. 测试 API：

**非流式：**
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TestUser",
    "message": "你好啊Nako",
    "history": []
  }'
```

**流式：**
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TestUser",
    "message": "你好啊Nako",
    "stream": true,
    "history": []
  }'
```

### 部署

部署到 Cloudflare Workers：
```bash
npm run deploy
```

表情包搜索功能的详细配置说明见 [STICKER_DEPLOYMENT.md](./STICKER_DEPLOYMENT.md)。

## 项目结构

```
nightcord-nako/
├── src/
│   ├── index.ts              # Worker 入口
│   ├── handlers/
│   │   ├── chat.ts           # 聊天请求处理
│   │   └── recommend.ts      # 表情推荐处理
│   ├── services/
│   │   ├── ai.ts             # AI 服务封装
│   │   └── sticker.ts        # 表情搜索服务
│   ├── config/
│   │   └── persona.ts        # Nako 系统提示词
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   └── utils/
│       ├── validation.ts     # 请求验证
│       └── response.ts       # 响应格式化
├── scripts/
│   ├── prepare-stickers.ts   # 预处理表情数据
│   ├── upload-vectors.ts     # 上传到 Vectorize
│   └── test-search.ts        # 本地测试搜索
├── wrangler.toml             # Cloudflare Workers 配置
├── stickers.json             # 表情数据库
├── package.json
├── tsconfig.json
├── README.md
└── STICKER_DEPLOYMENT.md     # 表情配置指南
```

## 配置说明

### AI 参数

- **模型**: `@cf/qwen/qwen3-30b-a3b-fp8`
- **Temperature**: 0.7
- **Max Tokens**: 1024
- **Top P**: 0.85
- **Frequency Penalty**: 0.15
- **Presence Penalty**: 0.2

### Cloudflare Workers AI 响应格式

API 使用 Cloudflare Workers AI，返回 OpenAI 兼容格式：

**非流式响应：**
```json
{
  "id": "completion-id",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "@cf/qwen/qwen3-30b-a3b-fp8",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "哼,天气好又怎样..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 411,
    "completion_tokens": 187,
    "total_tokens": 598
  }
}
```

API 提取 `choices[0].message.content` 并封装为简化的响应格式。

**流式响应：**
直接返回 Cloudflare Workers AI 的原始 Server-Sent Events (SSE) 流。

### 角色系统

聊天机器人的人格配置特点：
- **动态人格**：根据时间段（凌晨/早上/下午/晚上）自动调整对话风格
- **多样化语气**：支持多种对话模式随机切换，避免回复单调
- **上下文感知**：基于对话历史生成连贯的回复
- **状态系统**：随机生成当前状态和话题，增加对话真实感
- **自然对话**：模拟真实聊天场景，语气轻松自然

## 许可证

MIT
