import { isAvailableIn, UcriVersion } from './version.js';

/**
 * Katalog der definierten Zusatzdaten (Appendices) gemäß Kap. 4.2.4.
 * `since` entspricht der Spalte "Ab Ver." der V1.1-Spezifikation,
 * `required` den farbig hinterlegten Pflichtfeldern.
 */

export type AppendixScope = 'incident' | 'informer' | 'resource' | 'patient' | 'confirmation';

export type AppendixValueType = 'string' | 'boolean' | 'number' | 'timestamp' | 'enum';

export interface AppendixDefinition {
  key: string;
  prompt: string;
  description: string;
  scope: AppendixScope;
  since: UcriVersion;
  required: boolean;
  /** fachliche Gruppe innerhalb der Tabelle (z.B. Einsatzstelle, ECall) */
  group?: string;
  type: AppendixValueType;
  enumValues?: string[];
  /** Kommaseparierte Mehrfachwerte erlaubt */
  multiple?: boolean;
}

export const GENDER_VALUES = ['female', 'male', 'diverse'];
export const POSITION_SOURCE_VALUES = ['manualGIS', 'externalSource', 'object', 'segment', 'street', 'city'];
export const TRIAGE_TAG_VALUES = ['green', 'yellow', 'red', 'blue', 'black'];
export const PROPULSION_STORAGE_VALUES = [
  'gasolineTank',
  'dieselTank',
  'compressedNaturalGas',
  'liquidePropaneGas',
  'electricEnergyStorage',
  'hydrogenStorage',
];

type Options = Partial<Pick<AppendixDefinition, 'required' | 'group' | 'type' | 'enumValues' | 'multiple'>>;

function def(
  scope: AppendixScope,
  key: string,
  prompt: string,
  description: string,
  since: UcriVersion,
  options: Options = {},
): AppendixDefinition {
  return {
    scope,
    key,
    prompt,
    description,
    since,
    required: options.required ?? false,
    group: options.group,
    type: options.type ?? (options.enumValues ? 'enum' : 'string'),
    enumValues: options.enumValues,
    multiple: options.multiple,
  };
}

const bool: Options = { type: 'boolean', enumValues: ['true', 'false'] };
const num: Options = { type: 'number' };
const ts: Options = { type: 'timestamp' };

const incident = (key: string, prompt: string, description: string, since: UcriVersion, o?: Options) =>
  def('incident', key, prompt, description, since, o);
const informer = (key: string, prompt: string, description: string, since: UcriVersion, o?: Options) =>
  def('informer', key, prompt, description, since, o);
const resource = (key: string, prompt: string, description: string, since: UcriVersion, o?: Options) =>
  def('resource', key, prompt, description, since, o);
const patient = (key: string, prompt: string, description: string, since: UcriVersion, o?: Options) =>
  def('patient', key, prompt, description, since, o);
const confirmation = (key: string, prompt: string, description: string, since: UcriVersion, o?: Options) =>
  def('confirmation', key, prompt, description, since, o);

const MISSION = 'Einsatzstelle';
const ECALL = 'ECall';
const INFORMER_ADDRESS = 'Adresse';
const POSITION = 'Position';
const STATUS = 'Status';
const DEVIATING = 'abweichende Einsatzstelle';
const PATIENT_ADDRESS = 'Adresse';
const TRANSPORT = 'Transportziel';

export const APPENDIX_CATALOG: readonly AppendixDefinition[] = [
  // 4.2.4.1 Incident Appendices
  incident('IncidentId', 'Incident-ID', 'Eindeutige ID des Einsatzes', '1.0', { required: true }),
  incident('SharedIncidentId', 'Geteilte Incident-ID', 'GUID zur Identifizierung des Einsatzes auf allen beteiligten Systemen', '1.1'),
  incident('SourceId', 'Absender-ID', 'Identifikation der sendenden Leitstelle', '1.0', { required: true }),
  incident('TargetId', 'Empfänger-ID', 'Identifikation der Ziel-Leitstelle', '1.0', { required: true }),
  incident('ControlCenterName', 'Leitstellenname', 'Name der sendenden Leitstelle', '1.0', { required: true }),
  incident('IncidentStartTimeStamp', 'Einsatzbeginn', 'Zeitstempel des Einsatzbeginns', '1.0', ts),
  incident('TransactionNumber', 'Vorgangsnummer', 'Vorgangsnummer (ggf. lesbare ID)', '1.0'),
  incident('Classification', 'Stichwortkürzel', 'Stichworte (Komma getrennt)', '1.0', { required: true, multiple: true }),
  incident('IncidentFlashingLights', 'Sondersignal', 'Sonderrechte des Einsatzes', '1.0', bool),
  incident('Issue', 'Sachverhalt', 'Taktische Bewertung: Sachverhalt', '1.0'),
  incident('IncidentAdditionalInfo', 'Zusatzinformationen', 'Freitext zur Beschreibung des Einsatzes, Zusatzinformationen, Meldebild', '1.1'),
  incident('IncidentDispatcherID', 'Disponenten ID', 'ID des Disponenten der sendenden Leitstelle', '1.1'),
  incident('IncidentDispatcherName', 'Disponenten Name', 'Name des Disponenten der sendenden Leitstelle', '1.1'),
  incident('IncidentDispatcherReach', 'Disponenten Erreichbarkeit', 'Erreichbarkeit (z.B. Telefonnummer) des Disponenten der sendenden Leitstelle', '1.1'),
  incident('SentByDispatcherAt', 'Übergabe Zeitpunkt', 'Zeitpunkt der Übergabe der Anfrage durch den Disponenten der sendenden Leitstelle', '1.1', ts),
  incident('MissionDestination', 'Einsatzort', 'Einsatzstelle: Ort', '1.0', { required: true, group: MISSION }),
  incident('MissionCityDistrict', 'Stadtbezirk / Ortsteil', 'Einsatzstelle: Stadtbezirk oder Ortsteil', '1.1', { group: MISSION }),
  incident('MissionPostalCode', 'PLZ', 'Einsatzstelle: PLZ', '1.0', { group: MISSION }),
  incident('MissionObject', 'Objekt', 'Einsatzstelle: Bezeichnung Objekt, Firmenname, …', '1.0', { group: MISSION }),
  incident('MissionObjectType', 'Objekt Typ', 'Einsatzstelle: Objekttyp (z.B. Krankenhaus, Krankenhausabteilung, Kindergarten, Tankstelle, …)', '1.0', { group: MISSION }),
  incident('MissionSuperiorObject', 'Übergeordnetes Objekt', 'übergeordnetes Objekt der Einsatzstelle (z.B. Krankenhaus bei Angabe einer Abteilung als Objekt)', '1.0', { group: MISSION }),
  incident('MissionStreet', 'Einsatzstraße', 'Einsatzstelle: Straße', '1.0', { group: MISSION }),
  incident('MissionHouseNumber', 'Hausnummer', 'Einsatzstelle: Hausnummer', '1.0', { group: MISSION }),
  incident('MissionStreetSegment', 'Straßensegment', 'Einsatzstelle: Straßensegment', '1.0', { group: MISSION }),
  incident('MissionFloor', 'Etage', 'Einsatzstelle: Etage', '1.0', { group: MISSION }),
  incident('MissionDoor', 'Tür', 'Einsatzstelle: Tür', '1.0', { group: MISSION }),
  incident('MissionStaircase', 'Treppenhaus', 'Einsatzstelle: Treppenhaus', '1.0', { group: MISSION }),
  incident('MissionAccessibility', 'Zugänglichkeit', 'Einsatzstelle: Zugang der Einsatzstelle uneingeschränkt möglich', '1.1', { ...bool, group: MISSION }),
  incident('MissionAdditionalInfo', 'Zusatzinformationen', 'Einsatzstelle: Freitext zur Beschreibung von Besonderheiten an der Einsatzstelle', '1.1', { group: MISSION }),
  incident('MissionLongitude', 'Längengrad', 'Einsatzstelle: Längengrad (WGS84, dezimal)', '1.0', { ...num, group: MISSION }),
  incident('MissionLatitude', 'Breitengrad', 'Einsatzstelle: Breitengrad (WGS84, dezimal)', '1.0', { ...num, group: MISSION }),
  incident('MissionPositionSource', 'Quelle Position', 'Einsatzstelle: Gibt an, aus welcher Quelle die Geokoordinaten stammen', '1.0', { enumValues: POSITION_SOURCE_VALUES, group: MISSION }),
  incident('eCallAutomaticActivation', 'Automatische Aktivierung', 'Wurde der eCall automatisch oder manuell ausgelöst', '1.0', { ...bool, group: ECALL }),
  incident('eCallPositionCanBeTrusted', 'Positionsvertrauenswürdigkeit', 'Ist die angegebene Fahrzeugposition vertrauenswürdig. Wert aus MSD', '1.0', { ...bool, group: ECALL }),
  incident('eCallVehicleType', 'Fahrzeugtyp', 'Fahrzeugtyp aus MSD, z.B. M1 für PKW', '1.0', { group: ECALL }),
  incident('eCallVin', 'Fahrzeugkennung', 'Fahrzeugidentifikationsnummer', '1.0', { group: ECALL }),
  incident('eCallVehiclePropulsionStorageType', 'Fahrzeugenergiespeicherart', 'Kommaseparierte Liste der Energiespeicherarten', '1.0', { enumValues: PROPULSION_STORAGE_VALUES, multiple: true, group: ECALL }),
  incident('eCallTimestamp', 'Zeitstempel', 'Zeitpunkt des eCall aus MSD', '1.0', { ...ts, group: ECALL }),
  incident('eCallVehicleLatitude', 'Breitengrad', 'Breitengrad der Fahrzeugposition', '1.0', { ...num, group: ECALL }),
  incident('eCallVehicleLongitude', 'Längengrad', 'Längengrad der Fahrzeugposition', '1.0', { ...num, group: ECALL }),
  incident('eCallDirectionOfTravel', 'Fahrtrichtung', 'Letzte bekannte Fahrtrichtung in Grad. Auflösung in 2° Schritten', '1.0', { ...num, group: ECALL }),
  incident('eCallLatitudeN1', 'Breitengrad N1', 'Breitengrad Position N1', '1.0', { ...num, group: ECALL }),
  incident('eCallLongitudeN1', 'Längengrad N1', 'Längengrad Position N1', '1.0', { ...num, group: ECALL }),
  incident('eCallLatitudeN2', 'Breitengrad N2', 'Breitengrad Position N2', '1.0', { ...num, group: ECALL }),
  incident('eCallLongitudeN2', 'Längengrad N2', 'Längengrad Position N2', '1.0', { ...num, group: ECALL }),
  incident('eCallPassengers', 'Anzahl der Fahrzeuginsassen', 'Anzahl der Fahrzeuginsassen', '1.0', { ...num, group: ECALL }),

  // 4.2.4.2 Informer Appendices
  informer('InformerName', 'Mitteiler - Name', 'Nachname des Mitteilers', '1.0'),
  informer('InformerFirstName', 'Mitteiler - Vorname', 'Vorname des Mitteilers', '1.0'),
  informer('InformerMiddleName', 'Mitteiler - Zweitname', 'Zweitname des Mitteilers', '1.0'),
  informer('InformerDateOfBirth', 'Mitteiler - Geburtsdatum', 'Geburtsdatum des Mitteilers', '1.0', ts),
  informer('InformerGender', 'Mitteiler - Geschlecht', 'Geschlecht des Mitteilers', '1.0', { enumValues: GENDER_VALUES }),
  informer('InformerReach', 'Mitteiler - Erreichbarkeit', 'Erreichbarkeit des Mitteilers', '1.0'),
  informer('InformerAdditionalInfo', 'Zusatzinformationen', 'Freitext zur Beschreibung des Mitteilers', '1.1'),
  informer('InformerCity', 'Mitteiler - Ort', 'Mitteiler: Stadt', '1.0', { group: INFORMER_ADDRESS }),
  // Key laut Spezifikation V1.1 (Tabelle 4.2.4.2) wörtlich übernommen
  informer('MissionCityDistrict', 'Stadtbezirk / Ortsteil', 'Stadtbezirk oder Ortsteil (Key laut Spec-Tabelle der Informer Appendices)', '1.1', { group: INFORMER_ADDRESS }),
  informer('InformerPostalCode', 'Mitteiler - PLZ', 'Mitteiler: PLZ', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerStreet', 'Mitteiler - Straße', 'Mitteiler: Straße', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerHouseNumber', 'Mitteiler - Hausnummer', 'Mitteiler: Hausnummer', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerSegment', 'Mitteiler - Segment', 'Mitteiler: Straßensegment', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerFloor', 'Mitteiler - Etage', 'Mitteiler: Etage', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerDoor', 'Mitteiler - Tür', 'Mitteiler: Wohnungstür / -nummer', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerStaircase', 'Mitteiler - Treppenhaus', 'Mitteiler: Treppenhaus', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerObject', 'Mitteiler - Objekt', 'Mitteiler: Bezeichnung Objekt, Firmenname, …', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerObjectType', 'Mitteiler - Objekt Typ', 'Mitteiler: Objekttyp (z.B. Krankenhaus, Kindergarten, Tankstelle, …)', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerSuperiorObject', 'Mitteiler - Übergeordnetes Objekt', 'Mitteiler: Übergeordnetes Objekt (z.B. Krankenhaus bei Angabe einer Abteilung als Objekt)', '1.0', { group: INFORMER_ADDRESS }),
  informer('InformerLongitude', 'Mitteiler - Längengrad', 'Standort Mitteiler: Längengrad', '1.1', { ...num, group: INFORMER_ADDRESS }),
  informer('InformerLatitude', 'Mitteiler - Breitengrad', 'Standort Mitteiler: Breitengrad', '1.1', { ...num, group: INFORMER_ADDRESS }),
  informer('InformerPositionSource', 'Mitteiler - Quelle Position', 'Standort Mitteiler: Gibt an, aus welcher Quelle die Geokoordinaten stammen', '1.1', { enumValues: POSITION_SOURCE_VALUES, group: INFORMER_ADDRESS }),

  // 4.2.4.3 Resource Appendices
  resource('RadioCallSign', 'Funkrufname', 'Funkrufname', '1.0', { required: true }),
  resource('Type', 'Fahrzeugtyp', 'Fahrzeugtyp', '1.0', { required: true }),
  resource('Name', 'Fahrzeugname', 'Fahrzeugname', '1.0'),
  resource('Department', 'Hilfsorganisation', 'Hilfsorganisation (z.B. Feuerwehr Musterstadt, DRK Musterkreis, …)', '1.0'),
  resource('DepartmentType', 'Hilfetyp', 'Hilfetyp (z.B. Feuerwehr, Rettungsdienst, Stadtwerke, …)', '1.0'),
  resource('OrderNumber', 'Auftragsnummer', 'Auftragsnummer', '1.0'),
  resource('CommandVehicle', 'Führungsfahrzeug', 'Handelt es sich um das Führungsfahrzeug?', '1.0', bool),
  resource('RequesterRessource', 'Anfordernde Ressource', 'Hat diese Ressource Unterstützung (z.B. TNA) angefordert?', '1.1'),
  resource('PositionTimeStamp', 'Zeitstempel', 'Der Zeitpunkt, an dem die Position der Ressource zum letzten Mal aktualisiert wurde', '1.0', { ...ts, group: POSITION }),
  resource('Longitude', 'Längengrad', 'Der Längengrad der Position einer Ressource', '1.0', { ...num, group: POSITION }),
  resource('Latitude', 'Breitengrad', 'Der Breitengrad der Position einer Ressource', '1.0', { ...num, group: POSITION }),
  resource('StatusTimeStamp', 'Zeitstempel', 'Der Zeitpunkt, an dem der Status der Ressource zum letzten Mal aktualisiert wurde', '1.0', { ...ts, group: STATUS }),
  resource('Status', 'Status', 'Der Status der Ressource', '1.0', { group: STATUS }),
  resource('MissionLocation', 'Ort', 'Ort der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionPostalCode', 'PLZ', 'PLZ der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionStreet', 'Straße', 'Straße der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionHouseNumber', 'Hausnummer', 'Hausnummer der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionObject', 'Objekt', 'Bezeichnung Objekt, Firmenname, … der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionObjectType', 'Objekt Typ', 'Typ des Objekts der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionSuperiorObject', 'Übergeordnetes Objekt', 'übergeordnetes Objekt der abweichenden Einsatzstelle', '1.0', { group: DEVIATING }),
  resource('MissionLongitude', 'Längengrad', 'Längengrad der abweichenden Einsatzstelle', '1.0', { ...num, group: DEVIATING }),
  resource('MissionLatitude', 'Breitengrad', 'Breitengrad der abweichenden Einsatzstelle', '1.0', { ...num, group: DEVIATING }),
  resource('MissionPositionSource', 'Quelle Position', 'Gibt an, aus welcher Quelle die Geokoordinaten stammen', '1.0', { enumValues: POSITION_SOURCE_VALUES, group: DEVIATING }),

  // 4.2.4.4 Patient Appendices
  patient('PatientFirstName', 'Vorname', 'Vorname des Patienten', '1.0'),
  patient('PatientMiddleName', 'Zweitname', 'Zweitname des Patienten', '1.0'),
  patient('PatientLastName', 'Nachname', 'Nachname des Patienten', '1.0'),
  patient('PatientDateOfBirth', 'Geburtsdatum', 'Geburtsdatum des Patienten', '1.0', ts),
  patient('PatientAge', 'Alter', 'Alter des Patienten', '1.1', num),
  patient('PatientGender', 'Geschlecht', 'Geschlecht des Patienten', '1.0', { enumValues: GENDER_VALUES }),
  patient('PatientReach', 'Erreichbarkeit', 'Erreichbarkeit (z.B. Telefonnummer) des Patienten', '1.1'),
  patient('TriageTag', 'Sichtungskategorie', 'Im MANV: Kategorie des Patienten nach der Sichtung', '1.0', { enumValues: TRIAGE_TAG_VALUES }),
  patient('RegistrationCardId', 'Verletztenanhängekarte ID', 'ID der Verletztenanhängekarte', '1.0'),
  patient('HealthInsuranceCompany', 'Krankenkasse', 'Name der Krankenkasse des Patienten', '1.0'),
  patient('HealthInsuranceCompanyNumber', 'Krankenkassennummer', 'Nummer der Krankenkasse des Patienten', '1.0'),
  patient('InsuranceNumber', 'Versichertennummer', 'Versichertennummer des Patienten', '1.0'),
  patient('Diagnosis', 'Diagnose', 'Hauptbeschwerde des Patienten (keine Diagnose!) – entfällt in UCRI 2.0', '1.0'),
  patient('PatientRMI', 'RMI', 'Rückmeldeindikation (3-stellig)', '1.1'),
  patient('PatientRMC', 'RMC', 'Rückmeldecode aus standardisierter Notrufabfrage', '1.1'),
  patient('PatientPZC', 'PZC', 'Patientenzuweisungscode (6-stellig): RMI + Alter + Dringlichkeit', '1.1'),
  patient('PatientAilment', 'Beschwerden', 'Freitext zur Beschreibung der Beschwerden (Meldebild)', '1.1'),
  patient('PatientInfectionInfo', 'Infektions-Information', 'Freitext zur Beschreibung einer möglichen Infektion', '1.1'),
  patient('TransportNumber', 'Transportnummer', 'Transportnummer für den Patienten auf dem zugeordneten Fahrzeug', '1.1'),
  patient('PatientLocation', 'Ort', 'Ort der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('PatientPostalCode', 'PLZ', 'PLZ der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('PatientStreet', 'Straße', 'Straße der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('PatientHouseNumber', 'Hausnummer', 'Hausnummer der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('PatientObject', 'Objekt', 'Bezeichnung Objekt, Firmenname, … der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('PatientObjectType', 'Objekt Typ', 'Typ des Objekts der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('PatientSuperiorObject', 'Übergeordnetes Objekt', 'übergeordnetes Objekt der Adresse', '1.0', { group: PATIENT_ADDRESS }),
  patient('TransportLocation', 'Ort', 'Ort des Transportziels', '1.0', { group: TRANSPORT }),
  patient('TransportPostalCode', 'PLZ', 'PLZ des Transportziels', '1.0', { group: TRANSPORT }),
  patient('TransportStreet', 'Straße', 'Straße des Transportziels', '1.0', { group: TRANSPORT }),
  patient('TransportHouseNumber', 'Hausnummer', 'Hausnummer des Transportziels', '1.0', { group: TRANSPORT }),
  patient('TransportObject', 'Objekt', 'Bezeichnung Objekt, Firmenname, … des Transportziels', '1.0', { group: TRANSPORT }),
  patient('TransportObjectType', 'Objekt Typ', 'Typ des Objekts des Transportziels', '1.0', { group: TRANSPORT }),
  patient('TransportSuperiorObject', 'Übergeordnetes Objekt', 'übergeordnetes Objekt des Transportziels', '1.0', { group: TRANSPORT }),

  // 4.2.4.5 Confirmation Appendices (erst ab V1.1)
  confirmation('AcceptedByDispatcherAt', 'Annahme Zeitpunkt', 'Zeitpunkt der Annahme der Anfrage durch den Disponenten der empfangenden Leitstelle', '1.1', ts),
  confirmation('TargetDispatcherID', 'Empfangender Disponent', 'ID des Disponenten der empfangenden Leitstelle', '1.1'),
  confirmation('TargetIncidentID', 'ID des Einsatzes im Zielsystem', 'Eindeutige ID des Einsatzes der empfangenden Leitstelle', '1.1'),
  confirmation('IncidentStartTimeStamp', 'Einsatzbeginn Zielsystem', 'Zeitstempel des Einsatzbeginns der empfangenden Leitstelle', '1.1', ts),
];

/** Alle Appendix-Definitionen, die in der angegebenen UCRI-Version gültig sind. */
export function getAppendixCatalog(version: UcriVersion, scope?: AppendixScope): AppendixDefinition[] {
  return APPENDIX_CATALOG.filter((d) => isAvailableIn(d.since, version) && (!scope || d.scope === scope));
}

export function findAppendixDefinition(scope: AppendixScope, key: string): AppendixDefinition | undefined {
  return APPENDIX_CATALOG.find((d) => d.scope === scope && d.key === key);
}
