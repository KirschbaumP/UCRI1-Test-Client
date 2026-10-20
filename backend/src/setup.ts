import type { NestExpressApplication } from '@nestjs/platform-express';
import { SIMPLEMEDIA_TYPE } from './ucri-server/ucri-request.js';

/** Gemeinsame App-Konfiguration für main.ts und e2e-Tests. */
export function configureApp(
  app: NestExpressApplication,
): NestExpressApplication {
  // JSON auch für application/vnd.simplemedia+json und andere +json-Typen akzeptieren
  app.useBodyParser('json', {
    type: ['application/json', 'application/*+json', SIMPLEMEDIA_TYPE],
    limit: '10mb',
  });
  // Kap. 2.4.2: ETag/If-None-Match → 304 Not Modified
  app.set('etag', 'strong');
  app.enableShutdownHooks();
  return app;
}
