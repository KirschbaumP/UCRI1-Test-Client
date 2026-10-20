import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { TrafficLogService } from '../state/traffic-log.service.js';
import type { UcriRequest } from './ucri-request.js';

function flattenHeaders(
  headers: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined)
      result[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return result;
}

function parseBody(body: unknown): unknown {
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body !== 'string' || body === '')
    return body === '' ? undefined : body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Protokolliert jeden Aufruf der eigenen UCRI-API (/api) im Traffic-Log. */
@Injectable()
export class InboundTrafficMiddleware implements NestMiddleware {
  constructor(private readonly traffic: TrafficLogService) {}

  use(req: UcriRequest, res: Response, next: NextFunction): void {
    if (!req.originalUrl.startsWith('/api')) return next();

    const started = Date.now();
    let responseBody: unknown;
    const originalSend = res.send.bind(res);
    res.send = (body?: unknown) => {
      responseBody = body;
      return originalSend(body);
    };

    res.on('finish', () => {
      this.traffic.add({
        timestamp: new Date(started).toISOString(),
        direction: 'inbound',
        peer: req.ucriClientId,
        method: req.method,
        url: req.originalUrl,
        requestHeaders: flattenHeaders(req.headers),
        requestBody:
          req.body && Object.keys(req.body as object).length
            ? req.body
            : undefined,
        status: res.statusCode,
        responseHeaders: flattenHeaders(res.getHeaders()),
        responseBody: parseBody(responseBody),
        durationMs: Date.now() - started,
        issues: req.ucriIssues,
      });
    });
    next();
  }
}
