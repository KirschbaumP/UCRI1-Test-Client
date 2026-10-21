import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AcknowledgementCall,
  AppConfigView,
  CallResult,
  CatalogView,
  ClassificationDto,
  HomeDto,
  IncidentDto,
  IncidentRecord,
  JwtResponseDto,
  MessageDto,
  RawRequest,
  ResourceRequestActionCall,
  ResourceTypeDto,
  TokenStatus,
  TrafficDirection,
  TrafficEntry,
} from '@ucri/shared';
import { firstValueFrom } from 'rxjs';

const BASE = '/ui-api';

/** Zugriff auf die interne UI-API des NestJS-Backends. */
@Injectable({ providedIn: 'root' })
export class UiApiService {
  private readonly http = inject(HttpClient);

  private get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${BASE}/${path}`));
  }

  private post<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${BASE}/${path}`, body));
  }

  private delete(path: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${BASE}/${path}`));
  }

  private partner(id: string, path: string): string {
    return `partners/${encodeURIComponent(id)}/${path}`;
  }

  config = () => this.get<AppConfigView>('config');
  catalog = () => this.get<CatalogView>('catalog');

  tokenStatus = (partnerId: string) => this.get<TokenStatus>(this.partner(partnerId, 'token'));
  clearToken = (partnerId: string) => this.delete(this.partner(partnerId, 'token'));
  authorize = (partnerId: string) => this.post<CallResult<JwtResponseDto>>(this.partner(partnerId, 'authorize'));
  home = (partnerId: string) => this.post<CallResult<HomeDto>>(this.partner(partnerId, 'home'));
  classifications = (partnerId: string, etag = true) =>
    this.post<CallResult<ClassificationDto[]>>(this.partner(partnerId, `classifications?etag=${etag}`));
  resourceTypes = (partnerId: string, etag = true) =>
    this.post<CallResult<ResourceTypeDto[]>>(this.partner(partnerId, `resourceTypes?etag=${etag}`));

  sendIncident = (partnerId: string, incident: IncidentDto, force = false) =>
    this.post<CallResult>(this.partner(partnerId, 'incidents'), { incident, force });
  sendMessage = (partnerId: string, message: MessageDto, direction: TrafficDirection, force = false) =>
    this.post<CallResult>(this.partner(partnerId, 'messages'), { message, direction, force });
  sendAcknowledgement = (partnerId: string, call: AcknowledgementCall, force = false) =>
    this.post<CallResult>(this.partner(partnerId, 'acknowledgements'), { ...call, force });
  sendResourceRequestAction = (partnerId: string, call: ResourceRequestActionCall, force = false) =>
    this.post<CallResult>(this.partner(partnerId, 'resource-requests'), { ...call, force });
  raw = (partnerId: string, request: RawRequest) => this.post<CallResult>(this.partner(partnerId, 'raw'), request);

  incidents = () => this.get<IncidentRecord[]>('incidents');
  clearIncidents = () => this.delete('incidents');
  traffic = () => this.get<TrafficEntry[]>('traffic');
  clearTraffic = () => this.delete('traffic');
}
