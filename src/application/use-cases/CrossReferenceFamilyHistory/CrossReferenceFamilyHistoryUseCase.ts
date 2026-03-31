import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { FAMILY_HISTORY_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import { truncate } from '../../../shared/utils/StringUtils';

export interface CrossReferenceFamilyHistoryRequest {
  patientId: string;
  currentSymptoms?: string[];
}

interface LLMFamilyHistoryItem {
  relative: string;
  condition: string;
  ageAtOnset: number | null;
  deceased: boolean | null;
}

export interface FamilyRiskFinding {
  relative: string;
  condition: string;
  ageAtOnset?: number;
  riskLevel: AlertLevelValue;
  correlatedWithSymptoms: boolean;
  clinicalNote: string;
}

export interface CrossReferenceFamilyHistoryResponse {
  familyHistory: FamilyRiskFinding[];
  riskSummary: string;
  metadata: {
    notesAnalyzed: number;
    familyConditionsFound: number;
    processingTimeMs: number;
  };
}

/**
 * CrossReferenceFamilyHistoryUseCase — Tool 4
 * Extracts family history, correlates with current symptoms for genetic risk.
 */
export class CrossReferenceFamilyHistoryUseCase {
  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: CrossReferenceFamilyHistoryRequest,
    fhirToken?: string
  ): Promise<CrossReferenceFamilyHistoryResponse> {
    const startTime = Date.now();
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Cross-referencing family history', {
      patientId: request.patientId,
    });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const notes = [...patient.getNotes()];
    const allHistory: LLMFamilyHistoryItem[] = [];

    for (const note of notes) {
      const items = await this.extractFamilyHistory(note.text);
      allHistory.push(...items);
    }

    const currentSymptoms = request.currentSymptoms ?? [];
    const HIGH_RISK_CONDITIONS = [
      'cancer', 'heart disease', 'diabetes', 'stroke', 'cardiomyopathy',
      'brca', 'lynch syndrome', 'huntington', 'sudden death',
    ];

    const findings: FamilyRiskFinding[] = allHistory.map((item) => {
      const isHighRisk = HIGH_RISK_CONDITIONS.some((c) =>
        item.condition.toLowerCase().includes(c)
      );
      const isFirstDegree = ['father', 'mother', 'sibling', 'brother', 'sister'].some((r) =>
        item.relative.toLowerCase().includes(r)
      );
      const correlated = currentSymptoms.some((s) =>
        item.condition.toLowerCase().includes(s.toLowerCase().split(' ')[0])
      );

      let riskLevel = AlertLevelValue.INFO;
      if (isHighRisk && isFirstDegree) riskLevel = AlertLevelValue.CRITICAL;
      else if (isHighRisk || (isFirstDegree && correlated)) riskLevel = AlertLevelValue.WARNING;

      const earlyOnset = item.ageAtOnset !== null && item.ageAtOnset < 50;
      return {
        relative: item.relative,
        condition: item.condition,
        ageAtOnset: item.ageAtOnset ?? undefined,
        riskLevel,
        correlatedWithSymptoms: correlated,
        clinicalNote:
          `${item.relative} with ${item.condition}` +
          (earlyOnset ? ` (early onset age ${item.ageAtOnset ?? 'unknown'})` : '') +
          (correlated ? ' — relevant to current symptoms' : ''),
      };
    });

    const criticalCount = findings.filter(
      (f) => f.riskLevel === AlertLevelValue.CRITICAL
    ).length;
    const riskSummary =
      criticalCount > 0
        ? `⚠️ ${criticalCount} high-risk first-degree family history finding(s) identified.`
        : findings.length > 0
        ? `${findings.length} family history item(s) noted. No immediate red flags.`
        : 'No significant family history found in clinical notes.';

    return {
      familyHistory: findings,
      riskSummary,
      metadata: {
        notesAnalyzed: notes.length,
        familyConditionsFound: findings.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private async extractFamilyHistory(
    noteText: string
  ): Promise<LLMFamilyHistoryItem[]> {
    try {
      const prompt = FAMILY_HISTORY_PROMPT(truncate(noteText, 3000));
      const result = await this._llmClient.extract<LLMFamilyHistoryItem[]>(prompt);
      return Array.isArray(result.data) ? result.data : [];
    } catch {
      return [];
    }
  }
}
