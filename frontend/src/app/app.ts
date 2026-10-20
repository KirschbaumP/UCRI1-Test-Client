import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AppConfigService } from './core/app-config.service';
import { LiveStateService } from './core/live-state.service';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NzBadgeModule,
    NzIconModule,
    NzLayoutModule,
    NzMenuModule,
    NzSelectModule,
    NzTagModule,
    NzTooltipModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  protected readonly appConfig = inject(AppConfigService);
  protected readonly live = inject(LiveStateService);
  protected readonly config = this.appConfig.config;

  protected readonly unansweredInbound = computed(
    () => this.live.inbound().filter((r) => !r.confirmations.some((c) => c.type === 'confirm')).length,
  );

  protected readonly menu = [
    { path: '/connection', icon: 'api', label: 'Verbindung' },
    { path: '/send', icon: 'send', label: 'Einsatz senden' },
    { path: '/incidents', icon: 'inbox', label: 'Einsätze & Quittierungen' },
    { path: '/messages', icon: 'message', label: 'Nachrichten' },
    { path: '/master-data', icon: 'database', label: 'Stammdaten' },
    { path: '/traffic', icon: 'unordered-list', label: 'Traffic-Log' },
    { path: '/raw', icon: 'code', label: 'Freier Request' },
    { path: '/catalog', icon: 'book', label: 'Appendix-Katalog' },
  ];
}
