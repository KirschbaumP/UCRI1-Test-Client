/**
 * Data-Transfer-Objects gemäß UCRI-Spezifikation Kap. 4 (identisch in V1.0 und V1.1).
 */

/** 4.1.2 Links */
export interface Link {
  rel: string;
  href: string;
  label?: string | null;
  name?: string | null;
}

/** 4.4 Version-DTO */
export interface VersionDto {
  ucriVersion: string;
  version: string;
  applicationName: string;
}

/** 4.3 Home-DTO */
export interface HomeDto {
  version: VersionDto;
  links: Link[];
}

/** 4.5 JSON Web Token (Feldnamen laut Tabelle 4.5 und OpenAPI in camelCase) */
export interface JwtDto {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

/** 4.5 JSON Web Token (Feldnamen laut Beispiel der Spezifikation in snake_case) */
export interface JwtSnakeCaseDto {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/** Antwort von /authorize: camelCase, snake_case oder beides */
export type JwtResponseDto = Partial<JwtDto> & Partial<JwtSnakeCaseDto>;

/** 4.1 Hypermedia-Formate */
export const JSON_MEDIA_TYPE = 'application/json';
export const SIMPLEMEDIA_TYPE = 'application/vnd.simplemedia+json';
export type UcriMediaType = typeof JSON_MEDIA_TYPE | typeof SIMPLEMEDIA_TYPE;

/** Liefert die Einträge einer Liste – als JSON-Array oder als simplemedia-itemcollection (4.1.1). */
export function itemsOf<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  const coll = (body as { itemcollection?: { item: T }[] } | undefined)?.itemcollection;
  return Array.isArray(coll) ? coll.map((c) => c.item) : [];
}

/** 4.6 NotAuthorized-DTO */
export interface NotAuthorizedDto {
  message: string;
  authorizeLink: Link;
}

/** 4.12 Appendix-DTO */
export interface AppendixDto {
  key: string;
  value: string;
}

/** 4.11 Patient-DTO */
export interface PatientDto {
  incidentId?: string;
  resourceId?: string | null;
  id: string;
  thumbprint?: string;
  appendices: AppendixDto[];
}

/** 4.10 Resource-DTO */
export interface ResourceDto {
  incidentId?: string;
  id?: string;
  /** im Incident-Beispiel als resourceId */
  resourceId?: string;
  stationId?: string;
  alarmMarchOutOrderNo?: string;
  appendices: AppendixDto[];
  patients?: PatientDto[];
}

/** 4.9 Informer-DTO */
export interface InformerDto {
  incidentId?: string;
  id: string;
  appendices: AppendixDto[];
}

/** 4.13 ResourceRequest-DTO */
export interface ResourceRequestDto {
  requestId: string;
  resourceType: string;
  targetId: string;
  resourceName?: string;
  resourceId?: string;
  links?: Link[];
}

/** 4.7 Incident-DTO */
export interface IncidentDto {
  id: string;
  sharedIncidentId: string;
  sender: string;
  target: string;
  sentByDispatcherAt?: string;
  sentByElsAt?: string;
  classifications: string[];
  requestedResources?: ResourceRequestDto[];
  resources?: ResourceDto[];
  patients?: PatientDto[];
  informers?: InformerDto[];
  appendices?: AppendixDto[];
  sections?: IncidentDto[];
  links?: Link[];
}

/** 4.8 Message-DTO */
export interface MessageDto {
  sharedIncidentId: string;
  message: string;
}

export type ConfirmationStatus = 'Accepted' | 'Rejected';

/** 4.14 Confirmation-DTO */
export interface ConfirmationDto {
  sharedIncidentId: string;
  status: ConfirmationStatus | string;
  timestamp: string;
  cause?: string;
  appendices?: AppendixDto[];
}

/** 4.15 PositiveConfirmation-DTO */
export interface PositiveConfirmationDto {
  requestId: string;
  timestamp: string;
  resourceType?: string;
  resourceName?: string;
  resourceId?: string;
  message?: string;
}

/** 4.16 NegativeConfirmation-DTO */
export interface NegativeConfirmationDto {
  requestId: string;
  timestamp: string;
  reason?: string;
  message?: string;
}

/** 4.17 ResourceTurnOutConfirmation-DTO */
export interface ResourceTurnOutConfirmationDto {
  requestId: string;
  timestamp: string;
  resourceType?: string;
  resourceName?: string;
  resourceId?: string;
  message?: string;
}

/** 4.18 TemporaryPositiveConfirmation-DTO */
export interface TemporaryPositiveConfirmationDto {
  requestId: string;
  timestamp: string;
  message?: string;
}

/** 4.19 Classification-DTO */
export interface ClassificationDto {
  abbreviation: string;
  description: string;
  classificationGroup?: string;
}

/** 4.20 ResourceType-DTO */
export interface ResourceTypeDto {
  abbreviation: string;
  description: string;
}

/** Quittierungen der Einsatzübergabe (5.5) */
export type AcknowledgementType = 'retrieved' | 'confirm';

/** Quittierungen der Einsatzmittelanforderung (5.6) */
export type ResourceRequestAction = 'accept' | 'reject' | 'acceptTemporary' | 'confirmTurnOut';

export const RESOURCE_REQUEST_ACTIONS: readonly ResourceRequestAction[] = [
  'accept',
  'reject',
  'acceptTemporary',
  'confirmTurnOut',
];

export type ResourceRequestConfirmationDto =
  | PositiveConfirmationDto
  | NegativeConfirmationDto
  | TemporaryPositiveConfirmationDto
  | ResourceTurnOutConfirmationDto;
