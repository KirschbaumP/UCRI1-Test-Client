import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ClassificationDto,
  createSampleIncident,
  IncidentDto,
  InformerDto,
  itemsOf,
  nowUtc,
  PatientDto,
  ResourceDto,
  ResourceTypeDto,
  validateIncident,
} from '@ucri/shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AppConfigService } from '../core/app-config.service';
import { createCallRunner } from '../core/call-runner';
import { UiApiService } from '../core/ui-api.service';
import { AppendixEditorComponent } from '../shared/appendix-editor.component';
import { CallResultComponent } from '../shared/call-result.component';
import { IssueListComponent } from '../shared/issue-list.component';

@Component({
  selector: 'app-send-incident-page',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDividerModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTooltipModule,
    AppendixEditorComponent,
    CallResultComponent,
    IssueListComponent,
  ],
  templateUrl: './send-incident.page.html',
  styleUrl: './send-incident.page.less',
})
export class SendIncidentPage {
  private readonly api = inject(UiApiService);
  private readonly appConfig = inject(AppConfigService);

  readonly cfg = this.appConfig.config;
  readonly partner = this.appConfig.selectedPartner;
  readonly call = createCallRunner();
  readonly masterData = createCallRunner();

  readonly incident = signal<IncidentDto>(this.sample(false));
  /** wird bei jeder Bearbeitung erhöht, da das Incident-Objekt in-place bearbeitet wird */
  private readonly revision = signal(0);

  readonly validation = computed(() => {
    this.revision();
    return validateIncident(this.incident(), this.cfg().ucriVersion, {
      strictRequiredAppendices: this.cfg().strictRequiredAppendices,
    });
  });
  readonly errorCount = computed(() => this.validation().issues.filter((i) => i.severity === 'error').length);
  readonly warningCount = computed(() => this.validation().issues.length - this.errorCount());

  readonly partnerClassifications = signal<ClassificationDto[]>([]);
  readonly partnerResourceTypes = signal<ResourceTypeDto[]>([]);

  readonly tabIndex = signal(0);
  readonly jsonText = signal('');
  readonly jsonError = signal<string | null>(null);

  touch(): void {
    this.revision.update((r) => r + 1);
  }

  private sample(withResourceRequest: boolean): IncidentDto {
    const p = this.appConfig.selectedPartner();
    return createSampleIncident({
      version: this.appConfig.version(),
      sender: this.appConfig.config().ownControlCenterId,
      target: p?.controlCenterId ?? 'els-partner',
      controlCenterName: this.appConfig.config().ownControlCenterName,
      withResourceRequest,
    });
  }

  loadSample(withResourceRequest: boolean): void {
    this.setIncident(this.sample(withResourceRequest));
  }

  clear(): void {
    const p = this.partner();
    this.setIncident({
      id: '',
      sharedIncidentId: crypto.randomUUID(),
      sender: this.cfg().ownControlCenterId,
      target: p?.controlCenterId ?? '',
      sentByDispatcherAt: nowUtc(),
      sentByElsAt: nowUtc(),
      classifications: [],
      requestedResources: [],
      resources: [],
      patients: [],
      informers: [],
      appendices: [],
    });
  }

  private setIncident(incident: IncidentDto): void {
    this.incident.set(incident);
    this.jsonText.set(JSON.stringify(incident, null, 2));
    this.jsonError.set(null);
    this.touch();
  }

  newSharedId(): void {
    const inc = this.incident();
    const old = inc.sharedIncidentId;
    inc.sharedIncidentId = crypto.randomUUID();
    // gleichlautenden Appendix (ab 1.1) mitziehen
    for (const a of inc.appendices ?? []) if (a.key === 'SharedIncidentId' && a.value === old) a.value = inc.sharedIncidentId;
    this.touch();
  }

  now(field: 'sentByDispatcherAt' | 'sentByElsAt'): void {
    this.incident()[field] = nowUtc();
    this.touch();
  }

  // --- Listen-Bearbeitung ---------------------------------------------------

  list<K extends 'requestedResources' | 'resources' | 'patients' | 'informers'>(key: K): NonNullable<IncidentDto[K]> {
    const inc = this.incident();
    return (inc[key] ??= [] as never) as NonNullable<IncidentDto[K]>;
  }

  addRequest(): void {
    const reqs = this.list('requestedResources');
    reqs.push({ requestId: `${this.incident().id || 'R'}-${reqs.length + 1}`, resourceType: '', targetId: this.incident().target });
    this.touch();
  }

  addResource(): void {
    const res: ResourceDto = { resourceId: `${Date.now()}`.slice(-6), appendices: [{ key: 'RadioCallSign', value: '' }, { key: 'Type', value: '' }], patients: [] };
    this.list('resources').push(res);
    this.touch();
  }

  addPatient(target: PatientDto[]): void {
    target.push({ id: `${Date.now()}`.slice(-6), appendices: [] });
    this.touch();
  }

  addInformer(): void {
    const inf: InformerDto = { id: `I-${Date.now()}`.slice(0, 10), appendices: [] };
    this.list('informers').push(inf);
    this.touch();
  }

  remove<T>(list: T[], index: number): void {
    list.splice(index, 1);
    this.touch();
  }

  patientsOf(resource: ResourceDto): PatientDto[] {
    return (resource.patients ??= []);
  }

  incidentAppendices() {
    return (this.incident().appendices ??= []);
  }

  hasType(abbreviation: string): boolean {
    return this.partnerResourceTypes().some((t) => t.abbreviation === abbreviation);
  }

  // --- JSON-Ansicht ---------------------------------------------------------

  onTabChange(index: number): void {
    if (index === 1) {
      this.jsonText.set(JSON.stringify(this.incident(), null, 2));
      this.jsonError.set(null);
    }
    this.tabIndex.set(index);
  }

  onJsonChange(text: string): void {
    this.jsonText.set(text);
    try {
      const parsed = JSON.parse(text) as IncidentDto;
      this.jsonError.set(null);
      this.incident.set(parsed);
      this.touch();
    } catch (e) {
      this.jsonError.set((e as Error).message);
    }
  }

  // --- Partner-Stammdaten -----------------------------------------------------

  async loadMasterData(): Promise<void> {
    const p = this.partner();
    if (!p) return;
    const c = await this.masterData.run(() => this.api.classifications(p.id));
    if (c?.ok) this.partnerClassifications.set(itemsOf(c.body));
    const r = await this.masterData.run(() => this.api.resourceTypes(p.id));
    if (r?.ok) this.partnerResourceTypes.set(itemsOf(r.body));
  }

  // --- Senden -----------------------------------------------------------------

  async send(force = false): Promise<void> {
    const p = this.partner();
    if (!p) return;
    const inc = this.incident();
    inc.sentByElsAt = nowUtc();
    this.touch();
    await this.call.run(() => this.api.sendIncident(p.id, inc, force), 'Einsatz übergeben');
  }
}
