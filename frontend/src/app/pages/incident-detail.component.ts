import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AcknowledgementType,
  AppendixDto,
  IncidentRecord,
  nowUtc,
  ResourceRequestAction,
  ResourceRequestConfirmationDto,
  ResourceRequestDto,
} from '@ucri/shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { AppConfigService } from '../core/app-config.service';
import { createCallRunner } from '../core/call-runner';
import { UiApiService } from '../core/ui-api.service';
import { AppendixEditorComponent } from '../shared/appendix-editor.component';
import { AppendixTableComponent } from '../shared/appendix-table.component';
import { CallResultComponent } from '../shared/call-result.component';
import { ChatComponent } from '../shared/chat.component';
import { IssueListComponent } from '../shared/issue-list.component';
import { JsonViewComponent } from '../shared/json-view.component';

export const ACTION_LABELS: Record<ResourceRequestAction, string> = {
  accept: 'Positiv (accept)',
  reject: 'Negativ (reject)',
  acceptTemporary: 'Vorläufig positiv (acceptTemporary)',
  confirmTurnOut: 'Ausgerückt (confirmTurnOut)',
};

export const ACTION_COLORS: Record<ResourceRequestAction, string> = {
  accept: 'green',
  reject: 'red',
  acceptTemporary: 'gold',
  confirmTurnOut: 'blue',
};

interface RrForm {
  request: ResourceRequestDto;
  action: ResourceRequestAction;
  resourceType: string;
  resourceName: string;
  resourceId: string;
  reason: string;
  message: string;
}

/** Detailansicht eines gesendeten oder empfangenen Einsatzes inkl. Quittierungen. */
@Component({
  selector: 'app-incident-detail',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTimelineModule,
    AppendixEditorComponent,
    AppendixTableComponent,
    CallResultComponent,
    ChatComponent,
    IssueListComponent,
    JsonViewComponent,
  ],
  templateUrl: './incident-detail.component.html',
  styles: `
    .toolbar {
      margin: 8px 0 16px;
    }
    .sub {
      margin-bottom: 16px;
    }
    .form-row {
      margin-bottom: 12px;
    }
    .form-row label {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
    }
  `,
})
export class IncidentDetailComponent {
  private readonly api = inject(UiApiService);
  private readonly appConfig = inject(AppConfigService);

  readonly record = input.required<IncidentRecord>();
  readonly call = createCallRunner();
  readonly cfg = this.appConfig.config;
  readonly actionLabels = ACTION_LABELS;
  readonly actionColors = ACTION_COLORS;
  readonly actions = Object.keys(ACTION_LABELS) as ResourceRequestAction[];

  readonly inbound = computed(() => this.record().direction === 'inbound');
  readonly incident = computed(() => this.record().incident);
  /** Partner, an den Quittierungen und Nachrichten gehen */
  readonly replyPartnerId = signal<string | undefined>(undefined);

  // Formular Einsatzübergabe-Quittierung
  readonly ackOpen = signal(false);
  readonly ackType = signal<AcknowledgementType>('confirm');
  readonly ackStatus = signal<'Accepted' | 'Rejected'>('Accepted');
  readonly ackCause = signal('');
  readonly ackAppendices = signal<AppendixDto[]>([]);

  // Formular Einsatzmittelanforderung
  readonly rrForm = signal<RrForm | null>(null);

  constructor() {
    effect(() => {
      const r = this.record();
      this.replyPartnerId.set(r.partnerId ?? this.appConfig.selectedPartnerId() ?? undefined);
    });
  }

  confirmationsFor(requestId: string) {
    return this.record().resourceRequestConfirmations.filter((c) => c.requestId === requestId);
  }

  hasAck(type: AcknowledgementType): boolean {
    return this.record().confirmations.some((c) => c.type === type);
  }

  // --- 5.5 Quittierung Einsatzübergabe ---------------------------------------

  openAck(type: AcknowledgementType, status: 'Accepted' | 'Rejected' = 'Accepted'): void {
    this.ackType.set(type);
    this.ackStatus.set(status);
    this.ackCause.set(status === 'Rejected' ? 'Keine Einsatzmittel verfügbar' : '');
    const appendices: AppendixDto[] = [];
    if (this.cfg().ucriVersion === '1.1' && type === 'confirm' && status === 'Accepted') {
      appendices.push(
        { key: 'AcceptedByDispatcherAt', value: nowUtc() },
        { key: 'TargetDispatcherID', value: 'D-0001' },
        { key: 'TargetIncidentID', value: `T-${Date.now()}` },
      );
    }
    this.ackAppendices.set(appendices);
    this.ackOpen.set(true);
  }

  async sendAck(): Promise<void> {
    const partnerId = this.replyPartnerId();
    if (!partnerId) return;
    const r = await this.call.run(
      () =>
        this.api.sendAcknowledgement(partnerId, {
          sharedIncidentId: this.record().sharedIncidentId,
          type: this.ackType(),
          body: {
            sharedIncidentId: this.record().sharedIncidentId,
            status: this.ackStatus(),
            timestamp: nowUtc(),
            ...(this.ackCause() ? { cause: this.ackCause() } : {}),
            appendices: this.ackAppendices(),
          },
        }),
      'Quittierung gesendet',
    );
    if (r?.ok) this.ackOpen.set(false);
  }

  // --- 5.6 Quittierung Einsatzmittelanforderung -------------------------------

  openRr(request: ResourceRequestDto, action: ResourceRequestAction): void {
    this.rrForm.set({
      request,
      action,
      resourceType: request.resourceType,
      resourceName: request.resourceName ?? `${request.resourceType}-1`,
      resourceId: request.resourceId ?? '',
      reason: action === 'reject' ? 'Einsatzmittel nicht verfügbar' : '',
      message: '',
    });
  }

  async sendRr(): Promise<void> {
    const f = this.rrForm();
    const partnerId = this.replyPartnerId();
    if (!f || !partnerId) return;
    const base = { requestId: f.request.requestId, timestamp: nowUtc(), ...(f.message ? { message: f.message } : {}) };
    let body: ResourceRequestConfirmationDto;
    switch (f.action) {
      case 'reject':
        body = { ...base, reason: f.reason };
        break;
      case 'acceptTemporary':
        body = base;
        break;
      default:
        body = { ...base, resourceType: f.resourceType, resourceName: f.resourceName, resourceId: f.resourceId };
    }
    const r = await this.call.run(
      () =>
        this.api.sendResourceRequestAction(partnerId, {
          sharedIncidentId: this.record().sharedIncidentId,
          requestId: f.request.requestId,
          action: f.action,
          body,
        }),
      'Quittierung gesendet',
    );
    if (r?.ok) this.rrForm.set(null);
  }

  readonly isAccept = (c: { action: ResourceRequestAction }) => c.action === 'accept';
}
