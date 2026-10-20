import { AppendixDto, IncidentDto } from './dto.js';
import { nowUtc } from './validation.js';
import { UcriVersion } from './version.js';

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

const kv = (key: string, value: string): AppendixDto => ({ key, value });

export interface SampleIncidentOptions {
  version: UcriVersion;
  sender: string;
  target: string;
  controlCenterName?: string;
  withResourceRequest?: boolean;
}

/** Beispiel-Einsatz in Anlehnung an das Incident-DTO-Beispiel der Spezifikation (Kap. 4.7). */
export function createSampleIncident(o: SampleIncidentOptions): IncidentDto {
  const now = nowUtc();
  const id = `${Date.now()}`;
  const sharedIncidentId = uuid();
  const v11 = o.version === '1.1';

  const appendices: AppendixDto[] = [
    kv('IncidentId', id),
    ...(v11 ? [kv('SharedIncidentId', sharedIncidentId)] : []),
    kv('SourceId', o.sender),
    kv('TargetId', o.target),
    kv('ControlCenterName', o.controlCenterName ?? o.sender),
    kv('IncidentStartTimeStamp', now),
    kv('TransactionNumber', `T-${id.slice(-6)}`),
    kv('Classification', 'RD1'),
    kv('IncidentFlashingLights', 'true'),
    kv('Issue', 'Kranke Person in Praxis'),
    ...(v11
      ? [
          kv('IncidentAdditionalInfo', 'Testeinsatz des UCRI Test-Clients'),
          kv('IncidentDispatcherID', 'D-4711'),
          kv('IncidentDispatcherName', 'Erika Musterfrau'),
          kv('IncidentDispatcherReach', '+49 40 123456'),
          kv('SentByDispatcherAt', now),
        ]
      : []),
    kv('MissionDestination', 'Hamburg'),
    kv('MissionPostalCode', '20099'),
    kv('MissionObject', 'Hauptbahnhof'),
    kv('MissionStreet', 'Hachmannplatz'),
    kv('MissionHouseNumber', '16'),
    kv('MissionLatitude', '53.552886'),
    kv('MissionLongitude', '10.006583'),
    kv('MissionPositionSource', 'manualGIS'),
  ];

  const incident: IncidentDto = {
    id,
    sharedIncidentId,
    sender: o.sender,
    target: o.target,
    sentByDispatcherAt: now,
    sentByElsAt: now,
    classifications: ['RD1'],
    requestedResources: [],
    resources: [
      {
        resourceId: '200001',
        appendices: [
          kv('RadioCallSign', 'RK HH 1/83-1'),
          kv('Type', 'RTW'),
          kv('Name', 'RTW 1'),
          kv('Department', 'DRK Musterstadt'),
          kv('DepartmentType', 'Rettungsdienst'),
          kv('CommandVehicle', 'false'),
          kv('StatusTimeStamp', now),
          kv('Status', '3'),
        ],
        patients: [],
      },
    ],
    patients: [
      {
        id: '400001',
        resourceId: null,
        appendices: [
          kv('PatientFirstName', 'Max'),
          kv('PatientLastName', 'Mustermann'),
          kv('PatientGender', 'male'),
          ...(v11 ? [kv('PatientAge', '42'), kv('PatientAilment', 'Atemnot')] : [kv('Diagnosis', 'Atemnot')]),
        ],
      },
    ],
    informers: [
      {
        id: 'I-0815',
        appendices: [
          kv('InformerName', 'Mustermann'),
          kv('InformerFirstName', 'Maxine'),
          kv('InformerReach', '+49 (0) 1234 567890'),
        ],
      },
    ],
    appendices,
  };

  if (o.withResourceRequest) {
    incident.requestedResources = [
      { requestId: `${id}-1`, resourceType: 'RTW', targetId: o.target },
      { requestId: `${id}-2`, resourceType: 'NEF', targetId: o.target },
    ];
  }
  return incident;
}
