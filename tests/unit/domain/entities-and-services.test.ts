import { Patient } from '../../../src/domain/entities/Patient';
import { PatientId } from '../../../src/domain/value-objects/PatientId';
import { Allergy } from '../../../src/domain/entities/Allergy';
import { ClinicalNote } from '../../../src/domain/entities/ClinicalNote';
import { AllergyDomainService } from '../../../src/domain/services/AllergyDomainService';
import { TemporalAnalysisService } from '../../../src/domain/services/TemporalAnalysisService';
import { AlertLevelValue } from '../../../src/domain/value-objects/AlertLevel';
import { ValidationError } from '../../../src/shared/errors/ValidationError';

// ── helpers ───────────────────────────────────────────────────────────────────
function makePatient(id = '550e8400-e29b-41d4-a716-446655440000'): Patient {
  return Patient.create(id);
}

function makeAllergy(substance: string, source: 'allergy-list' | 'clinical-note' = 'allergy-list'): Allergy {
  return new Allergy({ substance, reaction: 'rash', severity: 'severe', source });
}

function makeNote(patientId: string, text: string, date = new Date()): ClinicalNote {
  return new ClinicalNote({ id: `note-${Date.now()}-${Math.random()}`, patientId, text, date });
}

// ── Patient entity ─────────────────────────────────────────────────────────────
describe('Patient entity', () => {
  it('should create a patient with valid UUID', () => {
    const patient = makePatient();
    expect(patient.id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should add allergies and return defensive copy', () => {
    const patient = makePatient();
    patient.addAllergy(makeAllergy('Penicillin'));
    const allergies = patient.getAllergies();
    expect(allergies).toHaveLength(1);
    expect(allergies[0].substance).toBe('Penicillin');
  });

  it('should detect documented allergy by substance name', () => {
    const patient = makePatient();
    patient.addAllergy(makeAllergy('Penicillin'));
    expect(patient.hasDocumentedAllergy('penicillin')).toBe(true);
    expect(patient.hasDocumentedAllergy('codeine')).toBe(false);
  });

  it('should reject note belonging to another patient', () => {
    const patient = makePatient('550e8400-e29b-41d4-a716-446655440000');
    const foreignNote = makeNote('660e8400-e29b-41d4-a716-446655440001', 'some text');
    expect(() => patient.addNote(foreignNote)).toThrow(ValidationError);
  });

  it('should calculate age correctly', () => {
    const patient = new Patient({
      id: PatientId.create('550e8400-e29b-41d4-a716-446655440000'),
      demographics: { birthDate: new Date('1990-01-01') },
    });
    const age = patient.getAgeYears();
    expect(age).toBeGreaterThanOrEqual(34);
    expect(age).toBeLessThanOrEqual(36);
  });
});

// ── AllergyDomainService ───────────────────────────────────────────────────────
describe('AllergyDomainService', () => {
  const service = new AllergyDomainService();

  it('should flag allergy mention not in documented list as hidden', () => {
    const documented = [makeAllergy('Penicillin')];
    const noteMention = makeAllergy('Codeine', 'clinical-note');

    const results = service.crossReference(documented, [noteMention]);

    expect(results).toHaveLength(1);
    expect(results[0].substance).toBe('Codeine');
    expect(results[0].inAllergyList).toBe(false);
  });

  it('should mark allergy mention that IS in documented list correctly', () => {
    const documented = [makeAllergy('Penicillin')];
    const noteMention = makeAllergy('Penicillin', 'clinical-note');

    const results = service.crossReference(documented, [noteMention]);

    expect(results[0].inAllergyList).toBe(true);
  });

  it('should filter only critical (non-documented, severe) allergies', () => {
    const criticalMention = new Allergy({
      substance: 'Nuts',
      reaction: 'anaphylaxis',
      severity: 'life-threatening',
      source: 'clinical-note',
    });
    const documented = [] as Allergy[];
    const crossRef = service.crossReference(documented, [criticalMention]);
    const critical = service.filterCritical(crossRef);

    expect(critical).toHaveLength(1);
    expect(critical[0].alertLevel).toBe(AlertLevelValue.CRITICAL);
  });
});

// ── TemporalAnalysisService ────────────────────────────────────────────────────
describe('TemporalAnalysisService', () => {
  const service = new TemporalAnalysisService();

  it('should detect recurring symptom pattern', () => {
    const occurrences = [
      { symptom: 'headache', date: new Date('2024-01-01'), noteId: 'n1' },
      { symptom: 'headache', date: new Date('2024-02-01'), noteId: 'n2' },
      { symptom: 'headache', date: new Date('2024-03-01'), noteId: 'n3' },
    ];

    const patterns = service.detectPatterns(occurrences, 3);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].symptom).toBe('headache');
    expect(patterns[0].isRecurring).toBe(true);
    expect(patterns[0].frequency).toBe('monthly');
  });

  it('should not return pattern below minimum occurrences', () => {
    const occurrences = [
      { symptom: 'nausea', date: new Date('2024-01-01'), noteId: 'n1' },
      { symptom: 'nausea', date: new Date('2024-02-01'), noteId: 'n2' },
    ];

    const patterns = service.detectPatterns(occurrences, 3);
    expect(patterns).toHaveLength(0);
  });

  it('should return empty array for no occurrences', () => {
    const patterns = service.detectPatterns([], 3);
    expect(patterns).toHaveLength(0);
  });
});
