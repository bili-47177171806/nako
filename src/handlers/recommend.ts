import type { Env } from "../types";
import { createErrorResponse } from "../utils/response";
import { searchStickersWithScores, extractRecentStickers } from "../services/sticker";

interface RecommendRequest {
  prompt: string;
  excludeRecent?: string[];  // Recent messages to extract used stickers
  topK?: number;             // Number of stickers to return (default: 5)
}

interface StickerResult {
  assetbundleName: string;
  name: string;
  score: number;  // Similarity score (0-1)
}

interface RecommendResponse {
  success: true;
  stickers: StickerResult[];
  query: string;
}

export async function handleRecommend(request: Request, env: Env): Promise<Response> {
  try {
    // Check if VECTORIZE is available
    if (!env.VECTORIZE) {
      return createErrorResponse(
        "VECTORIZE_UNAVAILABLE",
        "Sticker recommendation service is not available",
        503
      );
    }

    let prompt: string;
    let topK: number;
    let excludeRecent: string[] | undefined;

    // Handle GET request (query parameters)
    if (request.method === "GET") {
      const url = new URL(request.url);
      const promptParam = url.searchParams.get("prompt");

      if (!promptParam || promptParam.trim().length === 0) {
        return createErrorResponse("INVALID_REQUEST", "prompt query parameter is required");
      }

      prompt = promptParam.trim();

      const topKParam = url.searchParams.get("topK");
      topK = topKParam ? parseInt(topKParam, 10) : 5;
      if (isNaN(topK) || topK < 1 || topK > 20) {
        topK = 5;
      }

      // excludeRecent can be passed as comma-separated values
      const excludeParam = url.searchParams.get("excludeRecent");
      if (excludeParam) {
        excludeRecent = excludeParam.split(",").map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    // Handle POST request (JSON body)
    else if (request.method === "POST") {
      let body: RecommendRequest;
      try {
        body = await request.json() as RecommendRequest;
      } catch (e) {
        return createErrorResponse("INVALID_JSON", "Invalid JSON in request body");
      }

      // Validate prompt
      if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
        return createErrorResponse("INVALID_REQUEST", "prompt is required and must be a non-empty string");
      }

      prompt = body.prompt.trim();
      topK = body.topK && body.topK > 0 && body.topK <= 20 ? body.topK : 5;
      excludeRecent = body.excludeRecent;
    } else {
      return createErrorResponse("METHOD_NOT_ALLOWED", "Only GET and POST methods are supported", 405);
    }

    // Extract recently used stickers to exclude
    let excludeIds: Set<string> | undefined;
    if (excludeRecent && Array.isArray(excludeRecent)) {
      excludeIds = extractRecentStickers(excludeRecent, 10);
    }

    // Search for stickers with scores
    const results = await searchStickersWithScores(
      env.AI,
      env.VECTORIZE,
      prompt,
      topK,
      excludeIds
    );

    const response: RecommendResponse = {
      success: true,
      stickers: results,
      query: prompt
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  } catch (error) {
    console.error("Error in handleRecommend:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "An internal error occurred",
      500
    );
  }
}
