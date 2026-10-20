import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'connection' },
  {
    path: 'connection',
    title: 'Verbindung',
    loadComponent: () => import('./pages/connection.page').then((m) => m.ConnectionPage),
  },
  {
    path: 'send',
    title: 'Einsatz senden',
    loadComponent: () => import('./pages/send-incident.page').then((m) => m.SendIncidentPage),
  },
  {
    path: 'incidents',
    title: 'Einsätze',
    loadComponent: () => import('./pages/incidents.page').then((m) => m.IncidentsPage),
  },
  {
    path: 'messages',
    title: 'Nachrichten',
    loadComponent: () => import('./pages/messages.page').then((m) => m.MessagesPage),
  },
  {
    path: 'master-data',
    title: 'Stammdaten',
    loadComponent: () => import('./pages/master-data.page').then((m) => m.MasterDataPage),
  },
  {
    path: 'traffic',
    title: 'Traffic-Log',
    loadComponent: () => import('./pages/traffic.page').then((m) => m.TrafficPage),
  },
  {
    path: 'raw',
    title: 'Freier Request',
    loadComponent: () => import('./pages/raw-request.page').then((m) => m.RawRequestPage),
  },
  {
    path: 'catalog',
    title: 'Appendix-Katalog',
    loadComponent: () => import('./pages/catalog.page').then((m) => m.CatalogPage),
  },
  { path: '**', redirectTo: 'connection' },
];
