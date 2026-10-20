import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { type AppConfig, findUp, moduleDir } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { StateModule } from './state/state.module.js';
import { PartnerClientService } from './ucri-client/partner-client.service.js';
import { UcriServerModule } from './ucri-server/ucri-server.module.js';
import { UiApiController } from './ui-api/ui-api.controller.js';

export interface AppModuleOptions {
  /** feste Konfiguration (Tests); sonst wird config/ucri.config.json geladen */
  config?: AppConfig;
  /** Angular-Frontend ausliefern (Default: true) */
  serveFrontend?: boolean;
}

const FRONTEND_DIST = 'frontend/dist/frontend/browser';

function frontendModules(): DynamicModule[] {
  const rootPath = findUp(FRONTEND_DIST, [process.cwd(), moduleDir()]);
  if (!rootPath) {
    new Logger('AppModule').warn(
      `Frontend-Build (${FRONTEND_DIST}) nicht gefunden – nur API verfügbar. "npm run build" ausführen.`,
    );
    return [];
  }
  return [
    ServeStaticModule.forRoot({
      rootPath,
      exclude: ['/api/{*path}', '/ui-api/{*path}'],
    }),
  ];
}

/**
 * Eine Anwendung, ein Prozess:
 *  - /api     eigene UCRI-Schnittstelle (Empfangs-Server)
 *  - /ui-api  interne API für das Frontend (inkl. ausgehendem UCRI-Client)
 *  - /        Angular-Frontend
 */
@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(options.config),
        StateModule,
        UcriServerModule,
        ...(options.serveFrontend === false ? [] : frontendModules()),
      ],
      controllers: [UiApiController],
      providers: [PartnerClientService],
    };
  }
}
