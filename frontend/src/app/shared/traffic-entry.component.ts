import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TrafficEntry } from '@ucri/shared';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { IssueListComponent } from './issue-list.component';
import { JsonViewComponent } from './json-view.component';
import { StatusTagComponent } from './status-tag.component';

/** Details eines Request/Response-Paares. */
@Component({
  selector: 'app-traffic-entry',
  imports: [DatePipe, NzDescriptionsModule, NzGridModule, JsonViewComponent, IssueListComponent, StatusTagComponent],
  template: `
    @let e = entry();
    <p class="line">
      <app-status-tag [status]="e.status" [error]="e.error" />
      <strong>{{ e.method }}</strong> <code>{{ e.url }}</code>
      <span class="meta">{{ e.timestamp | date: 'HH:mm:ss.SSS' }} · {{ e.durationMs ?? '–' }} ms</span>
    </p>
    @if (e.error) {
      <p class="error">{{ e.error }}</p>
    }
    <app-issue-list [issues]="e.issues" />
    <div nz-row [nzGutter]="16">
      <div nz-col [nzXs]="24" [nzLg]="12">
        <h4>Request</h4>
        <app-json-view [value]="e.requestHeaders" maxHeight="160px" />
        <app-json-view [value]="e.requestBody" />
      </div>
      <div nz-col [nzXs]="24" [nzLg]="12">
        <h4>Response</h4>
        <app-json-view [value]="e.responseHeaders" maxHeight="160px" />
        <app-json-view [value]="e.responseBody" />
      </div>
    </div>
  `,
  styles: `
    .line {
      margin-bottom: 8px;
    }
    .meta {
      color: #8c8c8c;
      margin-left: 8px;
    }
    .error {
      color: #cf1322;
    }
    h4 {
      margin: 8px 0 4px;
    }
    app-json-view {
      display: block;
      margin-bottom: 6px;
    }
  `,
})
export class TrafficEntryComponent {
  readonly entry = input.required<TrafficEntry>();
}
