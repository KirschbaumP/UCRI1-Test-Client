import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AppConfigView, AppendixDefinition, AppendixScope, CatalogView, PartnerView } from '@ucri/shared';
import { UiApiService } from './ui-api.service';

const PARTNER_STORAGE_KEY = 'ucri.selectedPartner';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Konfiguration des Backends (u.a. die beim Start gewählte UCRI-Version)
 * und der aktuell ausgewählte Partner.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly api = inject(UiApiService);

  private readonly configState = signal<AppConfigView | null>(null);
  private readonly catalogState = signal<CatalogView | null>(null);
  readonly selectedPartnerId = signal<string | null>(readStorage(PARTNER_STORAGE_KEY));

  readonly config = computed(() => {
    const c = this.configState();
    if (!c) throw new Error('Konfiguration noch nicht geladen');
    return c;
  });
  readonly version = computed(() => this.config().ucriVersion);
  readonly partners = computed(() => this.config().partners);
  readonly catalog = computed(() => this.catalogState()?.appendices ?? []);
  readonly selectedPartner = computed<PartnerView | undefined>(() =>
    this.partners().find((p) => p.id === this.selectedPartnerId()),
  );

  constructor() {
    effect(() => {
      const id = this.selectedPartnerId();
      try {
        if (id) localStorage.setItem(PARTNER_STORAGE_KEY, id);
      } catch {
        /* Speicher nicht verfügbar */
      }
    });
  }

  async load(): Promise<void> {
    const [config, catalog] = await Promise.all([this.api.config(), this.api.catalog()]);
    this.configState.set(config);
    this.catalogState.set(catalog);
    if (!config.partners.some((p) => p.id === this.selectedPartnerId())) {
      this.selectedPartnerId.set(config.partners[0]?.id ?? null);
    }
  }

  catalogFor(scope: AppendixScope): AppendixDefinition[] {
    return this.catalog().filter((d) => d.scope === scope);
  }
}
