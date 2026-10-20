import { computed, inject, Injectable, signal } from '@angular/core';
import { IncidentRecord, TrafficEntry, UiEvent } from '@ucri/shared';
import { UiApiService } from './ui-api.service';

const MAX_TRAFFIC = 1000;

/** Live-Zustand (Einsätze, Traffic) – initial per REST, danach per Server-Sent Events. */
@Injectable({ providedIn: 'root' })
export class LiveStateService {
  private readonly api = inject(UiApiService);
  private source?: EventSource;

  readonly incidents = signal<IncidentRecord[]>([]);
  readonly traffic = signal<TrafficEntry[]>([]);
  readonly connected = signal(false);

  readonly inbound = computed(() => this.incidents().filter((r) => r.direction === 'inbound'));
  readonly outbound = computed(() => this.incidents().filter((r) => r.direction === 'outbound'));

  start(): void {
    if (this.source) return;
    this.source = new EventSource('/ui-api/events');
    this.source.onopen = () => {
      this.connected.set(true);
      void this.reload();
    };
    this.source.onerror = () => this.connected.set(false);
    this.source.onmessage = (msg) => this.apply(JSON.parse(msg.data as string) as UiEvent);
  }

  async reload(): Promise<void> {
    const [incidents, traffic] = await Promise.all([this.api.incidents(), this.api.traffic()]);
    this.incidents.set(incidents);
    this.traffic.set(traffic);
  }

  record(direction: string, sharedIncidentId: string): IncidentRecord | undefined {
    return this.incidents().find((r) => r.direction === direction && r.sharedIncidentId === sharedIncidentId);
  }

  private apply(event: UiEvent): void {
    switch (event.type) {
      case 'traffic':
        this.traffic.update((list) =>
          list.some((e) => e.id === event.entry.id) ? list : [event.entry, ...list].slice(0, MAX_TRAFFIC),
        );
        break;
      case 'incident':
        this.incidents.update((list) => [
          event.record,
          ...list.filter(
            (r) => !(r.direction === event.record.direction && r.sharedIncidentId === event.record.sharedIncidentId),
          ),
        ]);
        break;
      case 'cleared':
        if (event.what === 'traffic') this.traffic.set([]);
        else this.incidents.set([]);
        break;
    }
  }
}
