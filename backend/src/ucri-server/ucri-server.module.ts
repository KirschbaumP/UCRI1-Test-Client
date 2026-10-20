import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { InboundTrafficMiddleware } from './inbound-traffic.middleware.js';
import { JwtBearerGuard } from './jwt-bearer.guard.js';
import { TokenService } from './token.service.js';
import { UcriApiController } from './ucri-api.controller.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ secret: config.jwtSecret }),
    }),
  ],
  controllers: [UcriApiController],
  providers: [TokenService, JwtBearerGuard],
})
export class UcriServerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // für alle Pfade, damit auch Aufrufe unbekannter /api-Routen (404) protokolliert werden
    consumer.apply(InboundTrafficMiddleware).forRoutes('{*path}');
  }
}
