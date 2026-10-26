/**
 * Selector Defaults Contract Test
 *
 * Enforces the "placeholder-first" policy for selector-backed fields
 * (docs/20-contracts/component-selectors.md):
 *
 *   D1: A field rendered by a selector must NOT arrive pre-selected through
 *       form defaultValues → the selector shows "Seleccionar..." and the user
 *       chooses explicitly.
 *   D2: The same applies to `mapData` fallbacks (`|| "ORDINARIA_22"`): a
 *       missing/invalid stored value must map to "" (empty), never to a
 *       silent default option.
 *
 * The rule is generic: it detects every form field bound to a selector
 * component (LabeledSelect / *Selector) in ANY consumer, not a hand-picked
 * list of drawers.
 *
 * Technical / configuration defaults (currency, accounting flags, ...) are
 * NOT user choices — they are allowlisted below with a documented reason.
 *
 * Baseline mode: set SELECTOR_DEFAULTS_BASELINE=1 to write the baseline.
 * Report mode: set SELECTOR_DEFAULTS_REPORT=1 to print the inventory.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..'); // frontend/
const SOURCE_DIRS = ['features', 'components', 'app'];
const EXCLUDE_DIRS = ['node_modules', '.next', 'e2e', 'out', 'dist', '.git'];
const BASELINE_PATH = resolve(__dirname, 'selector-defaults.baseline.json');

/**
 * Fields whose pre-selected default is a technical/configuration value, not a
 * user choice. Keep this list short and justify every entry.
 *
 * A key may be scoped to a single file with "<path>::<field>".
 */
const ALLOWED_PRE_SELECTED: Record<string, string> = {
  currency: 'Moneda del documento — default técnico, no es una elección del usuario',
  account_type: 'Tipo de cuenta contable — default técnico de la cuenta',
  amortization_system: 'Método de amortización — default técnico del activo',
  inventory_valuation_method: 'Método de valuación — default técnico del producto',
  rate_basis: 'Base de cálculo de tasas — default técnico',
  price_inheritance_mode: 'Modo de herencia de precios — default técnico',
  rule_type: 'Tipo de regla — default técnico del motor de reglas',
  operator: 'Operador de regla — default técnico del motor de reglas',
  'features/inventory/components/CategoryDrawer.tsx::parent':
    '"none" es el centinela de "sin padre" (categoría raíz), no una elección de negocio',
  'features/inventory/components/CategoryDrawer.tsx::asset_account':
    '"none" es el centinela de "sin cuenta contable" (se traduce a null en el payload)',
  'features/inventory/components/CategoryDrawer.tsx::income_account':
    '"none" es el centinela de "sin cuenta contable" (se traduce a null en el payload)',
  'features/inventory/components/CategoryDrawer.tsx::expense_account':
    '"none" es el centinela de "sin cuenta contable" (se traduce a null en el payload)',
  'features/treasury/components/PaymentFormDrawer.tsx::payment_type':
    'Dirección del movimiento (ingreso/egreso) — default técnico del flujo de pagos; el formulario se construye sobre él',
};

/** Selector-ish components: a field bound to one of these must start empty. */
const SELECTOR_TAG_PATTERN = /^(LabeledSelect|.*Selector)$/;

interface Violation {
  file: string;
  line: number;
  rule: 'D1' | 'D2';
  field: string;
  message: string;
  snippet: string;
}

interface BaselineEntry {
  file: string;
  line: number;
  rule: 'D1' | 'D2';
  field: string;
}

// ──────────────────────────────────────────────────────────────
// Baseline handling
// ──────────────────────────────────────────────────────────────

function loadBaseline(): BaselineEntry[] {
  if (!existsSync(BASELINE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BaselineEntry[];
  } catch {
    return [];
  }
}

function saveBaseline(entries: BaselineEntry[]) {
  const sorted = [...entries].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.rule.localeCompare(b.rule);
  });
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2));
}

function isBaselined(v: Violation, baseline: BaselineEntry[]): boolean {
  return baseline.some(b =>
    b.file === v.file && b.line === v.line && b.rule === v.rule && b.field === v.field
  );
}

// ──────────────────────────────────────────────────────────────
// File discovery
// ──────────────────────────────────────────────────────────────

function findTsxFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...findTsxFiles(full));
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx') && !entry.endsWith('.spec.tsx')) {
      files.push(full);
    }
  }
  return files;
}

// ──────────────────────────────────────────────────────────────
// AST helpers
// ──────────────────────────────────────────────────────────────

function getAttributeText(initializer: ts.JsxAttributeValue | undefined, sourceFile: ts.SourceFile): string | null {
  if (!initializer) return null;
  if (ts.isJsxExpression(initializer)) {
    if (initializer.expression) return initializer.expression.getText(sourceFile);
  } else if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }
  return null;
}

function getJsxAttributes(node: ts.JsxElement | ts.JsxSelfClosingElement): readonly ts.JsxAttribute[] {
  const props = ts.isJsxElement(node) ? node.openingElement.attributes.properties : node.attributes.properties;
  return props.filter(ts.isJsxAttribute);
}

function getAttribute(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): ts.JsxAttribute | undefined {
  return getJsxAttributes(node).find(a => a.name.getText() === name);
}

function isEmptyStringLiteral(text: string | null): boolean {
  return text === '""' || text === "''";
}

/** Collects the text of a string-literal-ish expression node. */
function literalValue(node: ts.Node | undefined, sourceFile: ts.SourceFile): { value: string; nonEmpty: boolean } | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { value: node.text, nonEmpty: node.text.length > 0 };
  }
  if (ts.isAsExpression(node)) {
    return literalValue(node.expression, sourceFile);
  }
  return null;
}

/** Finds object literal properties named `name` inside a node subtree. */
function findPropertyAssignments(node: ts.Node, name: string): ts.PropertyAssignment[] {
  const found: ts.PropertyAssignment[] = [];
  function visit(child: ts.Node) {
    if (ts.isPropertyAssignment(child)) {
      const propName = child.name;
      const text = ts.isIdentifier(propName) || ts.isStringLiteral(propName) ? propName.text : undefined;
      if (text === name) found.push(child);
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

/** Returns the object literal returned by an arrow function / function expression. */
function returnedObjectLiteral(fn: ts.ArrowFunction | ts.FunctionExpression): ts.ObjectLiteralExpression | null {
  const body = fn.body;
  if (ts.isParenthesizedExpression(body)) {
    return ts.isObjectLiteralExpression(body.expression) ? body.expression : null;
  }
  if (ts.isObjectLiteralExpression(body)) return body;
  if (ts.isBlock(body)) {
    const ret = body.statements.find(ts.isReturnStatement);
    if (ret?.expression && ts.isObjectLiteralExpression(ret.expression)) return ret.expression;
  }
  return null;
}

/**
 * Collects non-empty string literals used as fallback of a `||` / `??`
 * expression — i.e. silent defaults that pre-select an option.
 */
function collectStringFallbacks(node: ts.Node, sourceFile: ts.SourceFile): string[] {
  const found: string[] = [];
  function visit(child: ts.Node) {
    if (ts.isBinaryExpression(child)) {
      const isFallback =
        child.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        child.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
      if (isFallback) {
        const literal = literalValue(child.right, sourceFile);
        if (literal && literal.nonEmpty) found.push(literal.value);
      }
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

/** Allowlist lookup: file-scoped entries win over global ones. */
function isAllowedPreSelected(relFile: string, field: string): boolean {
  return Boolean(ALLOWED_PRE_SELECTED[`${relFile}::${field}`] ?? ALLOWED_PRE_SELECTED[field]);
}

// ──────────────────────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────────────────────

/**
 * Collects the form fields that are rendered by a selector component.
 * Handles react-hook-form's <FormField name="x" render={({field}) => <XSelector value={field.value} />} />
 * and <Controller name="x" render={({field}) => ...} />.
 */
function collectSelectorBoundFields(sourceFile: ts.SourceFile): Map<string, number> {
  const fields = new Map<string, number>();

  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const tag = (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText(sourceFile);
      const nameAttr = getAttribute(node, 'name');
      const renderAttr = getAttribute(node, 'render');

      if (nameAttr?.initializer && renderAttr?.initializer) {
        const nameValue = getAttributeText(nameAttr.initializer, sourceFile);
        const name = nameValue?.replace(/^["']|["']$/g, '');

        if (name) {
          // Does the render callback contain a selector element bound to field.value?
          let hasSelector = false;
          function scanRender(child: ts.Node) {
            if (ts.isJsxSelfClosingElement(child) || ts.isJsxElement(child)) {
              const childTag = (ts.isJsxElement(child) ? child.openingElement.tagName : child.tagName).getText(sourceFile);
              if (SELECTOR_TAG_PATTERN.test(childTag)) {
                const valueAttr = getAttribute(child, 'value');
                const valueText = valueAttr ? getAttributeText(valueAttr.initializer, sourceFile) : null;
                if (valueText && valueText.includes('field.value')) {
                  hasSelector = true;
                }
              }
            }
            ts.forEachChild(child, scanRender);
          }
          scanRender(renderAttr.initializer);

          if (hasSelector && !fields.has(name)) {
            fields.set(name, sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return fields;
}

/** Extracts the `defaultValues` object literals of a file (useForm + useInitializeDrawerForm). */
function collectDefaultValueObjects(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression[] {
  const objects: ts.ObjectLiteralExpression[] = [];

  for (const prop of findPropertyAssignments(sourceFile, 'defaultValues')) {
    let value: ts.Node = prop.initializer;
    // unwrap () => ({...})
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
      const body = value.body;
      if (ts.isParenthesizedExpression(body)) value = body.expression;
      else if (ts.isBlock(body)) {
        const ret = body.statements.find(ts.isReturnStatement);
        if (ret?.expression) value = ret.expression;
      } else value = body;
    }
    if (ts.isObjectLiteralExpression(value)) objects.push(value);
  }

  return objects;
}

function scanFile(file: string): Violation[] {
  const violations: Violation[] = [];
  const relFile = relative(ROOT, file);
  const text = readFileSync(file, 'utf-8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const selectorFields = collectSelectorBoundFields(sourceFile);
  if (selectorFields.size === 0) return violations;

  const defaultObjects = collectDefaultValueObjects(sourceFile);

  // D1: pre-selected defaults for selector-backed fields
  for (const obj of defaultObjects) {
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const propName = prop.name;
      const fieldName = ts.isIdentifier(propName) || ts.isStringLiteral(propName) ? propName.text : undefined;
      if (!fieldName || !selectorFields.has(fieldName)) continue;
      if (isAllowedPreSelected(relFile, fieldName)) continue;

      const literal = literalValue(prop.initializer, sourceFile);
      if (literal && literal.nonEmpty) {
        violations.push({
          file: relFile,
          line: sourceFile.getLineAndCharacterOfPosition(prop.getStart()).line + 1,
          rule: 'D1',
          field: fieldName,
          message: `Selector field "${fieldName}" is pre-selected ("${literal.value}"). Start empty so the selector shows "Seleccionar...".`,
          snippet: literal.value,
        });
      }
    }
  }

  // D2: mapData fallbacks that silently pick an option
  for (const mapProp of findPropertyAssignments(sourceFile, 'mapData')) {
    const init = mapProp.initializer;
    if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) continue;

    const returned = returnedObjectLiteral(init);
    if (!returned) continue;

    for (const prop of returned.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const propName = prop.name;
      const fieldName = ts.isIdentifier(propName) || ts.isStringLiteral(propName) ? propName.text : undefined;
      if (!fieldName || !selectorFields.has(fieldName)) continue;
      if (isAllowedPreSelected(relFile, fieldName)) continue;

      const fallbacks = collectStringFallbacks(prop.initializer, sourceFile);
      if (fallbacks.length > 0) {
        violations.push({
          file: relFile,
          line: sourceFile.getLineAndCharacterOfPosition(prop.getStart()).line + 1,
          rule: 'D2',
          field: fieldName,
          message: `mapData silently defaults "${fieldName}" to "${fallbacks[0]}". Map to "" so the selector stays empty.`,
          snippet: fallbacks[0],
        });
      }
    }
  }

  return violations;
}

function scanAll(): Violation[] {
  const all: Violation[] = [];
  const files: string[] = [];
  for (const dir of SOURCE_DIRS) {
    files.push(...findTsxFiles(join(ROOT, dir)));
  }
  for (const file of files) {
    try {
      all.push(...scanFile(file));
    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }
  return all;
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

let violations: Violation[];
let baseline: BaselineEntry[];

beforeAll(() => {
  violations = scanAll();
  baseline = loadBaseline();
});

describe('Selector Defaults Contract', () => {
  if (process.env.SELECTOR_DEFAULTS_REPORT === '1') {
    it('REPORT: prints all violations', () => {
      if (violations.length === 0) {
        console.log('✅ No violations found');
      } else {
        console.log(`\n=== ${violations.length} VIOLATIONS ===`);
        for (const v of violations) {
          const b = isBaselined(v, baseline) ? ' [BASELINED]' : ' ❌ NEW';
          console.log(`${v.file}:${v.line} [${v.rule}]${b} — ${v.message}`);
        }
      }
      expect(true).toBe(true);
    });
  } else if (process.env.SELECTOR_DEFAULTS_BASELINE === '1') {
    it('BASELINE: generates selector-defaults.baseline.json', () => {
      const entries = violations.map(v => ({
        file: v.file,
        line: v.line,
        rule: v.rule,
        field: v.field,
      }));
      saveBaseline(entries);
      console.log(`Baseline written with ${entries.length} entries`);
      expect(true).toBe(true);
    });
  } else {
    it('D1: Selector-backed fields must not be pre-selected via defaultValues', () => {
      const newViolations = violations.filter(v => !isBaselined(v, baseline));
      const d1 = newViolations.filter(v => v.rule === 'D1');
      if (d1.length > 0) {
        console.log('\nD1 violations:', d1.map(v => `${v.file}:${v.line} (${v.field}) — ${v.snippet}`).join('\n'));
      }
      expect(d1.length).toBe(0);
    });

    it('D2: mapData must not silently default a selector field', () => {
      const newViolations = violations.filter(v => !isBaselined(v, baseline));
      const d2 = newViolations.filter(v => v.rule === 'D2');
      if (d2.length > 0) {
        console.log('\nD2 violations:', d2.map(v => `${v.file}:${v.line} (${v.field}) — ${v.snippet}`).join('\n'));
      }
      expect(d2.length).toBe(0);
    });

    it('Baseline has no stale entries (all still exist)', () => {
      const stale = baseline.filter(b =>
        !violations.some(v => v.file === b.file && v.line === b.line && v.rule === b.rule && v.field === b.field)
      );
      if (stale.length > 0) {
        console.log('\nStale baseline entries (should be removed):', stale);
      }
      expect(stale.length).toBe(0);
    });
  }
});
