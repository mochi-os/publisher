// Compare two version strings semantically (e.g., "1.2" vs "1.13")
// Returns negative if a < b, positive if a > b, 0 if equal
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((p) => parseInt(p, 10) || 0)
  const partsB = b.split('.').map((p) => parseInt(p, 10) || 0)

  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (numA !== numB) {
      return numA - numB
    }
  }
  return 0
}

// Sort versions in descending order (newest first)
export function sortVersionsDesc<T extends { version: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => compareVersions(b.version, a.version))
}
