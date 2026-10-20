import { Component, computed, input } from '@angular/core';
import { ValidationIssue } from '@ucri/shared';
import { NzTagModule } from 'ng-zorro-antd/tag';

/** Liste von Validierungsfehlern und -warnungen. */
@Component({
  selector: 'app-issue-list',
  imports: [NzTagModule],
  template: `
    @if (sorted().length) {
      <ul class="issues">
        @for (issue of sorted(); track $index) {
          <li>
            <nz-tag [nzColor]="issue.severity === 'error' ? 'red' : 'orange'">
              {{ issue.severity === 'error' ? 'Fehler' : 'Warnung' }}
            </nz-tag>
            <code>{{ issue.path }}</code> {{ issue.message }}
          </li>
        }
      </ul>
    } @else if (showEmpty()) {
      <nz-tag nzColor="green">Keine Auffälligkeiten</nz-tag>
    }
  `,
  styles: `
    .issues {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .issues li {
      padding: 2px 0;
    }
    code {
      font-size: 12px;
      margin-right: 4px;
    }
  `,
})
export class IssueListComponent {
  readonly issues = input<ValidationIssue[] | undefined>([]);
  readonly showEmpty = input(false);

  readonly sorted = computed(() =>
    [...(this.issues() ?? [])].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1)),
  );
}
