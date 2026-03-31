/**
 * LLMClient — port interface for AI extraction.
 * Decouples domain logic from any specific LLM provider (Gemini, GPT-4, etc.)
 */
export interface LLMExtractionResult<T = unknown> {
  data: T;
  rawResponse: string;
  tokensUsed?: number;
}

export interface LLMClient {
  extract<T = unknown>(
    prompt: string,
    responseSchema?: object
  ): Promise<LLMExtractionResult<T>>;

  analyze(prompt: string): Promise<string>;
}
