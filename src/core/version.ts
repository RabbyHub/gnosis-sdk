/**
 * Safe versions are plain `MAJOR.MINOR.PATCH`, sometimes with build metadata
 * (`1.3.0+L2`). That is the whole grammar this SDK needs, so it compares them
 * directly rather than pulling in a semver implementation.
 */
export interface SafeVersionParts {
  major: number;
  minor: number;
  patch: number;
}

export function parseSafeVersion(version: string): SafeVersionParts {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    throw new Error(`Unrecognized Safe version: "${version}"`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** Negative if a < b, 0 if equal, positive if a > b. Build metadata is ignored. */
export function compareSafeVersion(a: string, b: string): number {
  const left = parseSafeVersion(a);
  const right = parseSafeVersion(b);
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}

export function isAtLeastVersion(version: string, target: string): boolean {
  return compareSafeVersion(version, target) >= 0;
}
