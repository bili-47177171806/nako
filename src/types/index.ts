// Request types
export interface HistoryMessage {
  userId: string;
  message: string;
  isBot: boolean;
}

export interface ChatRequest {
  userId: string;
  message: string;
  history?: HistoryMessage[];
  stream?: boolean;  // Enable streaming response
}

// Response types
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatSuccessResponse {
  success: true;
  response: string;
  reasoningContent?: string;  // Optional reasoning/thinking process
  usage: TokenUsage;
}

export interface ChatErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ChatResponse = ChatSuccessResponse | ChatErrorResponse;

// AI Service types
export interface AIResponse {
  response: string;
  reasoningContent?: string;  // Optional reasoning/thinking process
  usage: TokenUsage;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Environment bindings
export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ENVIRONMENT?: string;
}
