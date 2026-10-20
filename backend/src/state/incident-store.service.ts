import { Injectable } from '@nestjs/common';
import {
  ChatMessage,
  ConfirmationEntry,
  IncidentDto,
  IncidentRecord,
  ResourceRequestConfirmationEntry,
  TrafficDirection,
  ValidationIssue,
} from '@ucri/shared';
import { EventsService } from './events.service.js';

/**
 * In-Memory Ablage der gesendeten (outbound) und empfangenen (inbound) Einsätze.
 * Schlüssel ist Richtung + sharedIncidentId, so funktioniert auch der Loopback auf die eigene API.
 */
@Injectable()
export class IncidentStoreService {
  private readonly records = new Map<string, IncidentRecord>();

  constructor(private readonly events: EventsService) {}

  private key(direction: TrafficDirection, sharedIncidentId: string) {
    return `${direction}:${sharedIncidentId}`;
  }

  upsert(
    direction: TrafficDirection,
    incident: IncidentDto,
    meta: {
      partnerId?: string;
      fromClientId?: string;
      issues: ValidationIssue[];
    },
  ): IncidentRecord {
    const key = this.key(direction, incident.sharedIncidentId);
    const existing = this.records.get(key);
    const record: IncidentRecord = {
      sharedIncidentId: incident.sharedIncidentId,
      direction,
      partnerId: meta.partnerId,
      fromClientId: meta.fromClientId,
      at: new Date().toISOString(),
      incident,
      issues: meta.issues,
      confirmations: existing?.confirmations ?? [],
      resourceRequestConfirmations:
        existing?.resourceRequestConfirmations ?? [],
      messages: existing?.messages ?? [],
    };
    // Neu einsortieren, damit die Liste nach letzter Aktualisierung sortiert bleibt
    this.records.delete(key);
    this.records.set(key, record);
    return this.changed(record);
  }

  get(
    direction: TrafficDirection,
    sharedIncidentId: string,
  ): IncidentRecord | undefined {
    return this.records.get(this.key(direction, sharedIncidentId));
  }

  /** Sucht einen Einsatz unabhängig von der Richtung (für Nachrichten). */
  find(
    sharedIncidentId: string,
    prefer: TrafficDirection = 'inbound',
  ): IncidentRecord | undefined {
    const other: TrafficDirection =
      prefer === 'inbound' ? 'outbound' : 'inbound';
    return (
      this.get(prefer, sharedIncidentId) ?? this.get(other, sharedIncidentId)
    );
  }

  list(): IncidentRecord[] {
    return [...this.records.values()].reverse();
  }

  addConfirmation(
    record: IncidentRecord,
    entry: ConfirmationEntry,
  ): IncidentRecord {
    record.confirmations.push(entry);
    return this.changed(record);
  }

  addResourceRequestConfirmation(
    record: IncidentRecord,
    entry: ResourceRequestConfirmationEntry,
  ): IncidentRecord {
    record.resourceRequestConfirmations.push(entry);
    return this.changed(record);
  }

  addMessage(record: IncidentRecord, message: ChatMessage): IncidentRecord {
    record.messages.push(message);
    return this.changed(record);
  }

  clear(): void {
    this.records.clear();
    this.events.emit({ type: 'cleared', what: 'incidents' });
  }

  private changed(record: IncidentRecord): IncidentRecord {
    this.events.emit({ type: 'incident', record });
    return record;
  }
}
