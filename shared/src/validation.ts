import { AppendixScope, findAppendixDefinition, getAppendixCatalog } from './appendix-catalog.js';
import {
  AppendixDto,
  ConfirmationDto,
  IncidentDto,
  MessageDto,
  ResourceRequestAction,
  ResourceRequestConfirmationDto,
} from './dto.js';
import { isAvailableIn, UcriVersion } from './version.js';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationOptions {
  /**
   * Fehlende Pflicht-Appendices (Kap. 4.2.4) als Fehler statt als Warnung werten.
   * Standardmäßig aus, da selbst die Beispiele der Spezifikation sie nicht vollständig enthalten.
   */
  strictRequiredAppendices?: boolean;
}

const UTC_ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export interface ParsedTimestamp {
  valid: boolean;
  /** Wert war – wie in den Beispielen der Spec – zusätzlich in Anführungszeichen gesetzt */
  quoted: boolean;
  value: string;
}

/** Prüft einen Zeitstempel nach Kap. 4.2.1 (ISO 8601, UTC). */
export function parseUcriTimestamp(raw: unknown): ParsedTimestamp {
  if (typeof raw !== 'string') return { valid: false, quoted: false, value: String(raw) };
  let value = raw.trim();
  let quoted = false;
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
    quoted = true;
  }
  return { valid: UTC_ISO_8601.test(value) && !Number.isNaN(Date.parse(value)), quoted, value };
}

/** Aktueller Zeitpunkt im UCRI-Format (ISO 8601, UTC, Millisekunden). */
export function nowUtc(): string {
  return new Date().toISOString();
}

class Collector {
  readonly issues: ValidationIssue[] = [];
  error(path: string, message: string) {
    this.issues.push({ severity: 'error', path, message });
  }
  warn(path: string, message: string) {
    this.issues.push({ severity: 'warning', path, message });
  }
  result(): ValidationResult {
    return { valid: !this.issues.some((i) => i.severity === 'error'), issues: this.issues };
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkTimestamp(c: Collector, path: string, raw: unknown, required: boolean) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) c.error(path, 'Zeitstempel fehlt');
    return;
  }
  const ts = parseUcriTimestamp(raw);
  if (!ts.valid) {
    c.error(path, `Zeitstempel "${String(raw)}" entspricht nicht ISO 8601 in UTC (z.B. 2018-10-22T13:13:00.000Z)`);
  } else if (ts.quoted) {
    c.warn(path, 'Zeitstempel ist zusätzlich in Anführungszeichen gesetzt (wie in den Spec-Beispielen) – akzeptiert');
  }
}

function checkAppendices(
  c: Collector,
  path: string,
  appendices: unknown,
  scope: AppendixScope,
  version: UcriVersion,
  options: ValidationOptions,
) {
  if (appendices === undefined || appendices === null) appendices = [];
  if (!Array.isArray(appendices)) {
    c.error(path, 'appendices muss ein Array von Appendix-DTOs sein');
    return;
  }
  const keys = new Set<string>();
  (appendices as AppendixDto[]).forEach((a, i) => {
    const p = `${path}[${i}]`;
    if (!a || typeof a !== 'object' || !isNonEmptyString(a.key)) {
      c.error(p, 'Appendix benötigt einen nicht-leeren "key"');
      return;
    }
    if (a.value !== null && a.value !== undefined && typeof a.value !== 'string') {
      c.error(`${p}.value`, `Appendix "${a.key}": value muss ein String sein`);
    }
    if (keys.has(a.key)) c.warn(p, `Appendix "${a.key}" ist mehrfach vorhanden`);
    keys.add(a.key);

    const def = findAppendixDefinition(scope, a.key);
    if (!def) {
      c.warn(p, `Appendix "${a.key}" ist für ${scope} nicht in der Spezifikation definiert (benutzerdefiniert)`);
      return;
    }
    if (!isAvailableIn(def.since, version)) {
      c.warn(p, `Appendix "${a.key}" ist erst ab UCRI ${def.since} definiert (aktiv: ${version})`);
    }
    const value = typeof a.value === 'string' ? a.value : '';
    if (def.type === 'timestamp' && value) checkTimestamp(c, `${p}.value`, value, false);
    if (def.type === 'number' && value && Number.isNaN(Number(value))) {
      c.warn(`${p}.value`, `Appendix "${a.key}": "${value}" ist keine Dezimalzahl`);
    }
    if (def.enumValues && value) {
      const values = def.multiple ? value.split(',').map((v) => v.trim()) : [value];
      for (const v of values) {
        if (def.enumValues.includes(v)) continue;
        const ci = def.enumValues.find((e) => e.toLowerCase() === v.toLowerCase());
        c.warn(
          `${p}.value`,
          ci
            ? `Appendix "${a.key}": "${v}" weicht in der Schreibweise ab, erwartet "${ci}"`
            : `Appendix "${a.key}": "${v}" ist kein erlaubter Wert [${def.enumValues.join('|')}]`,
        );
      }
    }
  });

  for (const def of getAppendixCatalog(version, scope).filter((d) => d.required)) {
    if (keys.has(def.key)) continue;
    const msg = `Pflicht-Appendix "${def.key}" (${def.prompt}) fehlt`;
    if (options.strictRequiredAppendices) c.error(path, msg);
    else c.warn(path, msg);
  }
}

/** Validiert ein Incident-DTO (Kap. 4.7) inkl. Appendices für die aktive UCRI-Version. */
export function validateIncident(
  incident: unknown,
  version: UcriVersion,
  options: ValidationOptions = {},
): ValidationResult {
  const c = new Collector();
  validateIncidentInto(c, incident, version, options, '');
  return c.result();
}

function validateIncidentInto(
  c: Collector,
  raw: unknown,
  version: UcriVersion,
  options: ValidationOptions,
  prefix: string,
) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    c.error(prefix || '$', 'Incident-DTO muss ein JSON-Objekt sein');
    return;
  }
  const incident = raw as IncidentDto & { Id?: string };
  const p = (s: string) => (prefix ? `${prefix}.${s}` : s);

  if (!isNonEmptyString(incident.id)) {
    if (isNonEmptyString(incident.Id)) c.warn(p('Id'), 'Property "Id" sollte "id" heißen (Schreibweise wie im Spec-Beispiel)');
    else c.error(p('id'), 'id fehlt');
  }
  if (!isNonEmptyString(incident.sharedIncidentId)) c.error(p('sharedIncidentId'), 'sharedIncidentId (GUID) fehlt');
  if (!isNonEmptyString(incident.sender)) c.error(p('sender'), 'sender fehlt');
  if (!isNonEmptyString(incident.target)) c.error(p('target'), 'target fehlt');
  checkTimestamp(c, p('sentByDispatcherAt'), incident.sentByDispatcherAt, false);
  checkTimestamp(c, p('sentByElsAt'), incident.sentByElsAt, false);

  if (!Array.isArray(incident.classifications)) {
    c.error(p('classifications'), 'classifications muss ein Array von Stichwortkürzeln sein');
  } else if (incident.classifications.some((x) => typeof x !== 'string')) {
    c.error(p('classifications'), 'classifications darf nur Strings enthalten');
  }

  checkAppendices(c, p('appendices'), incident.appendices, 'incident', version, options);

  checkArray(c, p('requestedResources'), incident.requestedResources, (rr, rp) => {
    if (!isNonEmptyString(rr.requestId)) c.error(`${rp}.requestId`, 'requestId fehlt');
    if (!isNonEmptyString(rr.resourceType)) c.error(`${rp}.resourceType`, 'resourceType fehlt');
    if (!isNonEmptyString(rr.targetId)) c.warn(`${rp}.targetId`, 'targetId fehlt');
  });
  checkArray(c, p('resources'), incident.resources, (r, rp) => {
    checkAppendices(c, `${rp}.appendices`, r.appendices, 'resource', version, options);
    checkArray(c, `${rp}.patients`, r.patients, (pt, pp) =>
      checkAppendices(c, `${pp}.appendices`, pt.appendices, 'patient', version, options),
    );
  });
  checkArray(c, p('patients'), incident.patients, (pt, pp) =>
    checkAppendices(c, `${pp}.appendices`, pt.appendices, 'patient', version, options),
  );
  checkArray(c, p('informers'), incident.informers, (inf, ip) =>
    checkAppendices(c, `${ip}.appendices`, inf.appendices, 'informer', version, options),
  );
  checkArray(c, p('sections'), incident.sections, (s, sp) => validateIncidentInto(c, s, version, options, sp));
}

function checkArray<T>(c: Collector, path: string, value: T[] | undefined, each: (item: T, path: string) => void) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    c.error(path, 'muss ein Array sein');
    return;
  }
  value.forEach((item, i) => {
    if (!item || typeof item !== 'object') c.error(`${path}[${i}]`, 'muss ein Objekt sein');
    else each(item, `${path}[${i}]`);
  });
}

/** Validiert ein Confirmation-DTO (Kap. 4.14). */
export function validateConfirmation(raw: unknown, version: UcriVersion): ValidationResult {
  const c = new Collector();
  if (!raw || typeof raw !== 'object') {
    c.error('$', 'Confirmation-DTO muss ein JSON-Objekt sein');
    return c.result();
  }
  const conf = raw as ConfirmationDto;
  if (!isNonEmptyString(conf.sharedIncidentId)) c.warn('sharedIncidentId', 'sharedIncidentId fehlt');
  if (!isNonEmptyString(conf.status)) c.error('status', 'status fehlt');
  else if (!['Accepted', 'Rejected'].includes(conf.status)) {
    c.warn('status', `status "${conf.status}" ist kein Spec-Wert (Accepted, Rejected)`);
  }
  checkTimestamp(c, 'timestamp', conf.timestamp, true);
  if (conf.status === 'Rejected' && !isNonEmptyString(conf.cause)) c.warn('cause', 'Bei Ablehnung sollte ein Grund (cause) angegeben werden');
  checkAppendices(c, 'appendices', conf.appendices, 'confirmation', version, {});
  return c.result();
}

/** Validiert eine Quittierung der Einsatzmittelanforderung (Kap. 4.15–4.18). */
export function validateResourceRequestConfirmation(
  raw: unknown,
  action: ResourceRequestAction,
): ValidationResult {
  const c = new Collector();
  if (!raw || typeof raw !== 'object') {
    c.error('$', 'Quittierung muss ein JSON-Objekt sein');
    return c.result();
  }
  const conf = raw as ResourceRequestConfirmationDto & Record<string, unknown>;
  if (!isNonEmptyString(conf.requestId)) c.error('requestId', 'requestId fehlt');
  checkTimestamp(c, 'timestamp', conf.timestamp, true);
  if ((action === 'accept' || action === 'confirmTurnOut') && !isNonEmptyString(conf['resourceType'])) {
    c.warn('resourceType', 'resourceType (entsendeter Ressourcentyp) fehlt');
  }
  return c.result();
}

/** Validiert ein Message-DTO (Kap. 4.8). */
export function validateMessage(raw: unknown): ValidationResult {
  const c = new Collector();
  if (!raw || typeof raw !== 'object') {
    c.error('$', 'Message-DTO muss ein JSON-Objekt sein');
    return c.result();
  }
  const msg = raw as MessageDto;
  if (!isNonEmptyString(msg.sharedIncidentId)) c.warn('sharedIncidentId', 'sharedIncidentId fehlt');
  if (typeof msg.message !== 'string') c.error('message', 'message fehlt');
  return c.result();
}
