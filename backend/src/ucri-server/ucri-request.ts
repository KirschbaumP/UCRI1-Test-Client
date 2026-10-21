import type { Request } from 'express';
import { SIMPLEMEDIA_TYPE, type ValidationIssue } from '@ucri/shared';

/** Express-Request mit Zusatzinformationen für das Traffic-Log. */
export interface UcriRequest extends Request {
  ucriClientId?: string;
  ucriIssues?: ValidationIssue[];
}

export { SIMPLEMEDIA_TYPE };

/** Kap. 4.1: Format über `Response-Content-Type` (Spec) oder `Accept` (Kap. 6) wählbar. */
export function wantsSimplemedia(req: Request): boolean {
  const requested = `${req.headers['response-content-type'] ?? ''} ${req.headers.accept ?? ''}`;
  return requested.includes(SIMPLEMEDIA_TYPE);
}
