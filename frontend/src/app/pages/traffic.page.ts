import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrafficEntry } from '@ucri/shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LiveStateService } from '../core/live-state.service';
import { UiApiService } from '../core/ui-api.service';
import { StatusTagComponent } from '../shared/status-tag.component';
import { TrafficEntryComponent } from '../shared/traffic-entry.component';

/** Alle ein- und ausgehenden UCRI-Requests. */
@Component({
  selector: 'app-traffic-page',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzTableModule,
    NzTagModule,
    StatusTagComponent,
    TrafficEntryComponent,
  ],
  template: `
    <div class="page-title">
      <h2>Traffic-Log</h2>
      <div class="toolbar">
        <nz-radio-group [(ngModel)]="direction" nzButtonStyle="solid">
          <label nz-radio-button nzValue="all">Alle</label>
          <label nz-radio-button nzValue="outbound">⇢ ausgehend</label>
          <label nz-radio-button nzValue="inbound">⇠ eingehend</label>
        </nz-radio-group>
        <input nz-input class="filter" placeholder="Filter (Pfad, Status, Partner)" [(ngModel)]="filter" />
        <button nz-button (click)="export()"><nz-icon nzType="download" /> Export</button>
        <button nz-button nzDanger nz-popconfirm nzPopconfirmTitle="Traffic-Log leeren?" (nzOnConfirm)="clear()">
          <nz-icon nzType="delete" /> Leeren
        </button>
      </div>
    </div>
    <nz-card>
      <nz-table #t [nzData]="rows()" nzSize="small" [nzPageSize]="50" [nzScroll]="{ x: '800px' }">
        <thead>
          <tr>
            <th nzWidth="40px"></th>
            <th nzWidth="110px">Zeit</th>
            <th nzWidth="60px"></th>
            <th nzWidth="90px">Peer</th>
            <th nzWidth="80px">Methode</th>
            <th>URL</th>
            <th nzWidth="90px">Status</th>
            <th nzWidth="80px">Dauer</th>
            <th nzWidth="90px">Hinweise</th>
          </tr>
        </thead>
        <tbody>
          @for (e of t.data; track e.id) {
            <tr>
              <td [nzExpand]="expanded().has(e.id)" (nzExpandChange)="toggle(e.id, $event)"></td>
              <td>{{ e.timestamp | date: 'HH:mm:ss.SSS' }}</td>
              <td>
                <nz-tag [nzColor]="e.direction === 'inbound' ? 'purple' : 'cyan'">{{ e.direction === 'inbound' ? '⇠ in' : '⇢ out' }}</nz-tag>
              </td>
              <td>{{ e.peer ?? '–' }}</td>
              <td><strong>{{ e.method }}</strong></td>
              <td class="url"><code>{{ e.url }}</code></td>
              <td><app-status-tag [status]="e.status" [error]="e.error" /></td>
              <td>{{ e.durationMs ?? '–' }} ms</td>
              <td>
                @if (e.issues?.length) {
                  <nz-tag [nzColor]="hasError(e) ? 'red' : 'orange'">{{ e.issues!.length }}</nz-tag>
                }
              </td>
            </tr>
            <tr [nzExpand]="expanded().has(e.id)">
              @if (expanded().has(e.id)) {
                <app-traffic-entry [entry]="e" />
              }
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .filter {
      width: 260px;
    }
    .url {
      word-break: break-all;
    }
  `,
})
export class TrafficPage {
  private readonly api = inject(UiApiService);
  private readonly live = inject(LiveStateService);

  readonly direction = signal<'all' | 'inbound' | 'outbound'>('all');
  readonly filter = signal('');
  readonly expanded = signal(new Set<number>());

  readonly rows = computed(() => {
    const dir = this.direction();
    const q = this.filter().toLowerCase();
    return this.live.traffic().filter(
      (e) =>
        (dir === 'all' || e.direction === dir) &&
        (!q || `${e.method} ${e.url} ${e.status ?? ''} ${e.peer ?? ''}`.toLowerCase().includes(q)),
    );
  });

  toggle(id: number, open: boolean): void {
    const next = new Set(this.expanded());
    if (open) next.add(id);
    else next.delete(id);
    this.expanded.set(next);
  }

  hasError(e: TrafficEntry): boolean {
    return !!e.issues?.some((i) => i.severity === 'error');
  }

  export(): void {
    const blob = new Blob([JSON.stringify(this.rows(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ucri-traffic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async clear(): Promise<void> {
    await this.api.clearTraffic();
  }
}
