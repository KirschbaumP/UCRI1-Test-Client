import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AppConfigService } from '../core/app-config.service';
import { LiveStateService } from '../core/live-state.service';
import { ChatComponent } from '../shared/chat.component';

/** 5.4 Nachrichten zum Einsatz, z.B. bei kooperativen Einsätzen (2.3.3). */
@Component({
  selector: 'app-messages-page',
  imports: [FormsModule, NzCardModule, NzEmptyModule, NzSelectModule, ChatComponent],
  template: `
    <div class="page-title"><h2>Nachrichten zum Einsatz <span class="muted">(5.4)</span></h2></div>
    <nz-card>
      <nz-select
        class="select"
        nzShowSearch
        nzPlaceHolder="Einsatz wählen"
        [ngModel]="selectedKey()"
        (ngModelChange)="selectedKey.set($event)"
      >
        @for (r of live.incidents(); track r.direction + r.sharedIncidentId) {
          <nz-option
            [nzValue]="r.direction + ':' + r.sharedIncidentId"
            [nzLabel]="(r.direction === 'inbound' ? '⇠ ' : '⇢ ') + r.incident.id + ' · ' + r.sharedIncidentId + ' (' + r.messages.length + ')'"
          />
        }
      </nz-select>
      @if (selected(); as rec) {
        <app-chat [record]="rec" [partnerId]="rec.partnerId ?? appConfig.selectedPartnerId() ?? undefined" />
      } @else {
        <nz-empty nzNotFoundContent="Einsatz wählen – Nachrichten sind nur zu gesendeten oder empfangenen Einsätzen möglich." />
      }
    </nz-card>
  `,
  styles: `
    .select {
      width: 100%;
      margin-bottom: 16px;
    }
  `,
})
export class MessagesPage {
  readonly live = inject(LiveStateService);
  readonly appConfig = inject(AppConfigService);

  readonly selectedKey = signal<string | null>(null);
  readonly selected = computed(() => {
    const key = this.selectedKey();
    if (!key) return undefined;
    const [direction, ...rest] = key.split(':');
    return this.live.record(direction, rest.join(':'));
  });
}
