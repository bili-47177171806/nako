# 表情包检索系统部署指南

本项目使用 Cloudflare Vectorize 和 Workers AI 实现表情包的智能检索和推荐。

## 架构说明

- **Embedding 模型**: `@cf/qwen/qwen3-embedding-0.6b` - 用于生成文本向量
- **Rerank 模型**: `@cf/meta/llama-3.2-3b-instruct` - 用于重排序提高相关性
- **向量数据库**: Cloudflare Vectorize
- **标识符**: 使用 `assetbundleName` 而非 ID

## 部署步骤

### 1. 创建 Vectorize 索引

首先创建向量索引（维度为 1024，对应 Qwen embedding 模型）：

```bash
npx wrangler vectorize create sticker-embeddings \
  --dimensions=1024 \
  --metric=cosine
```

### 2. 预处理表情包数据

运行预处理脚本提取可搜索文本：

```bash
npx tsx scripts/prepare-stickers.ts
```

这会生成 `processed-stickers.json` 文件。

### 3. 上传向量数据

设置环境变量并上传：

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"

npx tsx scripts/upload-vectors.ts
```

这个过程会：
- 为每个表情包生成 embedding
- 批量上传到 Vectorize
- 使用 `assetbundleName` 作为向量 ID

### 4. 部署 Worker

```bash
npm run deploy
```

## API 使用

### 聊天接口

```bash
POST /api/chat
Content-Type: application/json

{
  "userId": "user123",
  "message": "好开心啊！",
  "history": [
    {
      "userId": "user123",
      "message": "今天天气真好",
      "isBot": false
    }
  ]
}
```

### 响应格式

```json
{
  "success": true,
  "response": "是啊！今天真是个好日子呢～",
  "sticker": "stamp0004",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 50,
    "totalTokens": 200
  }
}
```

`sticker` 字段包含推荐的表情包 `assetbundleName`。

## 工作原理

### 1. Embedding 检索

用户消息 → Qwen Embedding → 向量查询 → 获取 Top 20 候选

### 2. Rerank 重排序

候选表情包 → Llama 3.2 评分 → 综合排序 → 返回 Top 5

### 3. 评分策略

最终分数 = Rerank 分数 × 0.7 + 向量相似度 × 0.3

## 数据结构

### 表情包元数据

```typescript
{
  assetbundleName: string;  // 主键标识符
  stickerId: number;        // 原始 ID
  name: string;             // 表情名称
  description: string;      // 描述
  characterId: number;      // 角色 ID
  stampType: string;        // 类型
}
```

### 向量记录

```typescript
{
  id: "stamp0001",          // assetbundleName
  values: number[],         // 1024 维向量
  metadata: { ... }         // 表情包元数据
}
```

## 性能优化

- 批量上传：每次 100 条记录
- 候选扩展：检索 4x 候选数用于 rerank
- 上下文限制：仅使用最近 5 条历史消息
- 错误容错：表情推荐失败不影响主功能

## 注意事项

1. **使用 assetbundleName**: 所有表情包引用都使用 `assetbundleName` 而非数字 ID
2. **ID 映射**: 如需使用 ID，需要从 `stickers.json` 建立映射关系
3. **向量维度**: 必须与 Qwen embedding 模型输出维度一致（1024）
4. **API 限额**: 注意 Cloudflare Workers AI 的调用限额

## 故障排查

### 向量上传失败

检查：
- Account ID 和 API Token 是否正确
- Vectorize 索引是否已创建
- 网络连接是否正常

### 表情推荐不准确

调整：
- 增加候选数量（修改 `topK * 4`）
- 调整评分权重（修改 0.7/0.3 比例）
- 优化 rerank prompt

### 性能问题

优化：
- 减少候选数量
- 缓存常用查询结果
- 使用更快的 embedding 模型
