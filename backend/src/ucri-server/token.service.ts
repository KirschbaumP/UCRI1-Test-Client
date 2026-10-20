import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type JwtDto, type Link, type NotAuthorizedDto } from '@ucri/shared';
import {
  APP_CONFIG,
  type AppConfig,
  type InboundClientConfig,
} from '../config/app-config.js';

export interface UcriTokenPayload {
  sub: string;
  scope: string;
}

/** Dekodiert Base64, liefert den Rohwert, falls der Header nicht Base64-kodiert war. */
export function decodeBase64Lenient(value: string): {
  value: string;
  wasBase64: boolean;
} {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64') === trimmed)
      return { value: decoded, wasBase64: true };
  }
  return { value: trimmed, wasBase64: false };
}

export type AuthorizeResult =
  | { ok: true; client: InboundClientConfig; token: JwtDto; notes: string[] }
  | { ok: false; status: 400 | 401; message: string };

/** IdentityManager der eigenen UCRI-API (Kap. 3.3, 5.2). */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Header gemäß 5.2: `Authorization: Basic base64(Client-Secret)` und `ClientId: base64(Client-Id)`.
   * Toleriert zusätzlich nicht kodierte Client-Ids und Basic-Auth im Standardformat base64(id:secret).
   */
  authorize(
    authorization: string | undefined,
    clientIdHeader: string | undefined,
  ): AuthorizeResult {
    if (!authorization || !clientIdHeader) {
      return {
        ok: false,
        status: 400,
        message:
          'The request was incomplete. Authorization (Basic) und ClientId Header erforderlich.',
      };
    }
    const [scheme, credentials] = authorization.trim().split(/\s+/, 2);
    if (scheme?.toLowerCase() !== 'basic' || !credentials) {
      return {
        ok: false,
        status: 400,
        message: 'Authorization Header muss das Schema "Basic" verwenden.',
      };
    }

    const notes: string[] = [];
    const clientId = decodeBase64Lenient(clientIdHeader);
    if (!clientId.wasBase64)
      notes.push('ClientId-Header war nicht Base64-kodiert');
    const secret = decodeBase64Lenient(credentials).value;

    const client = this.config.inboundClients.find(
      (c) => c.clientId === clientId.value,
    );
    if (!client)
      return {
        ok: false,
        status: 401,
        message: 'Not allowed to authorize. Unbekannte Client-Id.',
      };

    if (secret !== client.clientSecret) {
      if (secret === `${client.clientId}:${client.clientSecret}`) {
        notes.push(
          'Basic-Credentials im Format base64(clientId:secret) statt base64(secret) gesendet',
        );
      } else {
        return {
          ok: false,
          status: 401,
          message: 'Not allowed to authorize. Client-Secret ungültig.',
        };
      }
    }

    const payload: UcriTokenPayload = { sub: client.clientId, scope: 'ucri' };
    const lifetime = this.config.tokenLifetimeSec;
    const accessToken = this.jwt.sign(payload, { expiresIn: lifetime });
    const expiresIn =
      this.config.tokenExpiresInFormat === 'unixTimestamp'
        ? Math.floor(Date.now() / 1000) + lifetime
        : lifetime;
    return {
      ok: true,
      client,
      notes,
      token: {
        access_token: accessToken,
        expires_in: expiresIn,
        token_type: 'Bearer',
      },
    };
  }

  verify(token: string): UcriTokenPayload {
    return this.jwt.verify<UcriTokenPayload>(token);
  }

  apiLink(rel: string, path: string): Link {
    return {
      rel,
      href: `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${path}`,
      label: null,
      name: null,
    };
  }

  notAuthorized(message: string): NotAuthorizedDto {
    return { message, authorizeLink: this.apiLink('authorize', 'authorize/') };
  }
}
