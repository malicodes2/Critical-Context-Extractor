import { randomUUID } from 'crypto';

/**
 * SyntheticPatientBuilder — creates FHIR R4 patient bundles for testing.
 * Generates realistic synthetic data — never use real PHI.
 */

interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  name: Array<{ family: string; given: string[] }>;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
}

interface FHIRAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id: string;
  patient: { reference: string };
  code: { coding: Array<{ system: string; code: string; display: string }> };
  reaction: Array<{
    manifestation: Array<{ coding: Array<{ display: string }> }>;
    severity: string;
  }>;
  recordedDate: string;
}

interface FHIRDocumentReference {
  resourceType: 'DocumentReference';
  id: string;
  subject: { reference: string };
  date: string;
  content: Array<{
    attachment: { contentType: string; data: string };
  }>;
}

const FIRST_NAMES = ['James', 'Maria', 'Robert', 'Jennifer', 'Michael', 'Sarah', 'David', 'Emma'];
const LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Williams', 'Taylor', 'Anderson', 'Thomas'];
const ALLERGIES = [
  { code: '372687004', display: 'Penicillin', reaction: 'Hives', severity: 'moderate' },
  { code: '387207008', display: 'Ibuprofen', reaction: 'Stomach pain', severity: 'mild' },
  { code: '87881000', display: 'Codeine', reaction: 'Respiratory depression', severity: 'severe' },
  { code: '409623003', display: 'Latex', reaction: 'Anaphylaxis', severity: 'severe' },
];

const CLINICAL_NOTES = [
  'Patient presents with persistent headache for 3 days. Vitals stable. No fever. Prescribed ibuprofen.',
  'Follow-up visit. Patient reports headache improved. CBC results reviewed — WBC slightly elevated at 11.5.',
  'Patient mentioned allergy to codeine during intake — reacted with respiratory distress 2 years ago. Not in system.',
  'Chest pain reported on exertion. EKG ordered. Family history of cardiac disease (father had MI at 58).',
  'EKG results abnormal — ST changes noted. Cardiology referral recommended. Patient to schedule within 2 weeks.',
  'Patient reports fatigue, weight gain, cold intolerance × 3 months. TSH ordered.',
  'TSH result: 8.2 mIU/L (HIGH). Hypothyroidism suspected. Endocrinology referral placed.',
];

export function buildSyntheticPatient(): {
  patient: FHIRPatient;
  allergies: FHIRAllergyIntolerance[];
  notes: FHIRDocumentReference[];
} {
  const patientId = randomUUID();
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const year = 1950 + Math.floor(Math.random() * 50);

  const patient: FHIRPatient = {
    resourceType: 'Patient',
    id: patientId,
    name: [{ family: lastName, given: [firstName] }],
    birthDate: `${year}-${String(Math.ceil(Math.random() * 12)).padStart(2, '0')}-15`,
    gender: Math.random() > 0.5 ? 'male' : 'female',
  };

  // 1-2 documented allergies (leave some hidden in notes only)
  const allergyCount = 1 + Math.floor(Math.random() * 2);
  const allergies: FHIRAllergyIntolerance[] = ALLERGIES.slice(0, allergyCount).map((a) => ({
    resourceType: 'AllergyIntolerance',
    id: randomUUID(),
    patient: { reference: `Patient/${patientId}` },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: a.code, display: a.display }],
    },
    reaction: [
      {
        manifestation: [{ coding: [{ display: a.reaction }] }],
        severity: a.severity,
      },
    ],
    recordedDate: `${year + 30}-06-01`,
  }));

  // 4-7 clinical notes spread across 2 years
  const noteCount = 4 + Math.floor(Math.random() * 4);
  const notes: FHIRDocumentReference[] = CLINICAL_NOTES.slice(0, noteCount).map(
    (text, i) => ({
      resourceType: 'DocumentReference',
      id: randomUUID(),
      subject: { reference: `Patient/${patientId}` },
      date: new Date(Date.now() - (noteCount - i) * 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      content: [
        {
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(text).toString('base64'),
          },
        },
      ],
    })
  );

  return { patient, allergies, notes };
}

// CLI usage: npx ts-node src/scripts/synthetic-patient-builder.ts
if (require.main === module) {
  const count = parseInt(process.argv[2] ?? '3', 10);
  const patients = Array.from({ length: count }, () => buildSyntheticPatient());
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(patients, null, 2));
  // eslint-disable-next-line no-console
  console.error(`Generated ${count} synthetic patient(s). Pipe to a file or FHIR server.`);
}
