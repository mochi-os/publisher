import { compareVersions } from '@mochi/common'

// Sort versions in descending order (newest first)
export function sortVersionsDesc<T extends { version: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => compareVersions(b.version, a.version))
}
