import { buildSyntheticPatient } from './synthetic-patient-builder';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * TestDataGenerator — writes synthetic FHIR test fixtures to disk.
 * Output: tests/fixtures/patients/*.json
 * Usage: npx ts-node src/scripts/test-data-generator.ts [count]
 */

const OUTPUT_DIR = join(process.cwd(), 'tests', 'fixtures', 'patients');

function generateTestData(count: number): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { patient, allergies, notes } = buildSyntheticPatient();

    const fixture = {
      patient,
      allergies: { resourceType: 'Bundle', entry: allergies.map((r) => ({ resource: r })) },
      notes: { resourceType: 'Bundle', entry: notes.map((r) => ({ resource: r })) },
    };

    const filename = join(OUTPUT_DIR, `patient-${patient.id}.json`);
    writeFileSync(filename, JSON.stringify(fixture, null, 2));
    ids.push(patient.id);
    // eslint-disable-next-line no-console
    console.log(`✅  Written: ${filename}`);
  }

  // Write an index file for easy lookup in tests
  const indexFile = join(OUTPUT_DIR, 'index.json');
  writeFileSync(indexFile, JSON.stringify({ patientIds: ids }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`\n📋  Index: ${indexFile}`);
  // eslint-disable-next-line no-console
  console.log(`\nDone. Generated ${count} test patient fixture(s).`);
}

if (require.main === module) {
  const count = parseInt(process.argv[2] ?? '5', 10);
  generateTestData(count);
}
