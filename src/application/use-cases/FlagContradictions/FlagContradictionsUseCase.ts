import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { CONTRADICTION_DETECTION_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import { truncate } from '../../../shared/utils/StringUtils';

export type ContradictionType =
  | 'ALLERGY_MISMATCH'
  | 'MEDICATION_DISCREPANCY'
  | 'SURGICAL_HISTORY_CONFLICT'
  | 'DIAGNOSIS_INCONSISTENCY'
  | 'SOCIAL_HISTORY_CHANGE';

export interface Contradiction {
  type: ContradictionType;
  patientReported: string;
  documentedEvidence: string;
  contradictionDate: string;
  clinicalImpact: string;
  alertLevel: AlertLevelValue;
}

export interface FlagContradictionsRequest {
  patientId: string;
}

export interface FlagContradictionsResponse {
  contradictions: Contradiction[];
  metadata: {
    notePairsAnalyzed: number;
    contradictionsFound: number;
    processingTimeMs: number;
  };
}

interface LLMContradictionResult {
  isContradiction: boolean;
  contradictionType: ContradictionType | null;
  explanation: string;
  clinicalImpact: string;
  confidence: number;
}

/**
 * FlagContradictionsUseCase — Tool 5
 * Compares clinical notes to find contradictions in allergy lists, medications, surgical history.
 */
export class FlagContradictionsUseCase {
  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: FlagContradictionsRequest,
    fhirToken?: string
  ): Promise<FlagContradictionsResponse> {
    const startTime = Date.now();
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Flagging contradictions', { patientId: request.patientId });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const notes = [...patient.getNotes()].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const contradictions: Contradiction[] = [];
    let pairsAnalyzed = 0;

    // Check consecutive note pairs for contradictions (sliding window)
    const windowSize = Math.min(notes.length, 10);
    for (let i = 0; i < windowSize - 1; i++) {
      const noteA = notes[i];
      const noteB = notes[i + 1];

      const result = await this.detectContradiction(
        truncate(noteA.text, 1500),
        truncate(noteB.text, 1500)
      );
      pairsAnalyzed++;

      if (result.isContradiction && result.contradictionType && result.confidence >= 0.7) {
        contradictions.push({
          type: result.contradictionType,
          patientReported: truncate(noteA.text, 150),
          documentedEvidence: truncate(noteB.text, 150),
          contradictionDate: noteB.date.toISOString(),
          clinicalImpact: result.clinicalImpact,
          alertLevel:
            result.contradictionType === 'ALLERGY_MISMATCH'
              ? AlertLevelValue.CRITICAL
              : AlertLevelValue.WARNING,
        });
      }
    }

    return {
      contradictions,
      metadata: {
        notePairsAnalyzed: pairsAnalyzed,
        contradictionsFound: contradictions.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private async detectContradiction(
    noteA: string,
    noteB: string
  ): Promise<LLMContradictionResult> {
    try {
      const prompt = CONTRADICTION_DETECTION_PROMPT(noteA, noteB);
      const result = await this._llmClient.extract<LLMContradictionResult>(prompt);
      return result.data;
    } catch {
      return {
        isContradiction: false,
        contradictionType: null,
        explanation: '',
        clinicalImpact: '',
        confidence: 0,
      };
    }
  }
}
