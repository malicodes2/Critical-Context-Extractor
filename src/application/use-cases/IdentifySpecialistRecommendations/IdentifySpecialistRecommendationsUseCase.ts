import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { SPECIALIST_RECOMMENDATION_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import { truncate } from '../../../shared/utils/StringUtils';
import { daysBetween, today } from '../../../shared/utils/DateUtils';

export interface SpecialistRecommendation {
  specialist: string;
  action: string;
  recommendedDate: string;
  completed: boolean;
  daysOverdue?: number;
  alertLevel: AlertLevelValue;
}

export interface IdentifySpecialistRecommendationsRequest {
  patientId: string;
  specialtyFilter?: string[];
}

export interface IdentifySpecialistRecommendationsResponse {
  recommendations: SpecialistRecommendation[];
  pendingCount: number;
  overallCompletionRate: number;
  metadata: {
    notesAnalyzed: number;
    totalRecommendations: number;
    processingTimeMs: number;
  };
}

interface LLMRecommendationItem {
  specialist: string;
  action: string;
  urgency: 'routine' | 'soon' | 'urgent';
  date: string | null;
}

/**
 * IdentifySpecialistRecommendationsUseCase — Tool 6
 * Tracks specialist referrals from notes and flags overdue follow-ups.
 */
export class IdentifySpecialistRecommendationsUseCase {
  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: IdentifySpecialistRecommendationsRequest,
    fhirToken?: string
  ): Promise<IdentifySpecialistRecommendationsResponse> {
    const startTime = Date.now();
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Identifying specialist recommendations', {
      patientId: request.patientId,
    });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const notes = [...patient.getNotes()].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const allRecs: Array<LLMRecommendationItem & { noteDate: Date }> = [];

    for (const note of notes) {
      const recs = await this.extractRecommendations(note.text);
      allRecs.push(...recs.map((r) => ({ ...r, noteDate: note.date })));
    }

    const filter = request.specialtyFilter?.map((s) => s.toLowerCase());
    const filtered = filter
      ? allRecs.filter((r) => filter.some((f) => r.specialist.toLowerCase().includes(f)))
      : allRecs;

    const noteTexts = notes.map((n) => n.text).join('\n');
    const results: SpecialistRecommendation[] = await Promise.all(
      filtered.map(async (rec) => {
        const completed = this.isCompleted(rec.specialist, rec.action, noteTexts);
        const dateRef = rec.date ? new Date(rec.date) : rec.noteDate;
        const daysElapsed = daysBetween(dateRef, today());

        const overdueThreshold =
          rec.urgency === 'urgent' ? 14 : rec.urgency === 'soon' ? 30 : 90;
        const isOverdue = !completed && daysElapsed > overdueThreshold;
        const alertLevel = isOverdue
          ? rec.urgency === 'urgent'
            ? AlertLevelValue.CRITICAL
            : AlertLevelValue.WARNING
          : AlertLevelValue.INFO;

        return {
          specialist: rec.specialist,
          action: rec.action,
          recommendedDate: dateRef.toISOString(),
          completed,
          daysOverdue: isOverdue ? daysElapsed - overdueThreshold : undefined,
          alertLevel,
        };
      })
    );

    const pending = results.filter((r) => !r.completed);
    const completionRate =
      results.length > 0
        ? Math.round(((results.length - pending.length) / results.length) * 100)
        : 100;

    return {
      recommendations: results,
      pendingCount: pending.length,
      overallCompletionRate: completionRate,
      metadata: {
        notesAnalyzed: notes.length,
        totalRecommendations: results.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private async extractRecommendations(noteText: string): Promise<LLMRecommendationItem[]> {
    try {
      const prompt = SPECIALIST_RECOMMENDATION_PROMPT(truncate(noteText, 3000));
      const result = await this._llmClient.extract<LLMRecommendationItem[]>(prompt);
      return Array.isArray(result.data) ? result.data : [];
    } catch {
      return [];
    }
  }

  private isCompleted(specialist: string, action: string, allNotesText: string): boolean {
    const specialistKeyword = specialist.toLowerCase().replace('ologist', '');
    return (
      allNotesText.toLowerCase().includes(`seen by ${specialistKeyword}`) ||
      allNotesText.toLowerCase().includes(`referred to ${specialistKeyword}`) ||
      allNotesText.toLowerCase().includes(`${specialistKeyword} follow-up completed`) ||
      allNotesText.toLowerCase().includes(action.toLowerCase().slice(0, 20))
    );
  }
}
