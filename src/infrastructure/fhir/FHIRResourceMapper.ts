import { Patient, PatientDemographics } from '../../domain/entities/Patient';
import { ClinicalNote } from '../../domain/entities/ClinicalNote';
import { Allergy } from '../../domain/entities/Allergy';
import { Finding, FindingType } from '../../domain/entities/Finding';
import { PatientId } from '../../domain/value-objects/PatientId';
import { parseISODate } from '../../shared/utils/DateUtils';
import { v4 as uuidv4 } from 'uuid';

type FHIREntry = { resource?: Record<string, unknown> };

/**
 * FHIRResourceMapper — maps raw FHIR R4 JSON to domain entities.
 * Handles missing / malformed data gracefully.
 */
export class FHIRResourceMapper {
  toPatient(
    fhirPatient: Record<string, unknown>,
    allergyEntries: FHIREntry[],
    noteEntries: FHIREntry[],
    observationEntries: FHIREntry[]
  ): Patient {
    const id = String(fhirPatient['id'] ?? '');
    const demographics = this.mapDemographics(fhirPatient);

    const patient = new Patient({
      id: PatientId.create(id),
      demographics,
    });

    for (const entry of allergyEntries) {
      const allergy = this.mapAllergy(entry.resource);
      if (allergy) patient.addAllergy(allergy);
    }

    for (const entry of noteEntries) {
      const note = this.mapNote(entry.resource, id);
      if (note) patient.addNote(note);
    }

    for (const entry of observationEntries) {
      const finding = this.mapObservation(entry.resource, id);
      if (finding) patient.addFinding(finding);
    }

    return patient;
  }

  private mapDemographics(fhirPatient: Record<string, unknown>): PatientDemographics {
    const name = (fhirPatient['name'] as Array<Record<string, unknown>> | undefined)?.[0];
    const birthDateStr = fhirPatient['birthDate'] as string | undefined;

    return {
      givenName: (name?.['given'] as string[] | undefined)?.[0],
      familyName: name?.['family'] as string | undefined,
      birthDate: birthDateStr ? (parseISODate(birthDateStr) ?? undefined) : undefined,
      gender: fhirPatient['gender'] as string | undefined,
    };
  }

  private mapAllergy(
    resource: Record<string, unknown> | undefined
  ): Allergy | null {
    if (!resource) return null;

    try {
      const substance = this.extractAllergySubstance(resource);
      const reaction = this.extractAllergyReaction(resource);
      const severity = this.extractAllergySeverity(resource);
      const dateStr = resource['recordedDate'] as string | undefined;

      return new Allergy({
        substance,
        reaction,
        severity,
        dateRecorded: dateStr ? (parseISODate(dateStr) ?? undefined) : undefined,
        source: 'allergy-list',
      });
    } catch {
      return null;
    }
  }

  private mapNote(
    resource: Record<string, unknown> | undefined,
    patientId: string
  ): ClinicalNote | null {
    if (!resource) return null;

    try {
      const id = String(resource['id'] ?? uuidv4());
      const dateStr = resource['date'] as string | undefined;
      const date = (dateStr ? parseISODate(dateStr) : null) ?? new Date();

      const content = resource['content'] as
        | Array<Record<string, unknown>>
        | undefined;
      const attachment = content?.[0]?.['attachment'] as
        | Record<string, unknown>
        | undefined;

      let text = '';
      if (attachment?.['data']) {
        text = Buffer.from(String(attachment['data']), 'base64').toString('utf-8');
      } else if (attachment?.['url']) {
        text = `[External document: ${String(attachment['url'])}]`;
      }

      if (!text.trim()) return null;

      return new ClinicalNote({ id, patientId, text, date });
    } catch {
      return null;
    }
  }

  private mapObservation(
    resource: Record<string, unknown> | undefined,
    _patientId: string
  ): Finding | null {
    if (!resource) return null;

    try {
      const id = String(resource['id'] ?? uuidv4());
      const code = resource['code'] as Record<string, unknown> | undefined;
      const coding = (code?.['coding'] as Array<Record<string, unknown>> | undefined)?.[0];
      const testName = String(
        coding?.['display'] ?? code?.['text'] ?? 'Unknown Test'
      );

      const dateStr = resource['effectiveDateTime'] as string | undefined;
      const date = (dateStr ? parseISODate(dateStr) : null) ?? new Date();

      const valueQuantity = resource['valueQuantity'] as
        | Record<string, unknown>
        | undefined;
      const valueStr = valueQuantity
        ? `${String(valueQuantity['value'] ?? '')} ${String(valueQuantity['unit'] ?? '')}`.trim()
        : String((resource['valueString'] as string | undefined) ?? '');

      const interpretation = resource['interpretation'] as
        | Array<Record<string, unknown>>
        | undefined;
      const abnormal = this.isAbnormal(interpretation);

      return new Finding({
        id,
        type: 'Lab Result' as FindingType,
        test: testName,
        value: valueStr,
        date,
        abnormal,
        followUpDocumented: false,
        noteId: id,
      });
    } catch {
      return null;
    }
  }

  private isAbnormal(
    interpretation: Array<Record<string, unknown>> | undefined
  ): boolean {
    if (!interpretation?.length) return false;
    const coding = interpretation[0]?.['coding'] as
      | Array<Record<string, unknown>>
      | undefined;
    const code = String(coding?.[0]?.['code'] ?? '').toUpperCase();
    return ['A', 'H', 'L', 'HH', 'LL', 'AA'].includes(code);
  }

  private extractAllergySubstance(resource: Record<string, unknown>): string {
    const code = resource['code'] as Record<string, unknown> | undefined;
    const coding = (code?.['coding'] as Array<Record<string, unknown>> | undefined)?.[0];
    return String(coding?.['display'] ?? code?.['text'] ?? 'Unknown Substance');
  }

  private extractAllergyReaction(resource: Record<string, unknown>): string {
    const reactions = resource['reaction'] as
      | Array<Record<string, unknown>>
      | undefined;
    const manifestation = (
      reactions?.[0]?.['manifestation'] as
        | Array<Record<string, unknown>>
        | undefined
    )?.[0];
    const coding = (
      manifestation?.['coding'] as Array<Record<string, unknown>> | undefined
    )?.[0];
    return String(coding?.['display'] ?? manifestation?.['text'] ?? 'Unknown Reaction');
  }

  private extractAllergySeverity(
    resource: Record<string, unknown>
  ): 'mild' | 'moderate' | 'severe' | 'life-threatening' {
    const reactions = resource['reaction'] as
      | Array<Record<string, unknown>>
      | undefined;
    const severity = String(reactions?.[0]?.['severity'] ?? '').toLowerCase();

    const valid = ['mild', 'moderate', 'severe', 'life-threatening'] as const;
    return valid.includes(severity as 'mild') ? (severity as typeof valid[number]) : 'moderate';
  }
}
