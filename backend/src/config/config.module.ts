import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig, loadAppConfig } from './app-config.js';

@Global()
@Module({})
export class ConfigModule {
  /** `config` erlaubt Tests eine fertige Konfiguration zu übergeben. */
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: APP_CONFIG, useFactory: () => config ?? loadAppConfig() },
      ],
      exports: [APP_CONFIG],
    };
  }
}
