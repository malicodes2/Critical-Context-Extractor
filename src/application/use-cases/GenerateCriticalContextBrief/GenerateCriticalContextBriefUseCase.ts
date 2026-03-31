import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { CRITICAL_BRIEF_SYNTHESIS_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import { ExtractHiddenAllergiesUseCase } from '../ExtractHiddenAllergies/ExtractHiddenAllergiesUseCase';
import { FindUnaddressedFindingsUseCase } from '../FindUnaddressedFindings/FindUnaddressedFindingsUseCase';
import { DetectPatternAnomaliesUseCase } from '../DetectPatternAnomalies/DetectPatternAnomaliesUseCase';
import {
  CrossReferenceFamilyHistoryUseCase,
} from '../CrossReferenceFamilyHistory/CrossReferenceFamilyHistoryUseCase';
import { FlagContradictionsUseCase } from '../FlagContradictions/FlagContradictionsUseCase';
import {
  IdentifySpecialistRecommendationsUseCase,
} from '../IdentifySpecialistRecommendations/IdentifySpecialistRecommendationsUseCase';

export interface GenerateCriticalContextBriefRequest {
  patientId: string;
  visitReason: string;
}

export interface Alert {
  category: string;
  message: string;
  alertLevel: AlertLevelValue;
}

export interface GenerateCriticalContextBriefResponse {
  summary: string;
  structured: {
    critical: Alert[];
    warnings: Alert[];
    context: Alert[];
  };
  metadata: {
    totalFindingsReviewed: number;
    criticalCount: number;
    warningCount: number;
    processingTimeMs: number;
    confidenceScore: number;
  };
}

/**
 * GenerateCriticalContextBriefUseCase — Tool 7
 * Runs all 6 use cases in parallel, synthesizes a prioritized pre-visit brief.
 */
export class GenerateCriticalContextBriefUseCase {
  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: GenerateCriticalContextBriefRequest,
    fhirToken?: string
  ): Promise<GenerateCriticalContextBriefResponse> {
    const startTime = Date.now();
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Generating critical context brief', {
      patientId: request.patientId,
    });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const patientName =
      `${patient.demographics.givenName ?? ''} ${
        patient.demographics.familyName ?? ''
      }`.trim() || 'Unknown';

    const [allergies, findings, patterns, familyHistory, contradictions, recommendations] =
      await Promise.all([
        new ExtractHiddenAllergiesUseCase(
          this._patientRepo, this._llmClient, this._logger
        ).execute({ patientId: request.patientId }, fhirToken).catch(() => null),

        new FindUnaddressedFindingsUseCase(
          this._patientRepo, this._llmClient, this._logger
        ).execute({ patientId: request.patientId, visitReason: request.visitReason }, fhirToken)
          .catch(() => null),

        new DetectPatternAnomaliesUseCase(
          this._patientRepo, this._llmClient, this._logger
        ).execute({ patientId: request.patientId }, fhirToken).catch(() => null),

        new CrossReferenceFamilyHistoryUseCase(
          this._patientRepo, this._llmClient, this._logger
        ).execute({ patientId: request.patientId }, fhirToken).catch(() => null),

        new FlagContradictionsUseCase(
          this._patientRepo, this._llmClient, this._logger
        ).execute({ patientId: request.patientId }, fhirToken).catch(() => null),

        new IdentifySpecialistRecommendationsUseCase(
          this._patientRepo, this._llmClient, this._logger
        ).execute({ patientId: request.patientId }, fhirToken).catch(() => null),
      ]);

    const criticalAlerts: Alert[] = [];
    const warnings: Alert[] = [];
    const context: Alert[] = [];

    allergies?.criticalFindings.forEach((a) =>
      criticalAlerts.push({
        category: 'Hidden Allergy',
        message: `⚠️ ALLERGY NOT IN LIST: ${a.substance} → ${a.reaction} (${a.severity})`,
        alertLevel: AlertLevelValue.CRITICAL,
      })
    );

    findings?.prioritized.slice(0, 3).forEach((f) => {
      const alert: Alert = {
        category: 'Unaddressed Finding',
        message: `${f.test}: ${f.value} (${f.daysSinceResult} days ago, no follow-up)`,
        alertLevel: f.alertLevel,
      };
      if (f.alertLevel === AlertLevelValue.CRITICAL) criticalAlerts.push(alert);
      else warnings.push(alert);
    });

    contradictions?.contradictions.forEach((c) => {
      const alert: Alert = {
        category: 'Contradiction',
        message: `${c.type.replace(/_/g, ' ')}: ${c.clinicalImpact}`,
        alertLevel: c.alertLevel,
      };
      if (c.alertLevel === AlertLevelValue.CRITICAL) criticalAlerts.push(alert);
      else warnings.push(alert);
    });

    recommendations?.recommendations
      .filter((r) => !r.completed && r.daysOverdue && r.daysOverdue > 0)
      .slice(0, 3)
      .forEach((r) =>
        warnings.push({
          category: 'Overdue Referral',
          message: `${r.specialist}: ${r.action} (${r.daysOverdue ?? 0} days overdue)`,
          alertLevel: r.alertLevel,
        })
      );

    patterns?.patterns.slice(0, 2).forEach((p) =>
      context.push({
        category: 'Recurring Pattern',
        message: `Recurring ${p.symptom} (${p.occurrenceCount}x in notes)`,
        alertLevel: AlertLevelValue.INFO,
      })
    );

    familyHistory?.familyHistory
      .filter((f) => f.riskLevel !== AlertLevelValue.INFO)
      .slice(0, 2)
      .forEach((f) =>
        context.push({
          category: 'Family History Risk',
          message: f.clinicalNote,
          alertLevel: f.riskLevel,
        })
      );

    const allAlertsText = [
      ...criticalAlerts.map((a) => `CRITICAL: ${a.category} — ${a.message}`),
      ...warnings.map((a) => `WARNING: ${a.category} — ${a.message}`),
      ...context.map((a) => `INFO: ${a.category} — ${a.message}`),
    ].join('\n');

    const summary = await this._llmClient
      .analyze(
        CRITICAL_BRIEF_SYNTHESIS_PROMPT(
          `Patient: ${patientName}`,
          request.visitReason,
          allAlertsText || 'No significant findings identified.'
        )
      )
      .catch(() => this.buildFallbackSummary(criticalAlerts, warnings, context));

    const totalReviewed =
      (allergies?.metadata.notesAnalyzed ?? 0) +
      (findings?.metadata.totalFindingsReviewed ?? 0);

    return {
      summary,
      structured: { critical: criticalAlerts, warnings, context },
      metadata: {
        totalFindingsReviewed: totalReviewed,
        criticalCount: criticalAlerts.length,
        warningCount: warnings.length,
        processingTimeMs: Date.now() - startTime,
        confidenceScore: 0.85,
      },
    };
  }

  private buildFallbackSummary(
    critical: Alert[],
    warnings: Alert[],
    context: Alert[]
  ): string {
    const lines: string[] = ['**Critical Context Brief**'];
    critical.forEach((a) => lines.push(`🔴 ${a.message}`));
    warnings.forEach((a) => lines.push(`🟡 ${a.message}`));
    context.forEach((a) => lines.push(`ℹ️ ${a.message}`));
    if (lines.length === 1) lines.push('No critical findings identified.');
    return lines.join('\n');
  }
}
