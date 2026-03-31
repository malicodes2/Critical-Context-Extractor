import { FHIRResourceMapper } from '../../../src/infrastructure/fhir/FHIRResourceMapper';

const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';

function base64Note(text: string): string {
  return Buffer.from(text).toString('base64');
}

describe('FHIRResourceMapper', () => {
  let mapper: FHIRResourceMapper;

  beforeEach(() => {
    mapper = new FHIRResourceMapper();
  });

  describe('toPatient', () => {
    it('should map a basic FHIR Patient resource', () => {
      const fhirPatient = {
        resourceType: 'Patient',
        id: PATIENT_ID,
        name: [{ family: 'Smith', given: ['James'] }],
        birthDate: '1975-06-15',
        gender: 'male',
      };

      const patient = mapper.toPatient(fhirPatient, [], [], []);

      expect(patient.id.value).toBe(PATIENT_ID);
      expect(patient.demographics.familyName).toBe('Smith');
      expect(patient.demographics.givenName).toBe('James');
      expect(patient.demographics.gender).toBe('male');
    });

    it('should handle missing name fields gracefully', () => {
      const fhirPatient = { resourceType: 'Patient', id: PATIENT_ID };
      const patient = mapper.toPatient(fhirPatient, [], [], []);
      expect(patient.id.value).toBe(PATIENT_ID);
      expect(patient.demographics.givenName).toBeUndefined();
    });
  });

  describe('allergy mapping', () => {
    it('should map FHIR AllergyIntolerance to domain Allergy', () => {
      const allergyEntry = {
        resource: {
          resourceType: 'AllergyIntolerance',
          id: 'allergy-1',
          code: {
            coding: [{ display: 'Penicillin', code: '372687004' }],
          },
          reaction: [
            {
              manifestation: [{ coding: [{ display: 'Hives' }] }],
              severity: 'moderate',
            },
          ],
          recordedDate: '2023-01-15',
        },
      };

      const patient = mapper.toPatient(
        { id: PATIENT_ID },
        [allergyEntry],
        [],
        []
      );

      const allergies = patient.getAllergies();
      expect(allergies).toHaveLength(1);
      expect(allergies[0].substance).toBe('Penicillin');
      expect(allergies[0].reaction).toBe('Hives');
      expect(allergies[0].severity).toBe('moderate');
    });

    it('should skip malformed allergy entries without throwing', () => {
      const badEntry = { resource: { resourceType: 'AllergyIntolerance' } };
      expect(() =>
        mapper.toPatient({ id: PATIENT_ID }, [badEntry], [], [])
      ).not.toThrow();
    });
  });

  describe('clinical note mapping', () => {
    it('should decode base64 note content', () => {
      const noteText = 'Patient has allergy to codeine — anaphylaxis.';
      const noteEntry = {
        resource: {
          resourceType: 'DocumentReference',
          id: 'note-1',
          date: '2024-01-10',
          content: [
            {
              attachment: {
                contentType: 'text/plain',
                data: base64Note(noteText),
              },
            },
          ],
        },
      };

      const patient = mapper.toPatient(
        { id: PATIENT_ID },
        [],
        [noteEntry],
        []
      );

      const notes = patient.getNotes();
      expect(notes).toHaveLength(1);
      expect(notes[0].text).toBe(noteText);
    });

    it('should skip empty note attachments', () => {
      const emptyNoteEntry = {
        resource: {
          resourceType: 'DocumentReference',
          id: 'note-empty',
          date: '2024-01-10',
          content: [{ attachment: {} }],
        },
      };

      const patient = mapper.toPatient({ id: PATIENT_ID }, [], [emptyNoteEntry], []);
      expect(patient.getNotes()).toHaveLength(0);
    });
  });

  describe('observation mapping', () => {
    it('should map abnormal observation to Finding with abnormal=true', () => {
      const obsEntry = {
        resource: {
          resourceType: 'Observation',
          id: 'obs-1',
          code: {
            coding: [{ display: 'Hemoglobin A1c' }],
          },
          effectiveDateTime: '2024-03-01',
          valueQuantity: { value: 8.5, unit: '%' },
          interpretation: [
            { coding: [{ code: 'H', system: 'http://hl7.org/fhir/v2/0078' }] },
          ],
        },
      };

      const patient = mapper.toPatient({ id: PATIENT_ID }, [], [], [obsEntry]);

      const findings = patient.getFindings();
      expect(findings).toHaveLength(1);
      expect(findings[0].test).toBe('Hemoglobin A1c');
      expect(findings[0].abnormal).toBe(true);
    });

    it('should map normal observation with abnormal=false', () => {
      const obsEntry = {
        resource: {
          resourceType: 'Observation',
          id: 'obs-normal',
          code: { coding: [{ display: 'Blood Glucose' }] },
          effectiveDateTime: '2024-03-01',
          valueQuantity: { value: 95, unit: 'mg/dL' },
          interpretation: [],
        },
      };

      const patient = mapper.toPatient({ id: PATIENT_ID }, [], [], [obsEntry]);
      expect(patient.getFindings()[0].abnormal).toBe(false);
    });
  });
});
