import { Injectable } from '@nestjs/common';
import { TrafficEntry } from '@ucri/shared';
import { EventsService } from './events.service.js';

const MAX_ENTRIES = 1000;
const SECRET_HEADERS = ['authorization', 'clientid'];

/** Maskiert Credentials, lässt aber Schema und Anfang erkennbar. */
export function maskHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!SECRET_HEADERS.includes(name.toLowerCase()) || !value) {
      result[name] = value;
      continue;
    }
    const [scheme, ...rest] = value.split(' ');
    const secret = rest.join(' ');
    result[name] = secret ? `${scheme} ${mask(secret)}` : mask(value);
  }
  return result;
}

function mask(value: string): string {
  return value.length <= 8 ? '****' : `${value.slice(0, 6)}…(${value.length})`;
}

/** In-Memory Ringpuffer aller ein- und ausgehenden UCRI-Requests. */
@Injectable()
export class TrafficLogService {
  private entries: TrafficEntry[] = [];
  private nextId = 1;

  constructor(private readonly events: EventsService) {}

  add(entry: Omit<TrafficEntry, 'id'>): TrafficEntry {
    const full: TrafficEntry = {
      ...entry,
      id: this.nextId++,
      requestHeaders: maskHeaders(entry.requestHeaders),
    };
    this.entries.push(full);
    if (this.entries.length > MAX_ENTRIES)
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    this.events.emit({ type: 'traffic', entry: full });
    return full;
  }

  list(): TrafficEntry[] {
    return [...this.entries].reverse();
  }

  clear(): void {
    this.entries = [];
    this.events.emit({ type: 'cleared', what: 'traffic' });
  }
}
