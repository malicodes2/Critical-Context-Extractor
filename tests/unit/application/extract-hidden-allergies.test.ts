import { ExtractHiddenAllergiesUseCase } from '../../../src/application/use-cases/ExtractHiddenAllergies/ExtractHiddenAllergiesUseCase';
import { Patient } from '../../../src/domain/entities/Patient';
import { PatientId } from '../../../src/domain/value-objects/PatientId';
import { ClinicalNote } from '../../../src/domain/entities/ClinicalNote';
import { Allergy } from '../../../src/domain/entities/Allergy';
import { PatientRepository } from '../../../src/domain/interfaces/PatientRepository';
import { LLMClient, LLMExtractionResult } from '../../../src/domain/interfaces/LLMClient';
import { ILogger } from '../../../src/domain/interfaces/ILogger';
import { AlertLevelValue } from '../../../src/domain/value-objects/AlertLevel';
import { PatientNotFoundError } from '../../../src/shared/errors/PatientNotFoundError';

// ── Mock implementations ───────────────────────────────────────────────────────
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';

function buildMockLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildMockRepo(patient: Patient | null): PatientRepository {
  return {
    findById: jest.fn().mockResolvedValue(patient),
    findByNaturalId: jest.fn().mockResolvedValue(patient),
  };
}

function buildMockLLM(extractedAllergies: unknown[]): LLMClient {
  return {
    extract: jest.fn().mockResolvedValue({
      data: extractedAllergies,
      rawResponse: JSON.stringify(extractedAllergies),
    } as LLMExtractionResult),
    analyze: jest.fn().mockResolvedValue('Analysis complete'),
  };
}

function buildTestPatient(notes: ClinicalNote[], allergies: Allergy[] = []): Patient {
  const patient = Patient.create(PATIENT_ID);
  notes.forEach((n) => patient.addNote(n));
  allergies.forEach((a) => patient.addAllergy(a));
  return patient;
}

function buildNote(text: string): ClinicalNote {
  return new ClinicalNote({
    id: `note-${Math.random()}`,
    patientId: PATIENT_ID,
    text,
    date: new Date('2024-06-01'),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('ExtractHiddenAllergiesUseCase', () => {
  describe('when patient has undocumented codeine allergy in notes', () => {
    it('should flag as CRITICAL finding', async () => {
      const note = buildNote('Patient experienced severe vomiting and rash after codeine.');
      const patient = buildTestPatient([note]);

      const mockLLM = buildMockLLM([{
        substance: 'Codeine',
        reaction: 'severe vomiting and rash',
        severity: 'severe',
        excerpt: 'severe vomiting and rash after codeine',
        confidence: 0.95,
      }]);

      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(patient), mockLLM, buildMockLogger()
      );

      const result = await useCase.execute({ patientId: PATIENT_ID });

      expect(result.criticalFindings).toHaveLength(1);
      expect(result.criticalFindings[0].substance).toBe('Codeine');
      expect(result.criticalFindings[0].inAllergyList).toBe(false);
      expect(result.criticalFindings[0].alertLevel).toBe(AlertLevelValue.CRITICAL);
    });

    it('should include note metadata in the finding', async () => {
      const note = buildNote('Patient reacted to codeine with anaphylaxis.');
      const patient = buildTestPatient([note]);

      const mockLLM = buildMockLLM([{
        substance: 'Codeine',
        reaction: 'anaphylaxis',
        severity: 'life-threatening',
        excerpt: 'reacted to codeine with anaphylaxis',
        confidence: 0.98,
      }]);

      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(patient), mockLLM, buildMockLogger()
      );

      const result = await useCase.execute({ patientId: PATIENT_ID });

      expect(result.noteMentions[0].noteExcerpt).toBeTruthy();
    });
  });

  describe('when allergy is already documented', () => {
    it('should NOT appear in criticalFindings', async () => {
      const note = buildNote('Patient has known penicillin allergy — rash.');
      const documentedAllergy = new Allergy({
        substance: 'Penicillin',
        reaction: 'rash',
        severity: 'moderate',
        source: 'allergy-list',
      });
      const patient = buildTestPatient([note], [documentedAllergy]);

      const mockLLM = buildMockLLM([{
        substance: 'Penicillin',
        reaction: 'rash',
        severity: 'moderate',
        excerpt: 'known penicillin allergy rash',
        confidence: 0.9,
      }]);

      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(patient), mockLLM, buildMockLogger()
      );

      const result = await useCase.execute({ patientId: PATIENT_ID });

      expect(result.criticalFindings).toHaveLength(0);
    });
  });

  describe('when patient has no clinical notes', () => {
    it('should return empty results without error', async () => {
      const patient = buildTestPatient([]);
      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(patient), buildMockLLM([]), buildMockLogger()
      );

      const result = await useCase.execute({ patientId: PATIENT_ID });

      expect(result.noteMentions).toHaveLength(0);
      expect(result.criticalFindings).toHaveLength(0);
      expect(result.metadata.notesAnalyzed).toBe(0);
    });
  });

  describe('when patient is not found', () => {
    it('should throw PatientNotFoundError', async () => {
      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(null), buildMockLLM([]), buildMockLogger()
      );

      await expect(useCase.execute({ patientId: PATIENT_ID }))
        .rejects.toThrow(PatientNotFoundError);
    });
  });

  describe('when LLM returns low-confidence results', () => {
    it('should filter out results below 0.7 confidence', async () => {
      const note = buildNote('Some mention of aspirin sensitivity maybe.');
      const patient = buildTestPatient([note]);

      const mockLLM = buildMockLLM([{
        substance: 'Aspirin',
        reaction: 'maybe sensitivity',
        severity: 'mild',
        excerpt: 'aspirin sensitivity maybe',
        confidence: 0.4, // Below threshold
      }]);

      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(patient), mockLLM, buildMockLogger()
      );

      const result = await useCase.execute({ patientId: PATIENT_ID });
      expect(result.noteMentions).toHaveLength(0);
    });
  });

  describe('performance', () => {
    it('should process 50 notes in under 5 seconds (mock LLM)', async () => {
      const notes = Array.from({ length: 50 }, (_, i) =>
        buildNote(`Note ${i}: Patient reports mild headache. No new allergies noted.`)
      );
      const patient = buildTestPatient(notes);

      const mockLLM = buildMockLLM([]);
      const useCase = new ExtractHiddenAllergiesUseCase(
        buildMockRepo(patient), mockLLM, buildMockLogger()
      );

      const start = Date.now();
      await useCase.execute({ patientId: PATIENT_ID });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });
  });
});
