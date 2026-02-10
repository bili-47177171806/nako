import type { Env, ChatRequest } from "../types";
import { validateChatRequest } from "../utils/validation";
import { createSuccessResponse, createErrorResponse } from "../utils/response";
import { generateNakoResponse } from "../services/ai";
import { getStickerRecommendation, insertStickerIntoMessage } from "../services/sticker";

export async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body
    let body: ChatRequest;
    try {
      body = await request.json() as ChatRequest;
    } catch (e) {
      return createErrorResponse("INVALID_JSON", "Invalid JSON in request body");
    }

    // Validate request
    const validation = validateChatRequest(body);
    if (!validation.valid) {
      return createErrorResponse("INVALID_REQUEST", validation.error!);
    }

    // Generate AI response
    const aiResponse = await generateNakoResponse(
      env.AI,
      body.message,
      body.userId,
      body.history || [],
      body.stream || false
    );

    // Handle streaming response
    if (body.stream) {
      // For streaming, pass through immediately and add sticker at the end
      return handleStreamingWithSticker(aiResponse as ReadableStream, env, body);
    }

    // Handle non-streaming response
    const response = aiResponse as import("../types").AIResponse;

    // Remove AI-generated sticker tags
    let cleanResponse = response.response.replace(/\[stamp\d+\]/g, '');

    // Get sticker recommendation (if VECTORIZE is available)
    let finalResponse = cleanResponse;
    if (env.VECTORIZE) {
      try {
        const recentMessages = body.history
          ?.slice(-10)
          .map(h => h.message) || [];

        const recommendedSticker = await getStickerRecommendation(
          env.AI,
          env.VECTORIZE,
          body.message,
          cleanResponse,
          recentMessages
        );

        if (recommendedSticker) {
          finalResponse = insertStickerIntoMessage(cleanResponse, recommendedSticker);
        }
      } catch (error) {
        console.error("Failed to get sticker recommendation:", error);
        // Continue without sticker
      }
    }

    return createSuccessResponse(finalResponse, response.usage, response.reasoningContent);

  } catch (error) {
    console.error("Error in handleChat:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "An internal error occurred",
      500
    );
  }
}

/**
 * Handle streaming response with sticker insertion
 * Strategy: Pass through stream immediately, append sticker at the end
 */
async function handleStreamingWithSticker(
  stream: ReadableStream,
  env: Env,
  body: ChatRequest
): Promise<Response> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let fullResponse = "";
  let buffer = "";

  const newStream = new ReadableStream({
    async start(controller) {
      try {
        // Pass through the original stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode and accumulate
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                // Don't forward [DONE] yet
                continue;
              }

              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }

          // Forward the original chunk
          controller.enqueue(value);
        }

        // Remove AI-generated sticker tags from response
        fullResponse = fullResponse.replace(/\[stamp\d+\]/g, '');

        // Now get sticker recommendation
        if (env.VECTORIZE && fullResponse) {
          try {
            const recentMessages = body.history
              ?.slice(-10)
              .map(h => h.message) || [];

            const recommendedSticker = await getStickerRecommendation(
              env.AI,
              env.VECTORIZE,
              body.message,
              fullResponse,
              recentMessages
            );

            if (recommendedSticker) {
              const stickerText = `[${recommendedSticker}]`;
              const stickerChunk = {
                id: "sticker-" + Date.now(),
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: "@cf/qwen/qwen3-30b-a3b-fp8",
                choices: [{
                  index: 0,
                  delta: { content: stickerText },
                  logprobs: null,
                  finish_reason: null
                }]
              };
              const sseData = `data: ${JSON.stringify(stickerChunk)}\n\n`;
              controller.enqueue(encoder.encode(sseData));
            }
          } catch (error) {
            console.error("Failed to get sticker recommendation:", error);
          }
        }

        // Send [DONE]
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });

  return new Response(newStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
