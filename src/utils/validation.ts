import type { ValidationResult } from "../types";

export function validateChatRequest(body: any): ValidationResult {
  if (!body.userId || typeof body.userId !== "string") {
    return { valid: false, error: "Missing or invalid userId" };
  }

  if (!body.message || typeof body.message !== "string") {
    return { valid: false, error: "Missing or invalid message" };
  }

  if (body.message.length > 2000) {
    return { valid: false, error: "Message too long (max 2000 characters)" };
  }

  if (body.history && !Array.isArray(body.history)) {
    return { valid: false, error: "History must be an array" };
  }

  return { valid: true };
}
