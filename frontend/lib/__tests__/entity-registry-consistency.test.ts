/**
 * Entity Registry consistency contract test.
 *
 * Reads entity-registry.ts and entity-drawers.tsx as text and enforces:
 *  - every label in ENTITY_DRAWERS has a matching entry in ENTITY_REGISTRY
 *  - every label is in canonical app.model format
 *
 * Pure text parsing — no app imports — so it stays fast and avoids Vite dependency
 * optimizer issues (file watcher limits, dynamic next/dynamic imports).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const registrySrc = readFileSync(path.resolve(here, '../entity-registry.ts'), 'utf8');
const drawersSrc = readFileSync(path.resolve(here, '../entity-drawers.tsx'), 'utf8');

/**
 * Extract all key strings from an ENTITY_DRAWERS record definition.
 * Matches `"app.model": ({ ... }) =>` patterns.
 */
function extractDrawerKeys(src: string): string[] {
  const re = /"([a-z]+\.[a-z]+)":\s*\(/g;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    keys.push(m[1]);
  }
  return keys.sort();
}

/**
 * Extract all key strings from an ENTITY_REGISTRY record definition.
 * Matches `'app.model': {` patterns.
 */
function extractRegistryKeys(src: string): string[] {
  const re = /'([a-z]+\.[a-z]+)':\s*\{/g;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    keys.push(m[1]);
  }
  return keys.sort();
}

describe('entity registry consistency', () => {
  const drawerLabels = extractDrawerKeys(drawersSrc);
  const registryLabels = extractRegistryKeys(registrySrc);

  it('every ENTITY_DRAWERS key has a matching ENTITY_REGISTRY entry', () => {
    const missing = drawerLabels.filter((l) => !registryLabels.includes(l));
    if (missing.length > 0) {
      console.log('Missing from ENTITY_REGISTRY:', missing);
    }
    expect(missing).toEqual([]);
  });

  it('every ENTITY_DRAWERS key is in canonical app.model format', () => {
    for (const label of drawerLabels) {
      expect(label).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it('every ENTITY_REGISTRY key is in canonical app.model format', () => {
    for (const label of registryLabels) {
      expect(label).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it('registers at least one entity', () => {
    expect(registryLabels.length).toBeGreaterThan(0);
    expect(drawerLabels.length).toBeGreaterThan(0);
  });
});
