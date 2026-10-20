export const UCRI_VERSIONS = ['1.0', '1.1'] as const;

export type UcriVersion = (typeof UCRI_VERSIONS)[number];

export function isUcriVersion(value: unknown): value is UcriVersion {
  return typeof value === 'string' && (UCRI_VERSIONS as readonly string[]).includes(value);
}

/** true, wenn `since` in der Version `active` bereits definiert ist. */
export function isAvailableIn(since: UcriVersion, active: UcriVersion): boolean {
  return UCRI_VERSIONS.indexOf(since) <= UCRI_VERSIONS.indexOf(active);
}
