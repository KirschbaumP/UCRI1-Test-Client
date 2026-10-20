import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppendixDefinition,
  AppendixDto,
  AppendixScope,
  findAppendixDefinition,
  isAvailableIn,
  nowUtc,
} from '@ucri/shared';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AppConfigService } from '../core/app-config.service';

/**
 * Editor für Appendix-DTOs (Key-Value-Paare, Kap. 4.2.4 / 4.12).
 * Die Key-Vorschläge stammen aus dem Katalog der beim Start konfigurierten UCRI-Version.
 */
@Component({
  selector: 'app-appendix-editor',
  imports: [
    FormsModule,
    NzAutocompleteModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  template: `
    <nz-table #table [nzData]="rows()" nzSize="small" [nzShowPagination]="false" [nzFrontPagination]="false">
      <thead>
        <tr>
          <th nzWidth="34%">Key</th>
          <th>Wert</th>
          <th nzWidth="24%">Bedeutung</th>
          <th nzWidth="48px"></th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track $index; let i = $index) {
          @let def = definition(row.key);
          <tr>
            <td>
              <input
                nz-input
                nzSize="small"
                [(ngModel)]="row.key"
                (ngModelChange)="changed.emit()"
                [nzAutocomplete]="auto"
                placeholder="Key"
              />
              <nz-autocomplete #auto [compareWith]="compareKeys">
                @for (d of suggestions(row.key); track d.key) {
                  <nz-auto-option [nzValue]="d.key" [nzLabel]="d.key">
                    <span class="opt-key">{{ d.key }}</span>
                    <span class="opt-prompt">{{ d.prompt }}</span>
                    @if (d.required) {
                      <nz-tag nzColor="volcano">Pflicht</nz-tag>
                    }
                    @if (d.since !== '1.0') {
                      <nz-tag nzColor="blue">ab {{ d.since }}</nz-tag>
                    }
                  </nz-auto-option>
                }
              </nz-autocomplete>
            </td>
            <td>
              @if (def?.enumValues && !def?.multiple) {
                <nz-select
                  nzSize="small"
                  nzAllowClear
                  nzShowSearch
                  class="full"
                  [(ngModel)]="row.value"
                  (ngModelChange)="changed.emit()"
                >
                  @for (v of def!.enumValues; track v) {
                    <nz-option [nzValue]="v" [nzLabel]="v" />
                  }
                  @if (row.value && !def!.enumValues!.includes(row.value)) {
                    <nz-option [nzValue]="row.value" [nzLabel]="row.value + ' (ungültig)'" />
                  }
                </nz-select>
              } @else if (def?.type === 'timestamp') {
                <nz-input-group nzSize="small" [nzAddOnAfter]="nowBtn">
                  <input nz-input [(ngModel)]="row.value" (ngModelChange)="changed.emit()" placeholder="2024-05-24T13:13:00.000Z" />
                </nz-input-group>
                <ng-template #nowBtn>
                  <a (click)="row.value = now(); changed.emit()" nz-tooltip nzTooltipTitle="jetzt (UTC)">
                    <nz-icon nzType="clock-circle" />
                  </a>
                </ng-template>
              } @else {
                <input
                  nz-input
                  nzSize="small"
                  [(ngModel)]="row.value"
                  (ngModelChange)="changed.emit()"
                  [placeholder]="def?.enumValues ? def!.enumValues!.join(', ') : ''"
                />
              }
            </td>
            <td class="meaning">
              @if (def) {
                <span nz-tooltip [nzTooltipTitle]="def.description">{{ def.prompt }}</span>
                @if (def.required) {
                  <nz-tag nzColor="volcano">Pflicht</nz-tag>
                }
                @if (!isAvailable(def)) {
                  <nz-tag nzColor="orange" nz-tooltip [nzTooltipTitle]="'Aktive Version: UCRI ' + version()">
                    erst ab {{ def.since }}
                  </nz-tag>
                } @else if (def.since !== '1.0') {
                  <nz-tag nzColor="blue">ab {{ def.since }}</nz-tag>
                }
              } @else if (row.key) {
                <nz-tag>benutzerdefiniert</nz-tag>
              }
            </td>
            <td>
              <button nz-button nzType="text" nzDanger nzSize="small" (click)="remove(i)" aria-label="Entfernen">
                <nz-icon nzType="delete" />
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    <div class="actions">
      <button nz-button nzSize="small" (click)="add()"><nz-icon nzType="plus" /> Appendix</button>
      @if (missingRequired().length) {
        <button nz-button nzSize="small" (click)="addRequired()">
          <nz-icon nzType="exclamation-circle" /> Pflichtfelder ergänzen ({{ missingRequired().length }})
        </button>
      }
    </div>
  `,
  styles: `
    .full {
      width: 100%;
    }
    .opt-key {
      font-family: monospace;
      margin-right: 8px;
    }
    .opt-prompt {
      color: #8c8c8c;
      margin-right: 8px;
    }
    .meaning nz-tag {
      margin-left: 4px;
    }
    .actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }
  `,
})
export class AppendixEditorComponent {
  private readonly appConfig = inject(AppConfigService);

  readonly scope = input.required<AppendixScope>();
  /** wird direkt bearbeitet; Änderungen werden über (changed) gemeldet */
  readonly appendices = input.required<AppendixDto[]>();
  readonly changed = output<void>();

  readonly version = this.appConfig.version;
  readonly catalog = computed(() => this.appConfig.catalogFor(this.scope()));

  /** wird bei Hinzufügen/Entfernen erhöht, da das Array in-place geändert wird */
  private readonly revision = signal(0);
  readonly rows = computed(() => {
    this.revision();
    return [...this.appendices()];
  });

  readonly compareKeys = (a: unknown, b: unknown) => a === b;
  readonly now = nowUtc;

  // bewusst Methode statt computed: das Array wird in-place bearbeitet
  missingRequired(): AppendixDefinition[] {
    const keys = new Set(this.appendices().map((a) => a.key));
    return this.catalog().filter((d) => d.required && !keys.has(d.key));
  }

  definition(key: string): AppendixDefinition | undefined {
    return key ? findAppendixDefinition(this.scope(), key) : undefined;
  }

  isAvailable(def: AppendixDefinition): boolean {
    return isAvailableIn(def.since, this.version());
  }

  suggestions(typed: string): AppendixDefinition[] {
    const q = (typed ?? '').toLowerCase();
    const used = new Set(this.appendices().map((a) => a.key));
    return this.catalog().filter(
      (d) =>
        (!used.has(d.key) || d.key === typed) &&
        (!q || d.key.toLowerCase().includes(q) || d.prompt.toLowerCase().includes(q)),
    );
  }

  add(): void {
    this.appendices().push({ key: '', value: '' });
    this.structureChanged();
  }

  addRequired(): void {
    for (const d of this.missingRequired()) this.appendices().push({ key: d.key, value: '' });
    this.structureChanged();
  }

  remove(index: number): void {
    this.appendices().splice(index, 1);
    this.structureChanged();
  }

  private structureChanged(): void {
    this.revision.update((r) => r + 1);
    this.changed.emit();
  }
}
