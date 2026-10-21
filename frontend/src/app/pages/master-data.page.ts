import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CallResult, ClassificationDto, itemsOf, ResourceTypeDto } from '@ucri/shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AppConfigService } from '../core/app-config.service';
import { createCallRunner } from '../core/call-runner';
import { UiApiService } from '../core/ui-api.service';
import { CallResultComponent } from '../shared/call-result.component';

/** 5.7/5.8 Stichworte und Einsatzmitteltypen des Partners (für das Mapping, 2.2.1/2.2.2). */
@Component({
  selector: 'app-master-data-page',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    CallResultComponent,
  ],
  template: `
    <div class="page-title">
      <h2>Stammdaten des Partners</h2>
      <div class="toolbar">
        <label nz-checkbox [(ngModel)]="useEtag">ETag / If-None-Match verwenden</label>
        <input nz-input class="filter" placeholder="Filter" [(ngModel)]="filter" />
      </div>
    </div>
    <div nz-row [nzGutter]="[16, 16]">
      <div nz-col [nzXs]="24" [nzXl]="12">
        <nz-card [nzTitle]="'Stichworte (5.7) – ' + classifications().length" [nzExtra]="clsBtn">
          <ng-template #clsBtn>
            <button nz-button nzSize="small" [nzLoading]="cls.loading()" (click)="loadClassifications()">
              <nz-icon nzType="reload" /> Abrufen
            </button>
          </ng-template>
          @if (cls.result()?.status === 304) {
            <nz-tag nzColor="cyan">304 Not Modified – Daten aus dem ETag-Cache</nz-tag>
          }
          <nz-table #ct [nzData]="filteredClassifications()" nzSize="small" [nzPageSize]="15">
            <thead>
              <tr>
                <th [nzSortFn]="sortAbbr">Kürzel</th>
                <th>Beschreibung</th>
                <th>Gruppe</th>
              </tr>
            </thead>
            <tbody>
              @for (c of ct.data; track c.abbreviation) {
                <tr>
                  <td><nz-tag>{{ c.abbreviation }}</nz-tag></td>
                  <td>{{ c.description }}</td>
                  <td>{{ c.classificationGroup }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <app-call-result [result]="cls.result()" [showBody]="false" />
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzXl]="12">
        <nz-card [nzTitle]="'Einsatzmitteltypen (5.8) – ' + resourceTypes().length" [nzExtra]="rtBtn">
          <ng-template #rtBtn>
            <button nz-button nzSize="small" [nzLoading]="rt.loading()" (click)="loadResourceTypes()">
              <nz-icon nzType="reload" /> Abrufen
            </button>
          </ng-template>
          @if (rt.result()?.status === 304) {
            <nz-tag nzColor="cyan">304 Not Modified – Daten aus dem ETag-Cache</nz-tag>
          }
          <nz-table #rtt [nzData]="filteredResourceTypes()" nzSize="small" [nzPageSize]="15">
            <thead>
              <tr>
                <th [nzSortFn]="sortAbbr">Kürzel</th>
                <th>Beschreibung</th>
              </tr>
            </thead>
            <tbody>
              @for (t of rtt.data; track t.abbreviation) {
                <tr>
                  <td><nz-tag>{{ t.abbreviation }}</nz-tag></td>
                  <td>{{ t.description }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <app-call-result [result]="rt.result()" [showBody]="false" />
        </nz-card>
      </div>
    </div>
  `,
  styles: `
    .filter {
      width: 220px;
    }
  `,
})
export class MasterDataPage {
  private readonly api = inject(UiApiService);
  private readonly appConfig = inject(AppConfigService);

  readonly cls = createCallRunner();
  readonly rt = createCallRunner();
  readonly useEtag = signal(true);
  readonly filter = signal('');

  readonly classifications = computed(() => this.listOf<ClassificationDto>(this.cls.result()));
  readonly resourceTypes = computed(() => this.listOf<ResourceTypeDto>(this.rt.result()));
  readonly filteredClassifications = computed(() => this.applyFilter(this.classifications()));
  readonly filteredResourceTypes = computed(() => this.applyFilter(this.resourceTypes()));

  readonly sortAbbr = (a: { abbreviation: string }, b: { abbreviation: string }) =>
    a.abbreviation.localeCompare(b.abbreviation);

  private listOf<T>(r: CallResult | null): T[] {
    return itemsOf<T>(r?.body);
  }

  private applyFilter<T extends { abbreviation: string; description: string }>(list: T[]): T[] {
    const q = this.filter().toLowerCase();
    return q
      ? list.filter((x) => x.abbreviation?.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q))
      : list;
  }

  loadClassifications() {
    const p = this.appConfig.selectedPartnerId();
    if (p) void this.cls.run(() => this.api.classifications(p, this.useEtag()));
  }

  loadResourceTypes() {
    const p = this.appConfig.selectedPartnerId();
    if (p) void this.rt.run(() => this.api.resourceTypes(p, this.useEtag()));
  }
}
