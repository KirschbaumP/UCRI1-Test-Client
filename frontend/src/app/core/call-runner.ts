import { HttpErrorResponse } from '@angular/common/http';
import { inject, signal } from '@angular/core';
import { CallResult } from '@ucri/shared';
import { NzMessageService } from 'ng-zorro-antd/message';

/** Kapselt Lade-Zustand, Ergebnis und Fehlermeldungen eines ausgehenden Aufrufs. Im Injection-Context erzeugen. */
export function createCallRunner() {
  const message = inject(NzMessageService);
  const loading = signal(false);
  const result = signal<CallResult | null>(null);

  async function run<T extends CallResult>(fn: () => Promise<T>, successText?: string): Promise<T | undefined> {
    loading.set(true);
    try {
      const r = await fn();
      result.set(r);
      if (r.ok && successText) message.success(successText);
      if (!r.ok) message.error(r.error ?? 'Aufruf fehlgeschlagen');
      return r;
    } catch (e) {
      const text =
        e instanceof HttpErrorResponse
          ? `${e.status} ${(e.error as { message?: string } | null)?.message ?? e.message}`
          : (e as Error).message;
      message.error(text);
      return undefined;
    } finally {
      loading.set(false);
    }
  }

  return { loading, result, run };
}
