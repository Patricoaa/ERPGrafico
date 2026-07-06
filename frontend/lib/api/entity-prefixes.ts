const API_ENDPOINT = '/api/core/entity-prefixes/';

const DTE_LABELS: Record<string, string> = {
  FACTURA: 'Factura',
  FACTURA_EXENTA: 'Factura Exenta',
  BOLETA: 'Boleta',
  BOLETA_EXENTA: 'Boleta Exenta',
  PURCHASE_INV: 'Factura de Compra',
  NOTA_CREDITO: 'Nota de Crédito',
  NOTA_DEBITO: 'Nota de Débito',
  GUIA_DESPACHO: 'Guía de Despacho',
  NONE: 'Sin Documento',
};

const FALLBACK_MAP: Record<string, string> = {
  FACTURA: 'FACV',
  FACTURA_EXENTA: 'FAC-EX',
  BOLETA: 'BOL',
  BOLETA_EXENTA: 'BE',
  PURCHASE_INV: 'FACC',
  NOTA_CREDITO: 'NC',
  NOTA_DEBITO: 'ND',
  GUIA_DESPACHO: 'GUI',
  NONE: 'SD',
};

let cachedPrefixes: Record<string, string> | null = null;

export async function fetchEntityPrefixes(): Promise<Record<string, string>> {
  try {
    const res = await fetch(API_ENDPOINT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, string>;
    cachedPrefixes = data;
    return data;
  } catch {
    return FALLBACK_MAP;
  }
}

export function getDtePrefix(dteType?: string | null): string {
  if (!dteType) return 'DOC';
  if (cachedPrefixes?.[dteType]) return cachedPrefixes[dteType];
  return FALLBACK_MAP[dteType] ?? 'DOC';
}

export function getDteLabel(dteType?: string | null): string {
  if (!dteType) return 'Documento';
  return DTE_LABELS[dteType] ?? dteType;
}
