import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LLMClient, LLMExtractionResult } from '../../domain/interfaces/LLMClient';
import { LLMExtractionError } from '../../shared/errors/LLMExtractionError';
import { ILogger } from '../../domain/interfaces/ILogger';

const DEFAULT_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * GeminiClient — implements LLMClient using Google Generative AI.
 * Uses structured JSON generation for reliable extraction.
 */
export class GeminiClient implements LLMClient {
  private readonly _model: GenerativeModel;

  constructor(apiKey: string, private readonly _logger: ILogger, modelName?: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this._model = genAI.getGenerativeModel({
      model: modelName ?? DEFAULT_MODEL,
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        candidateCount: 1,
      },
    });
  }

  async extract<T = unknown>(prompt: string): Promise<LLMExtractionResult<T>> {
    try {
      const result = await this._model.generateContent(prompt);
      const rawResponse = result.response.text();

      const data = this.parseJSON<T>(rawResponse);

      return { data, rawResponse };
    } catch (err) {
      if (err instanceof LLMExtractionError) throw err;
      const cause = err instanceof Error ? err : undefined;
      this._logger.error('Gemini extraction failed', cause);
      throw new LLMExtractionError('Failed to extract data from clinical text', cause);
    }
  }

  async analyze(prompt: string): Promise<string> {
    try {
      const result = await this._model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const cause = err instanceof Error ? err : undefined;
      this._logger.error('Gemini analysis failed', cause);
      throw new LLMExtractionError('Failed to analyze clinical text', cause);
    }
  }

  private parseJSON<T>(raw: string): T {
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new LLMExtractionError(
        `LLM returned invalid JSON: ${cleaned.slice(0, 100)}`
      );
    }
  }
}
