import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { toISOString } from '../../../shared/utils/DateUtils';
import { FINDING_FOLLOWUP_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import {
  FindUnaddressedFindingsRequest,
} from './FindUnaddressedFindingsRequest';
import {
  FindUnaddressedFindingsResponse,
  UnaddressedFinding,
} from './FindUnaddressedFindingsResponse';

interface FollowUpResult {
  wasAddressed: boolean;
  evidence: string;
  confidence: number;
}

/**
 * FindUnaddressedFindingsUseCase — Tool 2
 * Identifies abnormal test results with no documented follow-up.
 */
export class FindUnaddressedFindingsUseCase {
  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: FindUnaddressedFindingsRequest,
    fhirToken?: string
  ): Promise<FindUnaddressedFindingsResponse> {
    const startTime = Date.now();
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Finding unaddressed findings', {
      patientId: request.patientId,
    });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const findings = [...patient.getFindings()].filter((f) => f.abnormal);
    const notes = [...patient.getNotes()];
    const notesText = notes.map((n) => n.text).join('\n\n---\n\n');

    const results: UnaddressedFinding[] = [];

    for (const finding of findings) {
      const followUp = await this.checkFollowUp(finding.alertMessage, notesText);

      const updatedFinding: UnaddressedFinding = {
        id: finding.id,
        type: finding.type,
        test: finding.test,
        value: finding.value,
        referenceRange: finding.referenceRange,
        date: toISOString(finding.date),
        abnormal: finding.abnormal,
        followUpDocumented: followUp.wasAddressed,
        daysSinceResult: finding.daysSinceResult,
        urgency: finding.urgency,
        alertLevel: finding.alertLevel,
        clinicalSignificance: followUp.evidence || finding.alertMessage,
        alertMessage: finding.alertMessage,
        evidence: {
          resultNoteId: finding.noteId,
          searchedNotesCount: notes.length,
        },
      };

      results.push(updatedFinding);
    }

    const unaddressed = results.filter((r) => !r.followUpDocumented);
    const prioritized = [...unaddressed].sort(
      (a, b) => this.urgencyPriority(b.urgency) - this.urgencyPriority(a.urgency)
    );

    return {
      findings: results,
      prioritized,
      metadata: {
        totalFindingsReviewed: findings.length,
        unaddressedCount: unaddressed.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private async checkFollowUp(
    findingDescription: string,
    notesText: string
  ): Promise<FollowUpResult> {
    try {
      const prompt = FINDING_FOLLOWUP_PROMPT(findingDescription, notesText.slice(0, 4000));
      const result = await this._llmClient.extract<FollowUpResult>(prompt);
      return result.data;
    } catch {
      return { wasAddressed: false, evidence: '', confidence: 0 };
    }
  }

  private urgencyPriority(urgency: string): number {
    const map: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    return map[urgency] ?? 0;
  }
}
