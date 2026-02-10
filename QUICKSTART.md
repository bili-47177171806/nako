# 表情包检索快速开始

## 快速部署（5 分钟）

### 1. 创建 Vectorize 索引

```bash
npx wrangler vectorize create sticker-embeddings --dimensions=1024 --metric=cosine
```

### 2. 准备数据

```bash
npm run prepare-stickers
```

### 3. 上传向量

```bash
export CLOUDFLARE_ACCOUNT_ID="你的账户ID"
export CLOUDFLARE_API_TOKEN="你的API令牌"
npm run upload-vectors
```

### 4. 部署

```bash
npm run deploy
```

## 测试

### 本地测试搜索

```bash
npm run test-search
```

### API 测试

```bash
curl -X POST https://your-worker.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test",
    "message": "好开心啊！",
    "history": []
  }'
```

响应示例：
```json
{
  "success": true,
  "response": "哼...开心就好啦[stamp0004]",
  "usage": {...}
}
```

## 工作流程

```
用户消息
    ↓
生成 Embedding (Qwen)
    ↓
向量检索 (Vectorize) → Top 20 候选
    ↓
Rerank (Llama 3.2) → 评分排序
    ↓
返回 Top 1 表情包
```

## 关键文件

- `stickers.json` - 原始表情包数据
- `processed-stickers.json` - 预处理后的数据（自动生成）
- `src/services/sticker.ts` - 检索服务实现
- `wrangler.toml` - Vectorize 绑定配置

## 常见问题

**Q: 向量上传很慢？**
A: 正常，每个表情包需要调用 API 生成 embedding。约 1000 个表情包需要 5-10 分钟。

**Q: 如何更新表情包？**
A: 修改 `stickers.json` 后重新运行步骤 2-3。

**Q: 表情推荐不准确？**
A: 调整 `src/services/sticker.ts` 中的 `topK` 参数和评分权重。

**Q: 如何禁用表情推荐？**
A: 从 `wrangler.toml` 移除 `[[vectorize]]` 配置即可。

## 性能指标

- Embedding 生成: ~100ms
- 向量检索: ~50ms
- Rerank: ~200ms
- **总延迟**: ~350ms

## 下一步

查看 [STICKER_DEPLOYMENT.md](./STICKER_DEPLOYMENT.md) 了解详细配置和优化选项。
