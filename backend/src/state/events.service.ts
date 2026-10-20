import { Injectable } from '@nestjs/common';
import { UiEvent } from '@ucri/shared';
import { Observable, Subject } from 'rxjs';

/** Verteilt Ereignisse (Traffic, Einsätze) per SSE an das Frontend. */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<UiEvent>();

  readonly events$: Observable<UiEvent> = this.subject.asObservable();

  emit(event: UiEvent): void {
    this.subject.next(event);
  }
}
