import type { Env } from "./types";
import { handleChat } from "./handlers/chat";
import { handleRecommend } from "./handlers/recommend";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Route to chat handler
    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    // Route to recommend handler (GET or POST)
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/recommend") {
      return handleRecommend(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
