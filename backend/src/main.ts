import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ConfigError, loadAppConfig } from './config/app-config.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  let config;
  try {
    config = loadAppConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      logger.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot({ config }),
    { bodyParser: false },
  );
  configureApp(app);
  await app.listen(config.port);

  logger.log(
    `UCRI Test-Client läuft mit UCRI-Version ${config.ucriVersion} (Config: ${config.configPath ?? 'Defaults'})`,
  );
  logger.log(`UI:            http://localhost:${config.port}/`);
  logger.log(`UCRI-API:      http://localhost:${config.port}/api/home`);
  logger.log(
    `Partner:       ${config.partners.map((p) => `${p.id} → ${p.baseUrl}`).join(', ') || '–'}`,
  );
}
await bootstrap();
