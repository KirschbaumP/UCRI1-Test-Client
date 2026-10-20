import { Component, computed, input } from '@angular/core';

/** Formatierte JSON-Ausgabe. */
@Component({
  selector: 'app-json-view',
  template: `<pre class="json" [style.max-height]="maxHeight()">{{ text() }}</pre>`,
  styles: `
    .json {
      margin: 0;
      padding: 8px 12px;
      background: var(--json-bg, #f6f8fa);
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `,
})
export class JsonViewComponent {
  readonly value = input<unknown>();
  readonly maxHeight = input('400px');

  readonly text = computed(() => {
    const v = this.value();
    if (v === undefined) return '–';
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  });
}
