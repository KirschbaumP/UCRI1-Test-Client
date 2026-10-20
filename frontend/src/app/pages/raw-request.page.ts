import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RawRequest } from '@ucri/shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AppConfigService } from '../core/app-config.service';
import { createCallRunner } from '../core/call-runner';
import { UiApiService } from '../core/ui-api.service';
import { CallResultComponent } from '../shared/call-result.component';

interface Preset {
  label: string;
  method: RawRequest['method'];
  path: string;
  auth: RawRequest['auth'];
  body?: string;
  headers?: string;
}

/** Beliebige Requests an die Partner-API, z.B. für Negativtests. */
@Component({
  selector: 'app-raw-request-page',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    CallResultComponent,
  ],
  template: `
    <div class="page-title"><h2>Freier Request</h2></div>
    <nz-card>
      <div class="toolbar presets">
        <span class="muted">Vorlagen:</span>
        @for (p of presets; track p.label) {
          <button nz-button nzSize="small" (click)="apply(p)">{{ p.label }}</button>
        }
      </div>
      <div nz-row [nzGutter]="[12, 12]">
        <div nz-col [nzXs]="8" [nzMd]="4">
          <nz-select [(ngModel)]="method" class="full">
            @for (m of methods; track m) {
              <nz-option [nzValue]="m" [nzLabel]="m" />
            }
          </nz-select>
        </div>
        <div nz-col [nzXs]="16" [nzMd]="20">
          <nz-input-group [nzAddOnBefore]="(appConfig.selectedPartner()?.baseUrl ?? '') + '/'">
            <input nz-input [(ngModel)]="path" placeholder="incidents/{sharedIncidentId}/messages" />
          </nz-input-group>
        </div>
        <div nz-col [nzSpan]="24">
          <span class="lbl">Authentifizierung</span>
          <nz-radio-group [(ngModel)]="auth">
            <label nz-radio-button nzValue="token">Gültiges Token</label>
            <label nz-radio-button nzValue="none">Ohne Token</label>
            <label nz-radio-button nzValue="invalid">Ungültiges Token</label>
          </nz-radio-group>
        </div>
        <div nz-col [nzXs]="24" [nzLg]="8">
          <span class="lbl">Zusätzliche Header (JSON)</span>
          <textarea nz-input rows="8" class="mono" [(ngModel)]="headers" placeholder='{ "Accept": "application/vnd.simplemedia+json" }'></textarea>
        </div>
        <div nz-col [nzXs]="24" [nzLg]="16">
          <span class="lbl">Body (wird unverändert gesendet)</span>
          <textarea nz-input rows="8" class="mono" [(ngModel)]="body"></textarea>
        </div>
      </div>
      @if (parseError()) {
        <nz-alert nzType="error" [nzMessage]="parseError()!" class="err" />
      }
      <div class="toolbar send">
        <button nz-button nzType="primary" [disabled]="!appConfig.selectedPartner()" [nzLoading]="call.loading()" (click)="send()">
          <nz-icon nzType="send" /> Senden
        </button>
      </div>
      <app-call-result [result]="call.result()" />
    </nz-card>
  `,
  styles: `
    .full {
      width: 100%;
    }
    .lbl {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .mono {
      font-family: monospace;
      font-size: 12px;
    }
    .presets,
    .send,
    .err {
      margin: 12px 0;
    }
  `,
})
export class RawRequestPage {
  private readonly api = inject(UiApiService);
  readonly appConfig = inject(AppConfigService);
  readonly call = createCallRunner();

  readonly methods: RawRequest['method'][] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  readonly method = signal<RawRequest['method']>('GET');
  readonly path = signal('home');
  readonly auth = signal<RawRequest['auth']>('none');
  readonly headers = signal('');
  readonly body = signal('');
  readonly parseError = signal<string | null>(null);

  readonly presets: Preset[] = [
    { label: 'Home ohne Token (→ 401)', method: 'GET', path: 'home', auth: 'none' },
    { label: 'Home mit ungültigem Token (→ 401)', method: 'GET', path: 'home', auth: 'invalid' },
    { label: 'Authorize ohne Header (→ 400)', method: 'GET', path: 'authorize', auth: 'none' },
    {
      label: 'Stichworte als simplemedia+json',
      method: 'GET',
      path: 'classifications',
      auth: 'token',
      headers: '{\n  "Accept": "application/vnd.simplemedia+json",\n  "Response-Content-Type": "application/vnd.simplemedia+json"\n}',
    },
    { label: 'Ungültiger Einsatz (→ 400)', method: 'POST', path: 'incidents', auth: 'token', body: '{\n  "id": "1",\n  "sentByElsAt": "22.10.2018 13:13"\n}' },
    { label: 'Kaputtes JSON (→ 400)', method: 'POST', path: 'incidents', auth: 'token', body: '{ "id": ', headers: '{ "Content-Type": "application/json" }' },
    {
      label: 'Quittierung unbekannter Einsatz (→ 404)',
      method: 'PUT',
      path: 'incidents/00000000-0000-0000-0000-000000000000/acknowledgements/confirm',
      auth: 'token',
      body: `{\n  "sharedIncidentId": "00000000-0000-0000-0000-000000000000",\n  "status": "Accepted",\n  "timestamp": "${new Date().toISOString()}"\n}`,
    },
  ];

  apply(p: Preset): void {
    this.method.set(p.method);
    this.path.set(p.path);
    this.auth.set(p.auth);
    this.body.set(p.body ?? '');
    this.headers.set(p.headers ?? '');
  }

  async send(): Promise<void> {
    const partner = this.appConfig.selectedPartner();
    if (!partner) return;
    let headers: Record<string, string> | undefined;
    try {
      headers = this.headers().trim() ? (JSON.parse(this.headers()) as Record<string, string>) : undefined;
      this.parseError.set(null);
    } catch (e) {
      this.parseError.set(`Header sind kein gültiges JSON: ${(e as Error).message}`);
      return;
    }
    // Body bewusst als String senden, damit auch ungültiges JSON getestet werden kann
    const body = this.body().trim() ? this.body() : undefined;
    await this.call.run(() =>
      this.api.raw(partner.id, { method: this.method(), path: this.path(), auth: this.auth(), headers, body }),
    );
  }
}
