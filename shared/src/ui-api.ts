import { AppendixDefinition } from './appendix-catalog.js';
import {
  AcknowledgementType,
  ConfirmationDto,
  IncidentDto,
  MessageDto,
  ResourceRequestAction,
  ResourceRequestConfirmationDto,
  UcriMediaType,
} from './dto.js';
import { ValidationIssue } from './validation.js';
import { UcriVersion } from './version.js';

/**
 * Typen der internen UI-API (/ui-api) zwischen Angular-Frontend und NestJS.
 * Nicht Bestandteil der UCRI-Spezifikation.
 */

/**
 * Format der Basic-Credentials beim Authorize:
 * `secret` = base64(Client-Secret) wie in Kap. 5.2,
 * `clientIdAndSecret` = base64(Client-Id:Client-Secret) wie bei HTTP Basic Auth (OpenAPI).
 */
export type BasicAuthFormat = 'secret' | 'clientIdAndSecret';

/** Feldnamen des JWT, das die eigene /authorize ausstellt (Kap. 4.5) */
export type TokenFieldNames = 'camelCase' | 'snakeCase' | 'both';

export interface PartnerView {
  id: string;
  name: string;
  baseUrl: string;
  clientId: string;
  controlCenterId: string;
  contentType: UcriMediaType;
  basicAuthFormat: BasicAuthFormat;
}

export interface AppConfigView {
  ucriVersion: UcriVersion;
  applicationName: string;
  applicationVersion: string;
  ownControlCenterId: string;
  ownControlCenterName: string;
  publicBaseUrl: string;
  strictRequiredAppendices: boolean;
  tokenFieldNames: TokenFieldNames;
  partners: PartnerView[];
}

export interface CatalogView {
  ucriVersion: UcriVersion;
  appendices: AppendixDefinition[];
}

export interface TokenStatus {
  partnerId: string;
  hasToken: boolean;
  tokenType?: string;
  expiresAt?: string;
  /** Token als gekürzte Vorschau */
  tokenPreview?: string;
}

export type TrafficDirection = 'outbound' | 'inbound';

export interface TrafficEntry {
  id: number;
  timestamp: string;
  direction: TrafficDirection;
  /** Partner-ID (outbound) bzw. Client-ID des Aufrufers (inbound) */
  peer?: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  durationMs?: number;
  error?: string;
  issues?: ValidationIssue[];
}

/** Ergebnis eines ausgehenden Aufrufs für das Frontend */
export interface CallResult<T = unknown> {
  ok: boolean;
  status?: number;
  body?: T;
  error?: string;
  traffic: TrafficEntry[];
  issues?: ValidationIssue[];
}

export interface ConfirmationEntry {
  direction: TrafficDirection;
  type: AcknowledgementType;
  at: string;
  peer?: string;
  body: ConfirmationDto;
  issues: ValidationIssue[];
}

export interface ResourceRequestConfirmationEntry {
  direction: TrafficDirection;
  requestId: string;
  action: ResourceRequestAction;
  at: string;
  peer?: string;
  body: ResourceRequestConfirmationDto;
  issues: ValidationIssue[];
}

export interface ChatMessage {
  direction: TrafficDirection;
  at: string;
  peer?: string;
  body: MessageDto;
}

/** Einsatz aus Sicht dieses Test-Clients: empfangen (inbound) oder gesendet (outbound) */
export interface IncidentRecord {
  sharedIncidentId: string;
  direction: TrafficDirection;
  /** Partner, an den gesendet wurde bzw. von dem (vermutlich) empfangen wurde */
  partnerId?: string;
  /** Client-ID des Aufrufers bei eingehenden Einsätzen */
  fromClientId?: string;
  at: string;
  incident: IncidentDto;
  issues: ValidationIssue[];
  /** Quittierungen der Einsatzübergabe – empfangen (outbound-Einsatz) bzw. gesendet (inbound-Einsatz) */
  confirmations: ConfirmationEntry[];
  resourceRequestConfirmations: ResourceRequestConfirmationEntry[];
  messages: ChatMessage[];
}

export type UiEvent =
  | { type: 'traffic'; entry: TrafficEntry }
  | { type: 'incident'; record: IncidentRecord }
  | { type: 'cleared'; what: 'traffic' | 'incidents' };

export interface RawRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  auth: 'token' | 'none' | 'invalid';
}

export interface ResourceRequestActionCall {
  sharedIncidentId: string;
  requestId: string;
  action: ResourceRequestAction;
  body: ResourceRequestConfirmationDto;
}

export interface AcknowledgementCall {
  sharedIncidentId: string;
  type: AcknowledgementType;
  body: ConfirmationDto;
}
