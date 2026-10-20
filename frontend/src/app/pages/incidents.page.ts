import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { IncidentRecord, TrafficDirection } from '@ucri/shared';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LiveStateService } from '../core/live-state.service';
import { UiApiService } from '../core/ui-api.service';
import { ACTION_COLORS, IncidentDetailComponent } from './incident-detail.component';

@Component({
  selector: 'app-incidents-page',
  imports: [
    DatePipe,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    IncidentDetailComponent,
  ],
  template: `
    <div class="page-title">
      <h2>Einsätze & Quittierungen</h2>
      <button nz-button nz-popconfirm nzPopconfirmTitle="Alle Einsätze aus dem Speicher löschen?" (nzOnConfirm)="clear()">
        <nz-icon nzType="delete" /> Leeren
      </button>
    </div>
    <nz-card>
      <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="tab.set($event)">
        <nz-tab [nzTitle]="'Empfangen (' + live.inbound().length + ')'" />
        <nz-tab [nzTitle]="'Gesendet (' + live.outbound().length + ')'" />
      </nz-tabs>
      <nz-table #t [nzData]="rows()" nzSize="middle" [nzPageSize]="20" [nzScroll]="{ x: '900px' }">
        <thead>
          <tr>
            <th nzWidth="150px">Zeit</th>
            <th>sharedIncidentId / id</th>
            <th>{{ direction() === 'inbound' ? 'Absender' : 'Partner' }}</th>
            <th>Stichworte</th>
            <th>Einsatzort</th>
            <th>Übergabe</th>
            <th>Anforderungen</th>
            <th>Validierung</th>
          </tr>
        </thead>
        <tbody>
          @for (r of t.data; track r.direction + r.sharedIncidentId) {
            <tr class="row" (click)="open(r)">
              <td>{{ r.at | date: 'dd.MM. HH:mm:ss' }}</td>
              <td>
                <code>{{ r.sharedIncidentId }}</code>
                <div class="muted">{{ r.incident.id }}</div>
              </td>
              <td>{{ direction() === 'inbound' ? r.incident.sender : (r.partnerId ?? r.incident.target) }}</td>
              <td>
                @for (c of r.incident.classifications; track $index) {
                  <nz-tag>{{ c }}</nz-tag>
                }
              </td>
              <td>{{ appendix(r, 'MissionDestination') }}</td>
              <td>
                @if (ackStatus(r); as s) {
                  <nz-tag [nzColor]="s.color">{{ s.label }}</nz-tag>
                } @else {
                  <nz-badge nzStatus="processing" [nzText]="direction() === 'inbound' ? 'offen' : 'wartet'" />
                }
              </td>
              <td>
                @if (r.incident.requestedResources?.length) {
                  {{ r.incident.requestedResources!.length }} angefordert
                  @for (c of r.resourceRequestConfirmations; track $index) {
                    <nz-tag [nzColor]="actionColors[c.action]">{{ c.action }}</nz-tag>
                  }
                } @else {
                  <span class="muted">–</span>
                }
              </td>
              <td>
                @let errors = countErrors(r);
                @if (errors) {
                  <nz-tag nzColor="red">{{ errors }} Fehler</nz-tag>
                }
                @if (r.issues.length - errors) {
                  <nz-tag nzColor="orange">{{ r.issues.length - errors }} Warnungen</nz-tag>
                }
                @if (!r.issues.length) {
                  <nz-tag nzColor="green">ok</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="!!selected()"
      nzPlacement="right"
      [nzWidth]="drawerWidth"
      [nzTitle]="'Einsatz ' + (selected()?.incident?.id ?? '')"
      (nzOnClose)="selectedKey.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as rec) {
          <app-incident-detail [record]="rec" />
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .row {
      cursor: pointer;
    }
  `,
})
export class IncidentsPage {
  private readonly api = inject(UiApiService);
  readonly live = inject(LiveStateService);
  readonly actionColors = ACTION_COLORS;
  readonly drawerWidth = window.innerWidth < 1000 ? '100%' : '960px';

  readonly tab = signal(0);
  readonly direction = computed<TrafficDirection>(() => (this.tab() === 0 ? 'inbound' : 'outbound'));
  readonly rows = computed(() => (this.direction() === 'inbound' ? this.live.inbound() : this.live.outbound()));

  readonly selectedKey = signal<{ direction: TrafficDirection; sid: string } | null>(null);
  /** immer der aktuelle Stand aus dem Live-State, damit neue Quittierungen sofort erscheinen */
  readonly selected = computed(() => {
    const k = this.selectedKey();
    return k ? this.live.record(k.direction, k.sid) : undefined;
  });

  open(r: IncidentRecord): void {
    this.selectedKey.set({ direction: r.direction, sid: r.sharedIncidentId });
  }

  appendix(r: IncidentRecord, key: string): string {
    return r.incident.appendices?.find((a) => a.key === key)?.value ?? '–';
  }

  countErrors(r: IncidentRecord): number {
    return r.issues.filter((i) => i.severity === 'error').length;
  }

  ackStatus(r: IncidentRecord): { label: string; color: string } | null {
    const confirm = [...r.confirmations].reverse().find((c) => c.type === 'confirm');
    if (confirm) {
      return confirm.body.status === 'Rejected'
        ? { label: 'abgelehnt', color: 'red' }
        : { label: 'angenommen', color: 'green' };
    }
    if (r.confirmations.some((c) => c.type === 'retrieved')) return { label: 'übertragen', color: 'blue' };
    return null;
  }

  async clear(): Promise<void> {
    await this.api.clearIncidents();
  }
}
