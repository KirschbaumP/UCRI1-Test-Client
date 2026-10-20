import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncidentRecord } from '@ucri/shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { createCallRunner } from '../core/call-runner';
import { UiApiService } from '../core/ui-api.service';
import { CallResultComponent } from './call-result.component';

/** Nachrichten zum Einsatz (5.4) – Verlauf und Senden. */
@Component({
  selector: 'app-chat',
  imports: [DatePipe, FormsModule, NzButtonModule, NzEmptyModule, NzIconModule, NzInputModule, CallResultComponent],
  template: `
    <div class="chat">
      @for (m of record().messages; track $index) {
        <div class="msg" [class.out]="m.direction === 'outbound'">
          <div class="bubble">
            <div class="meta">
              {{ m.direction === 'outbound' ? 'gesendet an ' : 'empfangen von ' }}{{ m.peer ?? '?' }} ·
              {{ m.at | date: 'dd.MM. HH:mm:ss' }}
            </div>
            {{ m.body.message }}
          </div>
        </div>
      } @empty {
        <nz-empty nzNotFoundContent="Noch keine Nachrichten" />
      }
    </div>
    <div class="compose">
      <textarea nz-input rows="2" [(ngModel)]="text" placeholder="Nachricht an die korrespondierende Leitstelle"></textarea>
      <button nz-button nzType="primary" [disabled]="!text().trim() || !partnerId()" [nzLoading]="call.loading()" (click)="send()">
        <nz-icon nzType="send" /> Senden
      </button>
    </div>
    @if (!call.result()?.ok) {
      <app-call-result [result]="call.result()" [showBody]="false" />
    }
  `,
  styles: `
    .chat {
      max-height: 50vh;
      overflow: auto;
      padding: 8px;
      background: #fafafa;
      border-radius: 4px;
    }
    .msg {
      display: flex;
      margin: 6px 0;
    }
    .msg.out {
      justify-content: flex-end;
    }
    .bubble {
      max-width: 75%;
      background: #fff;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 6px 10px;
      white-space: pre-wrap;
    }
    .out .bubble {
      background: #e6f4ff;
      border-color: #91caff;
    }
    .meta {
      font-size: 11px;
      color: #8c8c8c;
    }
    .compose {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      align-items: flex-end;
    }
  `,
})
export class ChatComponent {
  private readonly api = inject(UiApiService);

  readonly record = input.required<IncidentRecord>();
  readonly partnerId = input<string | undefined>();
  readonly call = createCallRunner();
  readonly text = signal('');

  async send() {
    const partnerId = this.partnerId();
    if (!partnerId) return;
    const r = await this.call.run(() =>
      this.api.sendMessage(
        partnerId,
        { sharedIncidentId: this.record().sharedIncidentId, message: this.text() },
        this.record().direction,
      ),
    );
    if (r?.ok) this.text.set('');
  }
}
