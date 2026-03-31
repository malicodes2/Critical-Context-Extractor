import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { TemporalAnalysisService, SymptomOccurrence } from '../../../domain/services/TemporalAnalysisService';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { toISOString } from '../../../shared/utils/DateUtils';
import { truncate } from '../../../shared/utils/StringUtils';
import { SYMPTOM_EXTRACTION_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import { DetectPatternAnomaliesRequest } from './DetectPatternAnomaliesRequest';
import {
  DetectPatternAnomaliesResponse,
  SymptomPatternResult,
} from './DetectPatternAnomaliesResponse';

/**
 * DetectPatternAnomaliesUseCase — Tool 3
 * Finds recurring symptoms that appear multiple times but were never fully investigated.
 */
export class DetectPatternAnomaliesUseCase {
  private readonly _temporalService = new TemporalAnalysisService();

  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: DetectPatternAnomaliesRequest,
    fhirToken?: string
  ): Promise<DetectPatternAnomaliesResponse> {
    const startTime = Date.now();
    const minOccurrences = request.minimumOccurrences ?? 3;
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Detecting pattern anomalies', {
      patientId: request.patientId,
    });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const notes = [...patient.getNotes()];
    const allOccurrences: SymptomOccurrence[] = [];

    for (const note of notes) {
      const symptoms = await this.extractSymptoms(note.text, note.id);
      for (const symptom of symptoms) {
        allOccurrences.push({ symptom, date: note.date, noteId: note.id });
      }
    }

    const patterns = this._temporalService.detectPatterns(allOccurrences, minOccurrences);

    const results: SymptomPatternResult[] = patterns.map((p) => ({
      symptom: p.symptom,
      occurrenceCount: p.occurrences.length,
      firstSeen: toISOString(p.occurrences[0].date),
      lastSeen: toISOString(p.occurrences[p.occurrences.length - 1].date),
      frequency: p.frequency,
      averageIntervalDays: p.averageIntervalDays,
      noteIds: p.occurrences.map((o) => o.noteId),
      alertLevel: p.occurrences.length >= 5 ? AlertLevelValue.WARNING : AlertLevelValue.INFO,
      clinicalSignificance: `Recurring ${p.symptom} (${p.occurrences.length}x, avg every ${p.averageIntervalDays} days) — investigate if not previously worked up.`,
    }));

    return {
      patterns: results,
      metadata: {
        notesAnalyzed: notes.length,
        uniqueSymptomsFound: new Set(allOccurrences.map((o) => o.symptom)).size,
        recurringPatterns: results.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private async extractSymptoms(noteText: string, noteId: string): Promise<string[]> {
    try {
      const prompt = SYMPTOM_EXTRACTION_PROMPT(truncate(noteText, 3000));
      const result = await this._llmClient.extract<string[]>(prompt);
      return Array.isArray(result.data) ? result.data : [];
    } catch {
      this._logger.warn('Failed to extract symptoms from note', { noteId });
      return [];
    }
  }
}
