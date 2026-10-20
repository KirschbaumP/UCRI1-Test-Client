import { Global, Module } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { IncidentStoreService } from './incident-store.service.js';
import { TrafficLogService } from './traffic-log.service.js';

@Global()
@Module({
  providers: [EventsService, TrafficLogService, IncidentStoreService],
  exports: [EventsService, TrafficLogService, IncidentStoreService],
})
export class StateModule {}
