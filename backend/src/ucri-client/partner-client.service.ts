import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AcknowledgementCall,
  type CallResult,
  type ClassificationDto,
  type HomeDto,
  type IncidentDto,
  type JwtDto,
  type MessageDto,
  type RawRequest,
  type ResourceRequestActionCall,
  type ResourceTypeDto,
  type TokenStatus,
  type TrafficDirection,
  type TrafficEntry,
  validateConfirmation,
  validateIncident,
  validateMessage,
  validateResourceRequestConfirmation,
  type ValidationIssue,
  type ValidationResult,
} from '@ucri/shared';
import {
  APP_CONFIG,
  type AppConfig,
  type PartnerConfig,
} from '../config/app-config.js';
import { IncidentStoreService } from '../state/incident-store.service.js';
import { TrafficLogService } from '../state/traffic-log.service.js';

interface CachedToken {
  token: JwtDto;
  expiresAt: number;
}

interface CachedEtag {
  etag: string;
  body: unknown;
}

interface HttpCall {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth: 'token' | 'none' | 'invalid';
  useEtag?: boolean;
  /** Zusätzliche Prüfung der Antwort, Ergebnis landet im Traffic-Log */
  inspect?: (status: number, body: unknown) => ValidationIssue[];
}

interface HttpResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  error?: string;
  entry: TrafficEntry;
}

/** Tokens rechtzeitig vor Ablauf erneuern (Kap. 3.3) */
const TOKEN_REFRESH_MARGIN_MS = 30_000;

/**
 * Ausgehender UCRI-Client: ruft die Schnittstellen der Partner-Leitstellen auf (Kap. 5)
 * und protokolliert jeden Austausch im Traffic-Log.
 */
@Injectable()
export class PartnerClientService {
  private readonly tokens = new Map<string, CachedToken>();
  private readonly etags = new Map<string, CachedEtag>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly traffic: TrafficLogService,
    private readonly store: IncidentStoreService,
  ) {}

  partner(partnerId: string): PartnerConfig {
    const partner = this.config.partners.find((p) => p.id === partnerId);
    if (!partner)
      throw new NotFoundException(`Unbekannter Partner "${partnerId}"`);
    return partner;
  }

  tokenStatus(partnerId: string): TokenStatus {
    const cached = this.tokens.get(this.partner(partnerId).id);
    if (!cached) return { partnerId, hasToken: false };
    const t = cached.token.access_token;
    return {
      partnerId,
      hasToken: true,
      tokenType: cached.token.token_type,
      expiresAt: new Date(cached.expiresAt).toISOString(),
      tokenPreview: t.length > 24 ? `${t.slice(0, 12)}…${t.slice(-8)}` : t,
    };
  }

  clearToken(partnerId: string): void {
    this.tokens.delete(this.partner(partnerId).id);
  }

  /** 5.2 Authorize */
  async authorize(partnerId: string): Promise<CallResult<JwtDto>> {
    const partner = this.partner(partnerId);
    const res = await this.fetchToken(partner);
    return this.result(res, [res.entry]);
  }

  /** 5.1 Home */
  home(partnerId: string): Promise<CallResult<HomeDto>> {
    return this.call(partnerId, { method: 'GET', path: 'home', auth: 'token' });
  }

  /** 5.7 Stichworte */
  classifications(
    partnerId: string,
    useEtag = true,
  ): Promise<CallResult<ClassificationDto[]>> {
    return this.call(partnerId, {
      method: 'GET',
      path: 'classifications',
      auth: 'token',
      useEtag,
    });
  }

  /** 5.8 Einsatzmitteltypen */
  resourceTypes(
    partnerId: string,
    useEtag = true,
  ): Promise<CallResult<ResourceTypeDto[]>> {
    return this.call(partnerId, {
      method: 'GET',
      path: 'resourceTypes',
      auth: 'token',
      useEtag,
    });
  }

  /** 5.3 Einsatz an Partner übergeben */
  async sendIncident(
    partnerId: string,
    incident: IncidentDto,
    force = false,
  ): Promise<CallResult> {
    const validation = validateIncident(
      incident,
      this.config.ucriVersion,
      this.config,
    );
    const blocked = this.blocked(validation, force);
    if (blocked) return blocked;

    const result = await this.call(partnerId, {
      method: 'POST',
      path: 'incidents',
      body: incident,
      auth: 'token',
    });
    if (result.ok && incident?.sharedIncidentId) {
      this.store.upsert('outbound', incident, {
        partnerId,
        issues: validation.issues,
      });
    }
    return { ...result, issues: validation.issues };
  }

  /** 5.4 Nachricht zum Einsatz */
  async sendMessage(
    partnerId: string,
    message: MessageDto,
    force = false,
    /** Einsatz, aus dessen Ansicht gesendet wurde (wichtig beim Loopback) */
    recordDirection: TrafficDirection = 'inbound',
  ): Promise<CallResult> {
    const validation = validateMessage(message);
    const blocked = this.blocked(validation, force);
    if (blocked) return blocked;

    const sid = message.sharedIncidentId;
    const result = await this.call(partnerId, {
      method: 'POST',
      path: `incidents/${encodeURIComponent(sid)}/messages`,
      body: message,
      auth: 'token',
    });
    const record = this.store.find(sid, recordDirection);
    if (result.ok && record) {
      this.store.addMessage(record, {
        direction: 'outbound',
        at: new Date().toISOString(),
        peer: partnerId,
        body: message,
      });
    }
    return { ...result, issues: validation.issues };
  }

  /** 5.5 Quittierung Einsatzübergabe (für einen empfangenen Einsatz) */
  async sendAcknowledgement(
    partnerId: string,
    call: AcknowledgementCall,
    force = false,
  ): Promise<CallResult> {
    const validation = validateConfirmation(call.body, this.config.ucriVersion);
    const blocked = this.blocked(validation, force);
    if (blocked) return blocked;

    const result = await this.call(partnerId, {
      method: 'PUT',
      path: `incidents/${encodeURIComponent(call.sharedIncidentId)}/acknowledgements/${call.type}`,
      body: call.body,
      auth: 'token',
    });
    const record = this.store.get('inbound', call.sharedIncidentId);
    if (result.ok && record) {
      this.store.addConfirmation(record, {
        direction: 'outbound',
        type: call.type,
        at: new Date().toISOString(),
        peer: partnerId,
        body: call.body,
        issues: validation.issues,
      });
    }
    return { ...result, issues: validation.issues };
  }

  /** 5.6 Quittierung Einsatzmittelanforderung (für einen empfangenen Einsatz) */
  async sendResourceRequestAction(
    partnerId: string,
    call: ResourceRequestActionCall,
    force = false,
  ): Promise<CallResult> {
    const validation = validateResourceRequestConfirmation(
      call.body,
      call.action,
    );
    const blocked = this.blocked(validation, force);
    if (blocked) return blocked;

    const sid = encodeURIComponent(call.sharedIncidentId);
    const rid = encodeURIComponent(call.requestId);
    const result = await this.call(partnerId, {
      method: 'POST',
      path: `incidents/${sid}/resourceRequests/${rid}/${call.action}`,
      body: call.body,
      auth: 'token',
    });
    const record = this.store.get('inbound', call.sharedIncidentId);
    if (result.ok && record) {
      this.store.addResourceRequestConfirmation(record, {
        direction: 'outbound',
        requestId: call.requestId,
        action: call.action,
        at: new Date().toISOString(),
        peer: partnerId,
        body: call.body,
        issues: validation.issues,
      });
    }
    return { ...result, issues: validation.issues };
  }

  /** Freier Request, z.B. für Negativtests */
  raw(partnerId: string, req: RawRequest): Promise<CallResult> {
    const path = req.path.replace(/^\/+/, '').replace(/^api\//, '');
    return this.call(partnerId, {
      method: req.method,
      path,
      body: req.body,
      headers: req.headers,
      auth: req.auth,
    });
  }

  private blocked(
    validation: ValidationResult,
    force: boolean,
  ): CallResult | undefined {
    if (validation.valid || force) return undefined;
    return {
      ok: false,
      error:
        'Validierung fehlgeschlagen – Request wurde nicht gesendet (mit "trotzdem senden" erzwingen)',
      traffic: [],
      issues: validation.issues,
    };
  }

  private async call<T>(
    partnerId: string,
    call: HttpCall,
  ): Promise<CallResult<T>> {
    const partner = this.partner(partnerId);
    const traffic: TrafficEntry[] = [];

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(call.headers ?? {}),
    };
    if (call.auth === 'invalid')
      headers['Authorization'] = 'Bearer invalid.token.value';
    if (call.auth === 'token') {
      const token = await this.ensureToken(partner, traffic);
      if (!token.ok) return token.result as CallResult<T>;
      headers['Authorization'] =
        `${token.token.token_type || 'Bearer'} ${token.token.access_token}`;
    }

    let res = await this.send(partner, call, headers);
    traffic.push(res.entry);

    // Kap. 3.3: Token abgelaufen → neues Token beantragen und einmalig wiederholen
    if (res.status === 401 && call.auth === 'token') {
      this.tokens.delete(partner.id);
      const token = await this.ensureToken(partner, traffic);
      if (token.ok) {
        headers['Authorization'] =
          `${token.token.token_type || 'Bearer'} ${token.token.access_token}`;
        res = await this.send(partner, call, headers);
        traffic.push(res.entry);
      }
    }
    return this.result<T>(res, traffic);
  }

  private async ensureToken(
    partner: PartnerConfig,
    traffic: TrafficEntry[],
  ): Promise<{ ok: true; token: JwtDto } | { ok: false; result: CallResult }> {
    const cached = this.tokens.get(partner.id);
    if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now())
      return { ok: true, token: cached.token };

    const res = await this.fetchToken(partner);
    traffic.push(res.entry);
    const token = this.tokens.get(partner.id);
    if (!token) {
      return {
        ok: false,
        result: {
          ...this.result(res, traffic),
          ok: false,
          error: res.error ?? 'Authorize fehlgeschlagen',
        },
      };
    }
    return { ok: true, token: token.token };
  }

  private async fetchToken(partner: PartnerConfig): Promise<HttpResponse> {
    const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
    let expiresAt = 0;
    const res = await this.send(
      partner,
      {
        method: 'GET',
        path: 'authorize',
        auth: 'none',
        inspect: (status, body) => {
          const token = body as Partial<JwtDto> | undefined;
          if (status !== 200) return [];
          if (!token || typeof token.access_token !== 'string') {
            return [
              {
                severity: 'error',
                path: 'access_token',
                message: 'Antwort enthält kein access_token',
              },
            ];
          }
          const parsed = this.parseExpiresIn(token.expires_in);
          expiresAt = parsed.expiresAt;
          return parsed.issues;
        },
      },
      {
        Accept: 'application/json',
        Authorization: `Basic ${b64(partner.clientSecret)}`,
        ClientId: b64(partner.clientId),
      },
    );
    const token = res.body as Partial<JwtDto> | undefined;
    if (res.status === 200 && token && typeof token.access_token === 'string') {
      this.tokens.set(partner.id, {
        token: {
          access_token: token.access_token,
          expires_in: token.expires_in ?? 0,
          token_type: token.token_type ?? 'Bearer',
        },
        expiresAt,
      });
    } else if (res.status === 200) {
      res.error = 'Antwort enthält kein access_token';
    }
    return res;
  }

  /** expires_in ist laut Spec ein Unix-Timestamp, laut Beispiel eine Dauer in Sekunden – beides wird akzeptiert. */
  private parseExpiresIn(expiresIn: unknown): {
    expiresAt: number;
    issues: ValidationIssue[];
  } {
    const n = Number(expiresIn);
    if (!Number.isFinite(n) || n <= 0) {
      return {
        expiresAt: Date.now() + 300_000,
        issues: [
          {
            severity: 'warning',
            path: 'expires_in',
            message:
              'expires_in fehlt oder ist ungültig – Token wird 5 Minuten verwendet',
          },
        ],
      };
    }
    if (n > 1_000_000_000) {
      return {
        expiresAt: n * 1000,
        issues: [
          {
            severity: 'warning',
            path: 'expires_in',
            message: 'expires_in als Unix-Timestamp interpretiert',
          },
        ],
      };
    }
    return { expiresAt: Date.now() + n * 1000, issues: [] };
  }

  private async send(
    partner: PartnerConfig,
    call: HttpCall,
    headers: Record<string, string>,
  ): Promise<HttpResponse> {
    const url = `${partner.baseUrl.replace(/\/+$/, '')}/${call.path}`;
    const requestHeaders = { ...headers };
    const cached = call.useEtag ? this.etags.get(url) : undefined;
    if (cached) {
      requestHeaders['If-None-Match'] = cached.etag;
      // fetch würde sonst "Cache-Control: no-cache" ergänzen – damit liefert kein Server 304
      requestHeaders['Cache-Control'] = 'max-age=0';
    }

    let body: string | undefined;
    if (call.body !== undefined && call.method !== 'GET') {
      body =
        typeof call.body === 'string' ? call.body : JSON.stringify(call.body);
      if (
        !Object.keys(requestHeaders).some(
          (h) => h.toLowerCase() === 'content-type',
        )
      ) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const started = Date.now();
    const base: Omit<TrafficEntry, 'id'> = {
      timestamp: new Date(started).toISOString(),
      direction: 'outbound',
      peer: partner.id,
      method: call.method,
      url,
      requestHeaders,
      requestBody: call.body,
    };

    try {
      const response = await fetch(url, {
        method: call.method,
        headers: requestHeaders,
        body,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => (responseHeaders[k] = v));
      const text = await response.text();
      let parsed: unknown = text === '' ? undefined : text;
      if (text && /json/i.test(response.headers.get('content-type') ?? '')) {
        try {
          parsed = JSON.parse(text);
        } catch {
          /* Rohtext behalten */
        }
      }

      const issues: ValidationIssue[] = [];
      let resultBody = parsed;
      if (response.status === 304 && cached) {
        resultBody = cached.body;
        issues.push({
          severity: 'warning',
          path: 'ETag',
          message: '304 Not Modified – Daten aus dem lokalen ETag-Cache',
        });
      } else if (call.useEtag && response.ok && responseHeaders['etag']) {
        this.etags.set(url, { etag: responseHeaders['etag'], body: parsed });
      }
      if (call.inspect) issues.push(...call.inspect(response.status, parsed));

      const entry = this.traffic.add({
        ...base,
        status: response.status,
        responseHeaders,
        responseBody: parsed,
        durationMs: Date.now() - started,
        issues: issues.length ? issues : undefined,
      });
      return {
        status: response.status,
        body: resultBody,
        headers: responseHeaders,
        entry,
      };
    } catch (e) {
      const err = e as Error & { cause?: Error };
      const error = `${err.name === 'TimeoutError' ? 'Timeout' : 'Verbindungsfehler'}: ${err.cause?.message ?? err.message}`;
      const entry = this.traffic.add({
        ...base,
        durationMs: Date.now() - started,
        error,
      });
      return { error, entry };
    }
  }

  private result<T>(res: HttpResponse, traffic: TrafficEntry[]): CallResult<T> {
    const ok =
      res.status !== undefined &&
      ((res.status >= 200 && res.status < 300) || res.status === 304);
    return {
      ok,
      status: res.status,
      body: res.body as T,
      error: res.error ?? (ok ? undefined : `HTTP ${res.status}`),
      traffic,
    };
  }
}
