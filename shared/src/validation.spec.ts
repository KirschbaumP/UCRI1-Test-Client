import { describe, expect, it } from 'vitest';
import { getAppendixCatalog } from './appendix-catalog.js';
import { createSampleIncident } from './samples.js';
import { parseUcriTimestamp, validateConfirmation, validateIncident } from './validation.js';

const sample = (version: '1.0' | '1.1') => createSampleIncident({ version, sender: 'a', target: 'b' });

describe('parseUcriTimestamp', () => {
  it('akzeptiert ISO 8601 in UTC', () => {
    expect(parseUcriTimestamp('2018-10-22T13:13:00.000Z')).toMatchObject({ valid: true, quoted: false });
  });

  it('akzeptiert die zusätzlich gequoteten Werte aus den Spec-Beispielen', () => {
    expect(parseUcriTimestamp('"2018-10-22T13:13:00.000Z"')).toMatchObject({ valid: true, quoted: true });
  });

  it('lehnt lokale Zeiten und andere Formate ab', () => {
    expect(parseUcriTimestamp('2018-10-22T13:13:00+02:00').valid).toBe(false);
    expect(parseUcriTimestamp('22.10.2018 13:13').valid).toBe(false);
  });
});

describe('getAppendixCatalog', () => {
  it('enthält in 1.0 keine erst in 1.1 definierten Keys', () => {
    const keys = getAppendixCatalog('1.0').map((d) => d.key);
    expect(keys).toContain('IncidentId');
    expect(keys).not.toContain('SharedIncidentId');
    expect(keys).not.toContain('PatientAge');
    expect(getAppendixCatalog('1.0', 'confirmation')).toHaveLength(0);
  });

  it('enthält in 1.1 zusätzlich die neuen Appendices', () => {
    const keys = getAppendixCatalog('1.1').map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining(['SharedIncidentId', 'PatientAge', 'TargetIncidentID']));
  });
});

describe('validateIncident', () => {
  it('Beispiel-Einsatz ist in beiden Versionen gültig und ohne Warnungen', () => {
    for (const v of ['1.0', '1.1'] as const) {
      const r = validateIncident(sample(v), v);
      expect(r.valid).toBe(true);
      expect(r.issues).toEqual([]);
    }
  });

  it('warnt bei 1.1-Appendices, wenn 1.0 aktiv ist', () => {
    const r = validateIncident(sample('1.1'), '1.0');
    expect(r.valid).toBe(true);
    expect(r.issues.some((i) => i.message.includes('"SharedIncidentId" ist erst ab UCRI 1.1'))).toBe(true);
  });

  it('meldet fehlende Kopfdaten als Fehler', () => {
    const r = validateIncident({ id: '1' }, '1.1');
    expect(r.valid).toBe(false);
    expect(r.issues.filter((i) => i.severity === 'error').map((i) => i.path)).toEqual(
      expect.arrayContaining(['sharedIncidentId', 'sender', 'target', 'classifications']),
    );
  });

  it('fehlende Pflicht-Appendices: Warnung, im strikten Modus Fehler', () => {
    const inc = sample('1.1');
    inc.appendices = inc.appendices!.filter((a) => a.key !== 'MissionDestination');
    expect(validateIncident(inc, '1.1').valid).toBe(true);
    expect(validateIncident(inc, '1.1', { strictRequiredAppendices: true }).valid).toBe(false);
  });

  it('prüft Zeitstempel und Enum-Werte in Appendices', () => {
    const inc = sample('1.1');
    inc.sentByElsAt = '22.10.2018';
    inc.patients![0].appendices.push({ key: 'TriageTag', value: 'T2' });
    inc.patients![0].appendices.find((a) => a.key === 'PatientGender')!.value = 'Male';
    const r = validateIncident(inc, '1.1');
    expect(r.issues.find((i) => i.path === 'sentByElsAt')?.severity).toBe('error');
    expect(r.issues.some((i) => i.message.includes('"T2" ist kein erlaubter Wert'))).toBe(true);
    expect(r.issues.some((i) => i.message.includes('erwartet "male"'))).toBe(true);
  });
});

describe('validateConfirmation', () => {
  it('Confirmation-Appendices sind in 1.0 nicht definiert', () => {
    const conf = {
      sharedIncidentId: 'x',
      status: 'Accepted',
      timestamp: '2024-05-24T10:00:00.000Z',
      appendices: [{ key: 'TargetIncidentID', value: '1' }],
    };
    expect(validateConfirmation(conf, '1.1').issues).toEqual([]);
    expect(validateConfirmation(conf, '1.0').issues[0].message).toContain('erst ab UCRI 1.1');
  });
});
