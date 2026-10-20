import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import de from '@angular/common/locales/de';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import {
  ApiOutline,
  BookOutline,
  CheckOutline,
  ClearOutline,
  ClockCircleOutline,
  CloseOutline,
  CodeOutline,
  DatabaseOutline,
  DeleteOutline,
  DisconnectOutline,
  DownloadOutline,
  ExclamationCircleOutline,
  InboxOutline,
  KeyOutline,
  LinkOutline,
  MessageOutline,
  PlusOutline,
  ReloadOutline,
  SendOutline,
  SyncOutline,
  ThunderboltOutline,
  UnorderedListOutline,
} from '@ant-design/icons-angular/icons';
import { de_DE, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { routes } from './app.routes';
import { AppConfigService } from './core/app-config.service';
import { LiveStateService } from './core/live-state.service';

registerLocaleData(de);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withHashLocation()),
    provideHttpClient(withFetch()),
    provideNzI18n(de_DE),
    { provide: LOCALE_ID, useValue: 'de' },
    provideNzIcons([
      ApiOutline,
      BookOutline,
      CheckOutline,
      ClearOutline,
      ClockCircleOutline,
      CloseOutline,
      CodeOutline,
      DatabaseOutline,
      DeleteOutline,
      DisconnectOutline,
      DownloadOutline,
      ExclamationCircleOutline,
      InboxOutline,
      KeyOutline,
      LinkOutline,
      MessageOutline,
      PlusOutline,
      ReloadOutline,
      SendOutline,
      SyncOutline,
      ThunderboltOutline,
      UnorderedListOutline,
    ]),
    // Konfiguration inkl. UCRI-Version vor dem Rendern laden
    // inject() nur synchron aufrufen – nach einem await fehlt der Injection-Kontext (NG0203)
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const liveState = inject(LiveStateService);
      await config.load();
      liveState.start();
    }),
  ],
};
