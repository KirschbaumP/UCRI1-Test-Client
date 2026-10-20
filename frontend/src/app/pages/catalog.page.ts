import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APPENDIX_CATALOG, AppendixScope, isAvailableIn } from '@ucri/shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AppConfigService } from '../core/app-config.service';

const SCOPES: { scope: AppendixScope; label: string }[] = [
  { scope: 'incident', label: 'Einsatz (4.2.4.1)' },
  { scope: 'informer', label: 'Mitteiler (4.2.4.2)' },
  { scope: 'resource', label: 'Ressource (4.2.4.3)' },
  { scope: 'patient', label: 'Patient (4.2.4.4)' },
  { scope: 'confirmation', label: 'Quittierung (4.2.4.5)' },
];

/** Übersicht der definierten Appendices und ihrer Gültigkeit in der aktiven UCRI-Version. */
@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, NzCardModule, NzCheckboxModule, NzInputModule, NzTableModule, NzTabsModule, NzTagModule],
  template: `
    <div class="page-title">
      <h2>Appendix-Katalog <nz-tag nzColor="geekblue">aktiv: UCRI {{ version() }}</nz-tag></h2>
      <div class="toolbar">
        <label nz-checkbox [(ngModel)]="showAll">auch Keys späterer Versionen anzeigen</label>
        <input nz-input placeholder="Filter" class="filter" [(ngModel)]="filter" />
      </div>
    </div>
    <nz-card>
      <nz-tabs>
        @for (s of scopes; track s.scope) {
          <nz-tab [nzTitle]="s.label + ' – ' + rows(s.scope).length">
            <nz-table #t [nzData]="rows(s.scope)" nzSize="small" [nzPageSize]="100" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Prompt</th>
                  <th>Beschreibung</th>
                  <th>Gruppe</th>
                  <th>Werte</th>
                  <th>Ab Ver.</th>
                </tr>
              </thead>
              <tbody>
                @for (d of t.data; track d.key) {
                  <tr [class.inactive]="!available(d.since)">
                    <td>
                      <code>{{ d.key }}</code>
                      @if (d.required) {
                        <nz-tag nzColor="volcano">Pflicht</nz-tag>
                      }
                    </td>
                    <td>{{ d.prompt }}</td>
                    <td>{{ d.description }}</td>
                    <td>{{ d.group ?? '' }}</td>
                    <td>{{ d.enumValues?.join(' | ') ?? d.type }}</td>
                    <td>
                      <nz-tag [nzColor]="available(d.since) ? (d.since === '1.0' ? 'default' : 'blue') : 'orange'">{{ d.since }}</nz-tag>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>
        }
      </nz-tabs>
    </nz-card>
  `,
  styles: `
    .filter {
      width: 220px;
    }
    .inactive {
      opacity: 0.5;
    }
  `,
})
export class CatalogPage {
  private readonly appConfig = inject(AppConfigService);
  readonly version = this.appConfig.version;
  readonly scopes = SCOPES;
  readonly showAll = signal(false);
  readonly filter = signal('');

  private readonly visible = computed(() => {
    const q = this.filter().toLowerCase();
    return APPENDIX_CATALOG.filter(
      (d) =>
        (this.showAll() || isAvailableIn(d.since, this.version())) &&
        (!q || `${d.key} ${d.prompt} ${d.description}`.toLowerCase().includes(q)),
    );
  });

  rows(scope: AppendixScope) {
    return this.visible().filter((d) => d.scope === scope);
  }

  available(since: '1.0' | '1.1'): boolean {
    return isAvailableIn(since, this.version());
  }
}
