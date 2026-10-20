import { Component, input } from '@angular/core';
import { CallResult } from '@ucri/shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { IssueListComponent } from './issue-list.component';
import { JsonViewComponent } from './json-view.component';
import { StatusTagComponent } from './status-tag.component';
import { TrafficEntryComponent } from './traffic-entry.component';

/** Ergebnis eines ausgehenden Aufrufs inkl. aller beteiligten Requests (z.B. Authorize + Retry). */
@Component({
  selector: 'app-call-result',
  imports: [NzAlertModule, NzCollapseModule, IssueListComponent, JsonViewComponent, StatusTagComponent, TrafficEntryComponent],
  template: `
    @if (result(); as r) {
      <div class="result">
        @if (r.ok) {
          <nz-alert nzType="success" nzShowIcon [nzMessage]="okTpl" />
        } @else {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="r.error || 'Fehlgeschlagen'" />
        }
        <ng-template #okTpl>Erfolgreich <app-status-tag [status]="r.status" /></ng-template>

        @if (r.issues?.length) {
          <h4>Validierung</h4>
          <app-issue-list [issues]="r.issues" />
        }
        @if (r.body !== undefined && showBody()) {
          <h4>Antwort</h4>
          <app-json-view [value]="r.body" />
        }
        @if (r.traffic.length) {
          <h4>Requests ({{ r.traffic.length }})</h4>
          <nz-collapse>
            @for (t of r.traffic; track t.id) {
              <nz-collapse-panel [nzHeader]="t.method + ' ' + t.url + ' → ' + (t.status ?? t.error)">
                <app-traffic-entry [entry]="t" />
              </nz-collapse-panel>
            }
          </nz-collapse>
        }
      </div>
    }
  `,
  styles: `
    .result {
      margin-top: 16px;
    }
    h4 {
      margin: 12px 0 4px;
    }
  `,
})
export class CallResultComponent {
  readonly result = input<CallResult | null>(null);
  readonly showBody = input(true);
}
