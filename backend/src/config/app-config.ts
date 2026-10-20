import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ClassificationDto,
  isUcriVersion,
  ResourceTypeDto,
  UcriVersion,
} from '@ucri/shared';

export interface InboundClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface PartnerConfig {
  id: string;
  name: string;
  /** Base-Url der UCRI-Schnittstelle des Partners inkl. "/api", z.B. https://partner.example/api */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Leitstellenkennung des Partners (sender/target im Incident-DTO), Default: id */
  controlCenterId?: string;
}

export interface AppConfig {
  port: number;
  ucriVersion: UcriVersion;
  applicationName: string;
  ownControlCenterId: string;
  ownControlCenterName: string;
  /** Öffentliche Base-Url der eigenen UCRI-API (für Links in Home- und NotAuthorized-DTO) */
  publicBaseUrl: string;
  jwtSecret: string;
  tokenLifetimeSec: number;
  /** Spec nennt expires_in "Unix-Timestamp", das Beispiel zeigt eine Dauer (3600) */
  tokenExpiresInFormat: 'seconds' | 'unixTimestamp';
  strictRequiredAppendices: boolean;
  requestTimeoutMs: number;
  inboundClients: InboundClientConfig[];
  partners: PartnerConfig[];
  classifications: ClassificationDto[];
  resourceTypes: ResourceTypeDto[];
  /** Pfad der geladenen Config-Datei (nur informativ) */
  configPath?: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const DEFAULTS: Omit<AppConfig, 'ucriVersion'> = {
  port: 3000,
  applicationName: 'UCRI Test-Client',
  ownControlCenterId: 'els-test',
  ownControlCenterName: 'Test-Leitstelle',
  publicBaseUrl: 'http://localhost:3000/api',
  jwtSecret: 'change-me',
  tokenLifetimeSec: 3600,
  tokenExpiresInFormat: 'seconds',
  strictRequiredAppendices: false,
  requestTimeoutMs: 15000,
  inboundClients: [],
  partners: [],
  classifications: [],
  resourceTypes: [],
};

/** Sucht `relative` ausgehend von den Startverzeichnissen aufwärts. */
export function findUp(relative: string, starts: string[]): string | undefined {
  for (const start of starts) {
    let dir = resolve(start);
    for (;;) {
      const candidate = join(dir, relative);
      if (existsSync(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return undefined;
}

export function moduleDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export class ConfigError extends Error {}

/**
 * Lädt die Konfiguration aus `CONFIG_PATH` bzw. `config/ucri.config.json`.
 * ENV-Variablen überschreiben einzelne Werte: UCRI_VERSION, PORT, JWT_SECRET, PUBLIC_BASE_URL.
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const configPath = env.CONFIG_PATH
    ? resolve(env.CONFIG_PATH)
    : findUp('config/ucri.config.json', [process.cwd(), moduleDir()]);

  let fileConfig: Partial<AppConfig> = {};
  if (configPath) {
    if (!existsSync(configPath))
      throw new ConfigError(`Config-Datei nicht gefunden: ${configPath}`);
    try {
      fileConfig = JSON.parse(
        readFileSync(configPath, 'utf8'),
      ) as Partial<AppConfig>;
    } catch (e) {
      throw new ConfigError(
        `Config-Datei ${configPath} ist kein gültiges JSON: ${(e as Error).message}`,
      );
    }
  }

  const merged = { ...DEFAULTS, ...fileConfig } as AppConfig;
  if (env.UCRI_VERSION) merged.ucriVersion = env.UCRI_VERSION as UcriVersion;
  if (env.PORT) merged.port = Number(env.PORT);
  if (env.JWT_SECRET) merged.jwtSecret = env.JWT_SECRET;
  if (env.PUBLIC_BASE_URL) merged.publicBaseUrl = env.PUBLIC_BASE_URL;
  merged.configPath = configPath;

  validateAppConfig(merged);
  return merged;
}

export function validateAppConfig(c: AppConfig): void {
  const errors: string[] = [];
  if (!isUcriVersion(c.ucriVersion)) {
    errors.push(
      `ucriVersion muss "1.0" oder "1.1" sein (ist: ${JSON.stringify(c.ucriVersion)})`,
    );
  }
  if (!Number.isInteger(c.port) || c.port <= 0)
    errors.push('port muss eine positive Ganzzahl sein');
  if (!c.jwtSecret) errors.push('jwtSecret fehlt');
  if (!['seconds', 'unixTimestamp'].includes(c.tokenExpiresInFormat)) {
    errors.push(
      'tokenExpiresInFormat muss "seconds" oder "unixTimestamp" sein',
    );
  }
  const ids = new Set<string>();
  for (const [i, p] of c.partners.entries()) {
    for (const field of [
      'id',
      'name',
      'baseUrl',
      'clientId',
      'clientSecret',
    ] as const) {
      if (!p[field]) errors.push(`partners[${i}].${field} fehlt`);
    }
    if (ids.has(p.id)) errors.push(`partners[${i}].id "${p.id}" ist doppelt`);
    ids.add(p.id);
  }
  for (const [i, ic] of c.inboundClients.entries()) {
    if (!ic.clientId || !ic.clientSecret)
      errors.push(`inboundClients[${i}] benötigt clientId und clientSecret`);
  }
  if (errors.length)
    throw new ConfigError(
      `Ungültige Konfiguration:\n - ${errors.join('\n - ')}`,
    );
}
