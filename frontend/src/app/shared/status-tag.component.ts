import { Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';

/** HTTP-Statuscode als farbiger Tag. */
@Component({
  selector: 'app-status-tag',
  imports: [NzTagModule],
  template: `<nz-tag [nzColor]="color()">{{ status() ?? (error() ? 'Fehler' : '…') }}</nz-tag>`,
})
export class StatusTagComponent {
  readonly status = input<number | undefined>();
  readonly error = input<string | undefined>();

  readonly color = computed(() => {
    const s = this.status();
    if (s === undefined) return this.error() ? 'red' : 'default';
    if (s === 304) return 'cyan';
    if (s < 300) return 'green';
    if (s < 500) return 'orange';
    return 'red';
  });
}
