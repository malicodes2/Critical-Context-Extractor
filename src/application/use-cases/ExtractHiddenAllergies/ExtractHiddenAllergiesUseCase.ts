import { PatientRepository } from '../../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../../domain/interfaces/LLMClient';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { AllergyDomainService } from '../../../domain/services/AllergyDomainService';
import { PatientId } from '../../../domain/value-objects/PatientId';
import { Allergy } from '../../../domain/entities/Allergy';
import { PatientNotFoundError } from '../../../shared/errors/PatientNotFoundError';
import { truncate, extractExcerpt } from '../../../shared/utils/StringUtils';
import { ALLERGY_EXTRACTION_PROMPT } from '../../../infrastructure/llm/PromptTemplates';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import {
  ExtractHiddenAllergiesRequest,
} from './ExtractHiddenAllergiesRequest';
import {
  ExtractHiddenAllergiesResponse,
  AllergyListItem,
  AllergyMention,
} from './ExtractHiddenAllergiesResponse';

interface LLMAllergyResult {
  substance: string;
  reaction: string;
  severity: string;
  excerpt: string;
  confidence: number;
}

/**
 * ExtractHiddenAllergiesUseCase — Tool 1
 * Finds allergic reactions documented in clinical notes but missing from the official allergy list.
 */
export class ExtractHiddenAllergiesUseCase {
  private readonly _allergyService = new AllergyDomainService();

  constructor(
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {}

  async execute(
    request: ExtractHiddenAllergiesRequest,
    fhirToken?: string
  ): Promise<ExtractHiddenAllergiesResponse> {
    const startTime = Date.now();
    const patientId = PatientId.create(request.patientId);

    this._logger.info('Extracting hidden allergies', {
      patientId: request.patientId,
    });

    const patient = await this._patientRepo.findById(patientId, fhirToken);
    if (!patient) throw new PatientNotFoundError(request.patientId);

    const documentedAllergies = [...patient.getAllergies()];
    const notes = [...patient.getNotes()];

    const documentedItems: AllergyListItem[] = documentedAllergies.map((a) => ({
      substance: a.substance,
      reaction: a.reaction,
      severity: a.severity,
      source: 'allergy-list' as const,
    }));

    const noteMentions: AllergyMention[] = [];

    for (const note of notes) {
      const extracted = await this.extractFromNote(note.text, note.id);
      noteMentions.push(...extracted);
    }

    const allergyObjects = noteMentions.map(
      (m) =>
        new Allergy({
          substance: m.substance,
          reaction: m.reaction,
          severity: m.severity,
          source: 'clinical-note',
          noteId: m.noteId,
          noteExcerpt: m.noteExcerpt,
          confidenceScore: m.confidenceScore,
        })
    );

    const crossReferenced = this._allergyService.crossReference(
      documentedAllergies,
      allergyObjects
    );

    const enrichedMentions: AllergyMention[] = crossReferenced.map((r) => ({
      substance: r.substance,
      reaction: r.reaction,
      severity: r.severity,
      noteId: r.noteId ?? '',
      noteExcerpt: r.noteExcerpt ?? '',
      inAllergyList: r.inAllergyList,
      alertLevel: r.alertLevel,
      confidenceScore: r.confidenceScore,
    }));

    const criticalFindings = this._allergyService.filterCritical(crossReferenced).map(
      (r): AllergyMention => ({
        substance: r.substance,
        reaction: r.reaction,
        severity: r.severity,
        noteId: r.noteId ?? '',
        noteExcerpt: r.noteExcerpt ?? '',
        inAllergyList: r.inAllergyList,
        alertLevel: r.alertLevel,
        confidenceScore: r.confidenceScore,
      })
    );

    const avgConfidence =
      enrichedMentions.length > 0
        ? enrichedMentions.reduce((s, m) => s + m.confidenceScore, 0) /
          enrichedMentions.length
        : 1.0;

    return {
      documentedAllergies: documentedItems,
      noteMentions: enrichedMentions,
      criticalFindings,
      metadata: {
        notesAnalyzed: notes.length,
        processingTimeMs: Date.now() - startTime,
        confidenceScore: Math.round(avgConfidence * 100) / 100,
      },
    };
  }

  private async extractFromNote(
    noteText: string,
    noteId: string
  ): Promise<AllergyMention[]> {
    try {
      const prompt = ALLERGY_EXTRACTION_PROMPT(truncate(noteText, 4000));
      const result = await this._llmClient.extract<LLMAllergyResult[]>(prompt);

      if (!Array.isArray(result.data)) return [];

      return result.data
        .filter((item) => item.confidence >= 0.7)
        .map((item) => ({
          substance: item.substance,
          reaction: item.reaction,
          severity: this.normalizeSeverity(item.severity),
          noteId,
          noteExcerpt: item.excerpt
            ? truncate(item.excerpt, 200)
            : extractExcerpt(noteText, item.substance),
          inAllergyList: false,
          alertLevel: this.severityToAlertLevel(item.severity),
          confidenceScore: item.confidence,
        }));
    } catch {
      this._logger.warn('Failed to extract allergies from note', { noteId });
      return [];
    }
  }

  private normalizeSeverity(
    raw: string
  ): 'mild' | 'moderate' | 'severe' | 'life-threatening' {
    const valid = ['mild', 'moderate', 'severe', 'life-threatening'] as const;
    const normalized = raw.toLowerCase().trim();
    return valid.find((v) => v === normalized) ?? 'moderate';
  }

  private severityToAlertLevel(severity: string): AlertLevelValue {
    if (severity === 'life-threatening' || severity === 'severe') {
      return AlertLevelValue.CRITICAL;
    }
    if (severity === 'moderate') return AlertLevelValue.WARNING;
    return AlertLevelValue.INFO;
  }
}
