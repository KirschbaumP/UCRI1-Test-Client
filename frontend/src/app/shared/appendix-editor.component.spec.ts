import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppendixDto, AppendixScope, getAppendixCatalog, UcriVersion } from '@ucri/shared';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { AppConfigService } from '../core/app-config.service';
import { AppendixEditorComponent } from './appendix-editor.component';

class FakeAppConfig {
  readonly version = signal<UcriVersion>('1.1');
  readonly catalog = computed(() => getAppendixCatalog(this.version()));
  catalogFor(scope: AppendixScope) {
    return this.catalog().filter((d) => d.scope === scope);
  }
}

@Component({
  imports: [AppendixEditorComponent],
  template: `<app-appendix-editor [scope]="scope" [appendices]="appendices" (changed)="changes = changes + 1" />`,
})
class HostComponent {
  scope: AppendixScope = 'incident';
  appendices: AppendixDto[] = [];
  changes = 0;
}

describe('AppendixEditorComponent', () => {
  let config: FakeAppConfig;

  function setup(version: UcriVersion, scope: AppendixScope, appendices: AppendixDto[] = []) {
    config = new FakeAppConfig();
    config.version.set(version);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: AppConfigService, useValue: config }, provideNzIcons([])],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.scope = scope;
    fixture.componentInstance.appendices = appendices;
    fixture.detectChanges();
    const editor = fixture.debugElement.children[0].componentInstance as AppendixEditorComponent;
    return { fixture, editor, host: fixture.componentInstance };
  }

  it('schlägt in UCRI 1.0 keine erst in 1.1 definierten Keys vor', () => {
    const { editor } = setup('1.0', 'incident');
    const keys = editor.suggestions('').map((d) => d.key);
    expect(keys).toContain('IncidentId');
    expect(keys).not.toContain('SharedIncidentId');
    expect(keys).not.toContain('IncidentDispatcherName');
  });

  it('schlägt in UCRI 1.1 die neuen Keys vor', () => {
    const { editor } = setup('1.1', 'incident');
    expect(editor.suggestions('dispatcher').map((d) => d.key)).toEqual([
      'IncidentDispatcherID',
      'IncidentDispatcherName',
      'IncidentDispatcherReach',
      'SentByDispatcherAt',
    ]);
  });

  it('bietet Confirmation-Appendices nur in 1.1 an', () => {
    expect(setup('1.0', 'confirmation').editor.suggestions('')).toHaveLength(0);
    TestBed.resetTestingModule();
    expect(setup('1.1', 'confirmation').editor.suggestions('').length).toBeGreaterThan(0);
  });

  it('ergänzt fehlende Pflicht-Appendices', () => {
    const { editor, host, fixture } = setup('1.1', 'resource', [{ key: 'Type', value: 'RTW' }]);
    expect(editor.missingRequired().map((d) => d.key)).toEqual(['RadioCallSign']);
    editor.addRequired();
    fixture.detectChanges();
    expect(host.appendices.map((a) => a.key)).toEqual(['Type', 'RadioCallSign']);
    expect(host.changes).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('markiert 1.1-Keys, wenn 1.0 aktiv ist', () => {
    const { fixture } = setup('1.0', 'patient', [{ key: 'PatientAge', value: '42' }]);
    expect(fixture.nativeElement.textContent).toContain('erst ab 1.1');
  });
});
