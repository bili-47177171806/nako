import type { Env, HistoryMessage, AIResponse } from "../types";
import { getNakoSystemPrompt, AI_CONFIG } from "../config/persona";

function formatHistory(history: HistoryMessage[]): string {
  if (!history || history.length === 0) return "";

  return history
    .slice(-30)  // Keep only last 30 messages
    .map(msg => {
      const name = msg.isBot ? "Nako" : msg.userId;
      return `[${name}]: ${msg.message}`;
    })
    .join("\n");
}

export async function generateNakoResponse(
  ai: Ai,
  userMessage: string,
  userId: string,
  history: HistoryMessage[],
  stream: boolean = false
): Promise<AIResponse | ReadableStream> {
  const historyContext = formatHistory(history);

  const messages = [
    { role: "system", content: getNakoSystemPrompt() },
    {
      role: "user",
      content: historyContext
        ? `${historyContext}\n[${userId}]: ${userMessage}`
        : `[${userId}]: ${userMessage}`
    }
  ];

  if (stream) {
    // Return streaming response
    const streamResponse = await ai.run(AI_CONFIG.model, {
      messages,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
      top_p: AI_CONFIG.topP,
      frequency_penalty: AI_CONFIG.frequencyPenalty,
      presence_penalty: AI_CONFIG.presencePenalty,
      stream: true,
    }) as ReadableStream;

    return streamResponse;
  } else {
    // Return complete response
    const result = await ai.run(AI_CONFIG.model, {
      messages,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
      top_p: AI_CONFIG.topP,
      frequency_penalty: AI_CONFIG.frequencyPenalty,
      presence_penalty: AI_CONFIG.presencePenalty,
    }) as any;

    // Extract response text from Chat Completion Response format
    const responseText = result.choices?.[0]?.message?.content || "";
    const reasoningContent = result.choices?.[0]?.message?.reasoning_content;

    return {
      response: responseText,
      reasoningContent: reasoningContent || undefined,
      usage: {
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        totalTokens: result.usage?.total_tokens || 0,
      }
    };
  }
}
