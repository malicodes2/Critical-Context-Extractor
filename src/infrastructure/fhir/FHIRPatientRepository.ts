import { Patient } from '../../domain/entities/Patient';
import { PatientId } from '../../domain/value-objects/PatientId';
import { PatientRepository } from '../../domain/interfaces/PatientRepository';
import { FHIRClient } from './FHIRClient';
import { FHIRResourceMapper } from './FHIRResourceMapper';
import { PatientNotFoundError } from '../../shared/errors/PatientNotFoundError';
import { ILogger } from '../../domain/interfaces/ILogger';
import { hashPatientId } from '../../shared/utils/StringUtils';

export class FHIRPatientRepository implements PatientRepository {
  constructor(
    private readonly _fhirClient: FHIRClient,
    private readonly _mapper: FHIRResourceMapper,
    private readonly _logger: ILogger
  ) {}

  async findById(id: PatientId, fhirToken?: string): Promise<Patient | null> {
    if (fhirToken) this._fhirClient.setToken(fhirToken);

    this._logger.info('Fetching patient from FHIR', {
      patientIdHash: hashPatientId(id.value),
    });

    const [fhirPatient, allergyBundle, noteBundle, observationBundle] =
      await Promise.all([
        this._fhirClient
          .getResource<Record<string, unknown>>('Patient', id.value)
          .catch(() => null),
        this._fhirClient
          .searchResources<Record<string, unknown>>('AllergyIntolerance', {
            patient: id.value,
          })
          .catch(() => null),
        this._fhirClient
          .searchResources<Record<string, unknown>>('DocumentReference', {
            subject: id.value,
            _count: '100',
          })
          .catch(() => null),
        this._fhirClient
          .searchResources<Record<string, unknown>>('Observation', {
            subject: id.value,
            _count: '100',
          })
          .catch(() => null),
      ]);

    if (!fhirPatient) {
      throw new PatientNotFoundError(id.value);
    }

    return this._mapper.toPatient(
      fhirPatient,
      allergyBundle?.entry ?? [],
      noteBundle?.entry ?? [],
      observationBundle?.entry ?? []
    );
  }

  async findByNaturalId(naturalId: string, fhirToken?: string): Promise<Patient | null> {
    if (fhirToken) this._fhirClient.setToken(fhirToken);

    const bundle = await this._fhirClient.searchResources<Record<string, unknown>>(
      'Patient',
      { identifier: naturalId }
    );

    const entry = bundle.entry?.[0]?.resource;
    if (!entry) return null;

    const id = (entry['id'] as string | undefined) ?? '';
    const patientId = PatientId.create(id);
    return this.findById(patientId, fhirToken);
  }
}
