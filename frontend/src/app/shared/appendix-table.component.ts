import { Component, inject, input } from '@angular/core';
import { AppendixDto, AppendixScope, findAppendixDefinition, isAvailableIn } from '@ucri/shared';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AppConfigService } from '../core/app-config.service';

/** Schreibgeschützte Anzeige von Appendices mit Bedeutung laut Katalog. */
@Component({
  selector: 'app-appendix-table',
  imports: [NzTableModule, NzTagModule, NzTooltipModule],
  template: `
    <nz-table [nzData]="appendices() ?? []" nzSize="small" [nzShowPagination]="false" [nzFrontPagination]="false">
      <thead>
        <tr>
          <th>Key</th>
          <th>Bedeutung</th>
          <th>Wert</th>
        </tr>
      </thead>
      <tbody>
        @for (a of appendices() ?? []; track $index) {
          @let def = definition(a.key);
          <tr>
            <td><code>{{ a.key }}</code></td>
            <td>
              @if (def) {
                <span nz-tooltip [nzTooltipTitle]="def.description">{{ def.prompt }}</span>
                @if (!available(def.since)) {
                  <nz-tag nzColor="orange">erst ab {{ def.since }}</nz-tag>
                }
              } @else {
                <nz-tag>benutzerdefiniert</nz-tag>
              }
            </td>
            <td class="value">{{ a.value }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .value {
      word-break: break-word;
    }
  `,
})
export class AppendixTableComponent {
  private readonly appConfig = inject(AppConfigService);

  readonly scope = input.required<AppendixScope>();
  readonly appendices = input<AppendixDto[] | undefined>([]);

  definition(key: string) {
    return findAppendixDefinition(this.scope(), key);
  }

  available(since: '1.0' | '1.1'): boolean {
    return isAvailableIn(since, this.appConfig.version());
  }
}
