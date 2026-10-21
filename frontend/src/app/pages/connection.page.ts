import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { HomeDto, TokenFieldNames, TokenStatus } from '@ucri/shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AppConfigService } from '../core/app-config.service';
import { createCallRunner } from '../core/call-runner';
import { UiApiService } from '../core/ui-api.service';
import { CallResultComponent } from '../shared/call-result.component';

@Component({
  selector: 'app-connection-page',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzGridModule,
    NzIconModule,
    NzTagModule,
    CallResultComponent,
  ],
  template: `
    <div class="page-title"><h2>Verbindung</h2></div>
    <div nz-row [nzGutter]="[16, 16]">
      <div nz-col [nzXs]="24" [nzXl]="12">
        <nz-card nzTitle="Eigene Schnittstelle (Empfangs-Server)">
          <nz-descriptions nzBordered [nzColumn]="1" nzSize="small">
            <nz-descriptions-item nzTitle="UCRI-Version">
              <nz-tag nzColor="geekblue">{{ cfg().ucriVersion }}</nz-tag>
              <span class="muted">per Config/ENV beim Start festgelegt</span>
            </nz-descriptions-item>
            <nz-descriptions-item nzTitle="Leitstelle">{{ cfg().ownControlCenterName }} ({{ cfg().ownControlCenterId }})</nz-descriptions-item>
            <nz-descriptions-item nzTitle="Base-Url"><code>{{ cfg().publicBaseUrl }}</code></nz-descriptions-item>
            <nz-descriptions-item nzTitle="Produkt">{{ cfg().applicationName }} {{ cfg().applicationVersion }}</nz-descriptions-item>
            <nz-descriptions-item nzTitle="Pflicht-Appendices">
              {{ cfg().strictRequiredAppendices ? 'fehlende → 400 Bad Request' : 'fehlende → Warnung' }}
            </nz-descriptions-item>
            <nz-descriptions-item nzTitle="JWT-Feldnamen">
              {{ tokenFieldNamesLabel[cfg().tokenFieldNames] }}
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzXl]="12">
        <nz-card nzTitle="Partner-Schnittstelle (Client)">
          @if (partner(); as p) {
            <nz-descriptions nzBordered [nzColumn]="1" nzSize="small">
              <nz-descriptions-item nzTitle="Partner">{{ p.name }} ({{ p.id }})</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Base-Url"><code>{{ p.baseUrl }}</code></nz-descriptions-item>
              <nz-descriptions-item nzTitle="Client-Id"><code>{{ p.clientId }}</code></nz-descriptions-item>
              <nz-descriptions-item nzTitle="Leitstellenkennung"><code>{{ p.controlCenterId }}</code></nz-descriptions-item>
              <nz-descriptions-item nzTitle="Content-Type"><code>{{ p.contentType }}</code></nz-descriptions-item>
              <nz-descriptions-item nzTitle="Basic-Auth">
                <code>{{ p.basicAuthFormat === 'clientIdAndSecret' ? 'base64(Client-Id:Secret)' : 'base64(Secret)' }}</code>
              </nz-descriptions-item>
              <nz-descriptions-item nzTitle="Token">
                @if (token()?.hasToken) {
                  <nz-tag [nzColor]="remaining() > 0 ? 'green' : 'red'">
                    {{ remaining() > 0 ? 'gültig, noch ' + formatDuration(remaining()) : 'abgelaufen' }}
                  </nz-tag>
                  <span class="muted">bis {{ token()!.expiresAt | date: 'HH:mm:ss' }} · {{ token()!.tokenPreview }}</span>
                } @else {
                  <nz-tag>kein Token</nz-tag>
                }
              </nz-descriptions-item>
            </nz-descriptions>
            <div class="toolbar actions">
              <button nz-button nzType="primary" [nzLoading]="call.loading()" (click)="authorize()">
                <nz-icon nzType="key" /> Authorize
              </button>
              <button nz-button [nzLoading]="call.loading()" (click)="home()"><nz-icon nzType="api" /> Home abrufen</button>
              <button nz-button nzDanger (click)="clearToken()"><nz-icon nzType="disconnect" /> Token verwerfen</button>
            </div>
          } @else {
            <nz-alert nzType="warning" nzMessage="Kein Partner konfiguriert (config/ucri.config.json → partners)." />
          }
        </nz-card>
      </div>
    </div>

    @if (homeDto(); as h) {
      <nz-card nzTitle="Home-DTO des Partners">
        @if (h.version?.ucriVersion !== cfg().ucriVersion) {
          <nz-alert
            nzType="warning"
            nzShowIcon
            [nzMessage]="'Partner meldet UCRI ' + h.version?.ucriVersion + ', dieser Test-Client ist auf UCRI ' + cfg().ucriVersion + ' konfiguriert.'"
          />
        } @else {
          <nz-alert nzType="success" nzShowIcon [nzMessage]="'UCRI-Version stimmt überein (' + cfg().ucriVersion + ')'" />
        }
        <nz-descriptions nzSize="small" [nzColumn]="1" class="home">
          <nz-descriptions-item nzTitle="Produkt">{{ h.version?.applicationName }} {{ h.version?.version }}</nz-descriptions-item>
          @for (l of h.links; track l.href) {
            <nz-descriptions-item [nzTitle]="l.rel"><code>{{ l.href }}</code></nz-descriptions-item>
          }
        </nz-descriptions>
      </nz-card>
    }

    <app-call-result [result]="call.result()" />
  `,
  styles: `
    .actions {
      margin-top: 16px;
    }
    .home {
      margin-top: 12px;
    }
  `,
})
export class ConnectionPage {
  private readonly api = inject(UiApiService);
  private readonly appConfig = inject(AppConfigService);

  readonly cfg = this.appConfig.config;
  readonly partner = this.appConfig.selectedPartner;
  readonly call = createCallRunner();
  readonly token = signal<TokenStatus | null>(null);
  readonly tokenFieldNamesLabel: Record<TokenFieldNames, string> = {
    camelCase: 'accessToken, expiresIn, tokenType',
    snakeCase: 'access_token, expires_in, token_type',
    both: 'camelCase und snake_case',
  };
  readonly homeDto = signal<Partial<HomeDto> | null>(null);

  private readonly now = signal(Date.now());
  readonly remaining = computed(() => {
    const exp = this.token()?.expiresAt;
    return exp ? Math.max(0, Math.round((Date.parse(exp) - this.now()) / 1000)) : 0;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => {
      const p = this.partner();
      this.homeDto.set(null);
      if (p) void this.refreshToken();
    });
  }

  formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    return m ? `${m} min ${sec % 60} s` : `${sec} s`;
  }

  async authorize() {
    await this.call.run(() => this.api.authorize(this.partner()!.id), 'Token erhalten');
    await this.refreshToken();
  }

  async home() {
    const r = await this.call.run(() => this.api.home(this.partner()!.id));
    this.homeDto.set(r?.ok ? (r.body ?? null) : null);
    await this.refreshToken();
  }

  async clearToken() {
    await this.api.clearToken(this.partner()!.id);
    await this.refreshToken();
  }

  private async refreshToken() {
    const p = this.partner();
    if (p) this.token.set(await this.api.tokenStatus(p.id));
  }
}
