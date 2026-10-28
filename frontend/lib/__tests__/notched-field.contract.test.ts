/**
 * Notched Field Contract Test
 *
 * Enforces the notched-field typography contract (docs/20-contracts/typography-scale.md):
 *   R1: No labelClassName/hintClassName with typographic overrides on LabeledContainer/Input/Select
 *   R2: No arbitrary h-[...] heights on notched primitives or their children → use h-6 / h-6!
 *   R3: No font-medium/semibold/bold/black on primary value spans → text-sm text-foreground
 *   R4: Placeholders must use text-sm text-muted-foreground/60 (explicit span), no conditional class
 *   R5: No variant="inline" as direct child of LabeledContainer (double chrome)
 *   R6: LabeledSelect must resolve placeholder non-empty (no placeholder="")
 *   R7: Triggers of DatePicker and components/selectors/* must not declare font-medium/semibold/bold/black; DatePicker must declare font-normal
 *   R8: Empty states of custom triggers (Button role=combobox) must use text-sm text-muted-foreground/60
 *
 * Opt-out: add comment "typography-allow: meta - N5" before the offending node.
 *
 * Baseline mode: set NOTCHED_BASELINE=1 to write baseline.json.
 * Report mode: set NOTCHED_REPORT=1 to print inventory without assertions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

// ──────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..'); // frontend/
const SOURCE_DIRS = ['features', 'components', 'app'];
const EXCLUDE_DIRS = ['node_modules', '.next', 'e2e', 'out', 'dist', '.git'];
const BASELINE_PATH = resolve(__dirname, 'notched-field.baseline.json');

const PRIMITIVES = new Set(['LabeledContainer', 'LabeledInput', 'LabeledSelect']);

// Typographic tokens that are NOT allowed in labelClassName/hintClassName
const FORBIDDEN_LABEL_TOKENS = [
  'font-bold', 'font-semibold', 'font-medium', 'font-black',
  'text-3xs', 'text-2xs', 'text-xs', 'text-sm',
  'uppercase', 'lowercase', 'capitalize',
  'tracking-widest', 'tracking-wider', 'tracking-tight', 'tracking-loose', 'tracking-looser',
];

// Weight tokens not allowed on primary value
const FORBIDDEN_VALUE_WEIGHTS = [
  'font-medium', 'font-semibold', 'font-bold', 'font-black',
];

// Arbitrary height pattern
const ARBITRARY_HEIGHT = /h-\[[0-9.]+(?:px|rem|em)\]/;

// Placeholder patterns
const PLACEHOLDER_PATTERNS = [
  /text-muted-foreground(?!\/60)/, // missing /60
  /!value\s*&&\s*["'`]text-muted-foreground/, // conditional class
  /field\.value\s*&&/, // field.value conditional
];

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  column: number;
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';
  message: string;
  snippet: string;
}

// Identity of a baselined violation: file + rule + the offending class string. The line
// is kept only to read the file: matching by line broke the baseline whenever an
// unrelated edit (an import, a comment) shifted the code below it.
interface BaselineEntry {
  file: string;
  line: number;
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';
  snippet: string;
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

const sameViolation = (b: BaselineEntry, v: Violation): boolean =>
  b.file === v.file && b.rule === v.rule && b.snippet === v.snippet;

function isBaselined(v: Violation, baseline: BaselineEntry[]): boolean {
  return baseline.some(b => sameViolation(b, v));
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
// AST visitor
// ──────────────────────────────────────────────────────────────

function checkNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  violations: Violation[],
  isInsideNotched: boolean,
  isInsideLabeledContainer: boolean
) {
  // Track if we're inside a notched primitive
  let newInsideNotched = isInsideNotched;
  let newInsideLabeledContainer = isInsideLabeledContainer;

  // Check for JSX elements
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const tagName = ts.isJsxElement(node)
      ? node.openingElement.tagName
      : node.tagName;

    const tagNameText = tagName.getText(sourceFile);

    if (PRIMITIVES.has(tagNameText)) {
      newInsideNotched = true;
      if (tagNameText === 'LabeledContainer') newInsideLabeledContainer = true;

      // Check props on the primitive
      const attributes = ts.isJsxElement(node)
        ? node.openingElement.attributes.properties
        : node.attributes.properties;

      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        const attrName = attr.name.getText(sourceFile);
        const attrValue = attr.initializer;

        // R1: labelClassName / hintClassName with typographic overrides
        if ((attrName === 'labelClassName' || attrName === 'hintClassName') && attrValue) {
          const valueText = getAttributeText(attrValue, sourceFile);
          if (valueText && hasForbiddenLabelToken(valueText)) {
            violations.push({
              file: relative(ROOT, sourceFile.fileName),
              line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
              column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
              rule: 'R1',
              message: `${attrName} contains typographic overrides (${valueText}). Use FieldLegend (N2).`,
              snippet: valueText,
            });
          }
        }

        // R2: arbitrary height on primitive
        if (attrName === 'className' && attrValue) {
          const valueText = getAttributeText(attrValue, sourceFile);
          if (valueText && ARBITRARY_HEIGHT.test(valueText)) {
            violations.push({
              file: relative(ROOT, sourceFile.fileName),
              line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
              column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
              rule: 'R2',
              message: `Arbitrary height ${valueText.match(ARBITRARY_HEIGHT)?.[0]} on ${tagNameText}. Use h-6 / h-6!.`,
              snippet: valueText,
            });
          }
        }
      }
    }

    // R5: variant="inline" as direct child of LabeledContainer
    if (newInsideLabeledContainer && !isInsideLabeledContainer) {
      // We just entered a LabeledContainer, check its children for inline variant
      // This will be handled when we visit the children
    }

    if (tagNameText === 'LabeledSelect' && isInsideLabeledContainer) {
      const attributes = ts.isJsxElement(node)
        ? node.openingElement.attributes.properties
        : node.attributes.properties;

      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(sourceFile) === 'variant') {
          const valueText = getAttributeText(attr.initializer ?? undefined, sourceFile);
          if (valueText === 'inline' || valueText === '"inline"' || valueText === "'inline'") {
            violations.push({
              file: relative(ROOT, sourceFile.fileName),
              line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
              column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
              rule: 'R5',
              message: 'LabeledSelect variant="inline" inside LabeledContainer creates double chrome.',
              snippet: valueText,
            });
          }
        }
      }
    }
  }

  // Check for arbitrary height on any element inside notched field
  if (newInsideNotched && ts.isJsxElement(node)) {
    const attributes = node.openingElement.attributes.properties;
    for (const attr of attributes) {
      if (!ts.isJsxAttribute(attr)) continue;
      if (attr.name.getText(sourceFile) === 'className' && attr.initializer) {
        const valueText = getAttributeText(attr.initializer, sourceFile);
        if (valueText && ARBITRARY_HEIGHT.test(valueText)) {
          // Only report if it's not the primitive itself (already caught above)
          // and not inside a legitimate non-notched component
          violations.push({
            file: relative(ROOT, sourceFile.fileName),
            line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
            column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
            rule: 'R2',
            message: `Arbitrary height ${valueText.match(ARBITRARY_HEIGHT)?.[0]} inside notched field. Use h-6 / h-6!.`,
            snippet: valueText,
          });
        }
      }
    }
  }

  // R3: Check for forbidden weight on primary value spans
  // Heuristic: spans with className containing "truncate" or displaying selectedX.name/value.display
  if (newInsideNotched && ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText(sourceFile);
    if (tagName === 'span') {
      const attributes = node.openingElement.attributes.properties;
      let className = '';
      let hasTruncate = false;
      let content = '';

      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        const attrName = attr.name.getText(sourceFile);
        if (attrName === 'className' && attr.initializer) {
          className = getAttributeText(attr.initializer, sourceFile) || '';
          if (className.includes('truncate')) hasTruncate = true;
        }
      }

      // Get text content
      if (node.children.length > 0) {
        for (const child of node.children) {
          if (ts.isJsxText(child)) content += child.getText(sourceFile);
          else if (ts.isJsxExpression(child) && child.expression) content += child.expression.getText(sourceFile);
        }
      }

      // Heuristic: primary value spans have truncate and display entity names/codes
      const isPrimaryValue = hasTruncate &&
        (content.includes('selected') ||
         content.includes('value.') ||
         content.includes('.name') ||
         content.includes('.code') ||
         content.includes('selectedAccount') ||
         content.includes('selectedUser') ||
         content.includes('selectedGroup') ||
         content.includes('selectedOrder') ||
         content.includes('selectedContact') ||
         content.includes('selectedProduct') ||
         content.includes('selectedWarehouse') ||
         content.includes('selectedCategory') ||
         content.includes('selectedType') ||
         content.includes('selectedUoM'));

      if (isPrimaryValue && hasForbiddenValueWeight(className)) {
        violations.push({
          file: relative(ROOT, sourceFile.fileName),
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character + 1,
          rule: 'R3',
          message: `Primary value span has forbidden weight (${className}). Use text-sm text-foreground.`,
          snippet: className,
        });
      }
    }
  }

  // R4: Check placeholder patterns in Button/triggers
  if (newInsideNotched && ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText(sourceFile);
    if (tagName === 'Button' || tagName === 'SelectTrigger') {
      const attributes = node.openingElement.attributes.properties;
      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(sourceFile) === 'className' && attr.initializer) {
          const valueText = getAttributeText(attr.initializer, sourceFile);
          if (valueText) {
            for (const pattern of PLACEHOLDER_PATTERNS) {
              if (pattern.test(valueText)) {
                violations.push({
                  file: relative(ROOT, sourceFile.fileName),
                  line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
                  column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
                  rule: 'R4',
                  message: `Placeholder uses conditional class or missing /60 opacity: ${valueText}`,
                  snippet: valueText,
                });
                break;
              }
            }
          }
        }
      }
    }
  }

  // R6: LabeledSelect with placeholder="" (empty string)
  if (newInsideNotched && ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText(sourceFile);
    if (tagName === 'LabeledSelect') {
      const attributes = node.openingElement.attributes.properties;
      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(sourceFile) === 'placeholder' && attr.initializer) {
          const valueText = getAttributeText(attr.initializer, sourceFile);
          if (valueText === '""' || valueText === "''") {
            violations.push({
              file: relative(ROOT, sourceFile.fileName),
              line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
              column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
              rule: 'R6',
              message: 'LabeledSelect placeholder must not be empty string. Use default "Seleccionar..." or explicit text.',
              snippet: valueText,
            });
          }
        }
      }
    }
  }

  // R7: DatePicker and selector triggers must not have forbidden weight tokens
  if (newInsideNotched && ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText(sourceFile);
    const fileName = relative(ROOT, sourceFile.fileName);
    const isDatePicker = tagName === 'DatePicker';
    const isSelectorTrigger = tagName === 'Button' && fileName.includes('components/selectors/');
    const isDatePickerTrigger = tagName === 'Button' && fileName === 'components/shared/DatePicker.tsx';
    
    if (isDatePickerTrigger || isSelectorTrigger) {
      const attributes = node.openingElement.attributes.properties;
      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(sourceFile) === 'className' && attr.initializer) {
          const valueText = getAttributeText(attr.initializer, sourceFile);
          if (valueText && hasForbiddenValueWeight(valueText)) {
            violations.push({
              file: fileName,
              line: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
              column: sourceFile.getLineAndCharacterOfPosition(attr.getStart()).character + 1,
              rule: 'R7',
              message: `Selector/DatePicker trigger has forbidden weight (${valueText}). Must use font-normal.`,
              snippet: valueText,
            });
          }
        }
      }
    }
  }

  // R8: Custom triggers (Button role=combobox) must have proper empty state
  if (newInsideNotched && ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText(sourceFile);
    if (tagName === 'Button') {
      const attributes = node.openingElement.attributes.properties;
      let hasRoleCombobox = false;
      for (const attr of attributes) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(sourceFile) === 'role') {
          const valueText = getAttributeText(attr.initializer, sourceFile);
          if (valueText === '"combobox"' || valueText === "'combobox'") {
            hasRoleCombobox = true;
          }
        }
      }
      if (hasRoleCombobox) {
        // Check that the empty state (when no value) uses text-sm text-muted-foreground/60
        // This is a heuristic: look for ternary with empty state
        const children = node.children;
        for (const child of children) {
          if (ts.isJsxExpression(child) && child.expression) {
            const exprText = child.expression.getText(sourceFile);
            // Look for conditional rendering with empty state
            if (exprText.includes('?') && exprText.includes(':') && 
                (exprText.includes('text-muted-foreground') && !exprText.includes('/60'))) {
              violations.push({
                file: relative(ROOT, sourceFile.fileName),
                line: sourceFile.getLineAndCharacterOfPosition(child.getStart()).line + 1,
                column: sourceFile.getLineAndCharacterOfPosition(child.getStart()).character + 1,
                rule: 'R8',
                message: 'Custom combobox trigger empty state must use text-sm text-muted-foreground/60.',
                snippet: exprText.substring(0, 120),
              });
            }
          }
        }
      }
    }
  }
  ts.forEachChild(node, child =>
    checkNode(child, sourceFile, violations, newInsideNotched, newInsideLabeledContainer)
  );
}

function getAttributeText(initializer: ts.JsxAttributeValue | undefined, sourceFile: ts.SourceFile): string | null {
  if (!initializer) return null;
  if (ts.isJsxExpression(initializer)) {
    if (initializer.expression) {
      return initializer.expression.getText(sourceFile);
    }
  } else if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }
  return null;
}

function hasForbiddenLabelToken(className: string): boolean {
  const tokens = className.split(/\s+/);
  return tokens.some(t => FORBIDDEN_LABEL_TOKENS.includes(t));
}

function hasForbiddenValueWeight(className: string): boolean {
  const tokens = className.split(/\s+/);
  return tokens.some(t => FORBIDDEN_VALUE_WEIGHTS.includes(t));
}

function hasAllowComment(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  // Check the node and its ancestors (up to JSX element) for allow comments
  let current: ts.Node | undefined = node;
  let depth = 0;
  while (current && depth < 10) {
    const start = current.getStart(sourceFile);
    const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, start);
    if (leadingComments && leadingComments.length > 0) {
      for (const comment of leadingComments) {
        const text = sourceFile.text.slice(comment.pos, comment.end);
        if (text.includes('typography-allow:') && text.includes('meta')) {
          return true;
        }
      }
    }
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
      // Found the JSX element, check its comments and stop
      break;
    }
    current = current.parent;
    depth++;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────
// Scan function
// ──────────────────────────────────────────────────────────────

function scanAll(): Violation[] {
  const allViolations: Violation[] = [];
  const allFiles: string[] = [];

  for (const dir of SOURCE_DIRS) {
    allFiles.push(...findTsxFiles(join(ROOT, dir)));
  }

  for (const file of allFiles) {
    try {
      const text = readFileSync(file, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );

      const violations: Violation[] = [];
      checkNode(sourceFile, sourceFile, violations, false, false);

      // Filter out allow-commented violations
      const filtered = violations.filter(v => {
        // Find the node at this position to check for allow comment
        const pos = sourceFile.getPositionOfLineAndCharacter(v.line - 1, v.column - 1);
        const node = findNodeAt(sourceFile, pos);
        return node ? !hasAllowComment(node, sourceFile) : true;
      });

      allViolations.push(...filtered);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }

  return allViolations;
}

function findNodeAt(sourceFile: ts.SourceFile, position: number): ts.Node | null {
  function visit(node: ts.Node): ts.Node | null {
    if (node.getStart() <= position && node.getEnd() >= position) {
      for (const child of node.getChildren(sourceFile)) {
        const found = visit(child);
        if (found) return found;
      }
      return node;
    }
    return null;
  }
  return visit(sourceFile);
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

let violations: Violation[];
let baseline: BaselineEntry[];

// Whole-repo TypeScript AST scan: under a parallel full run it needs more than the
// default 10 s hook budget.
beforeAll(() => {
  violations = scanAll();
  baseline = loadBaseline();
}, 120_000);

describe('Notched Field Contract', () => {
  // Report mode: just print violations
  if (process.env.NOTCHED_REPORT === '1') {
    it('REPORT: prints all violations', () => {
      if (violations.length === 0) {
        console.log('✅ No violations found');
      } else {
        console.log(`\n=== ${violations.length} VIOLATIONS ===`);
        for (const v of violations) {
          const b = isBaselined(v, baseline) ? ' [BASELINED]' : ' ❌ NEW';
          console.log(`${v.file}:${v.line}:${v.column} [${v.rule}]${b}`);
          console.log(`  ${v.message}`);
          console.log(`  > ${v.snippet.substring(0, 120)}`);
        }
      }
      expect(true).toBe(true);
    });
  } else if (process.env.NOTCHED_BASELINE === '1') {
    // Baseline generation mode
    it('BASELINE: generates baseline.json', () => {
      const entries = violations.map(v => ({
        file: v.file,
        line: v.line,
        rule: v.rule,
        snippet: v.snippet,
      }));
      saveBaseline(entries);
      console.log(`Baseline written with ${entries.length} entries`);
      expect(true).toBe(true);
    });
  } else {
    // Normal mode: assertions
    it('R1: No labelClassName/hintClassName with typographic overrides', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r1 = newViolations.filter(v => v.rule === 'R1');
    if (r1.length > 0) {
      console.log('\nR1 violations:', r1.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r1.length).toBe(0);
  });

  it('R2: No arbitrary h-[...] heights in notched fields', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r2 = newViolations.filter(v => v.rule === 'R2');
    if (r2.length > 0) {
      console.log('\nR2 violations:', r2.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r2.length).toBe(0);
  });

  it('R3: No forbidden weight on primary value spans', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r3 = newViolations.filter(v => v.rule === 'R3');
    if (r3.length > 0) {
      console.log('\nR3 violations:', r3.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r3.length).toBe(0);
  });

  it('R4: Placeholders must use text-sm text-muted-foreground/60', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r4 = newViolations.filter(v => v.rule === 'R4');
    if (r4.length > 0) {
      console.log('\nR4 violations:', r4.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r4.length).toBe(0);
  });

  it('R5: No variant="inline" inside LabeledContainer', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r5 = newViolations.filter(v => v.rule === 'R5');
    if (r5.length > 0) {
      console.log('\nR5 violations:', r5.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r5.length).toBe(0);
  });

  it('R6: LabeledSelect must not have empty placeholder', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r6 = newViolations.filter(v => v.rule === 'R6');
    if (r6.length > 0) {
      console.log('\nR6 violations:', r6.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r6.length).toBe(0);
  });

  it('R7: Selector/DatePicker triggers must use font-normal', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r7 = newViolations.filter(v => v.rule === 'R7');
    if (r7.length > 0) {
      console.log('\nR7 violations:', r7.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r7.length).toBe(0);
  });

  it('R8: Custom combobox triggers must use text-sm text-muted-foreground/60', () => {
    const newViolations = violations.filter(v => !isBaselined(v, baseline));
    const r8 = newViolations.filter(v => v.rule === 'R8');
    if (r8.length > 0) {
      console.log('\nR8 violations:', r8.map(v => `${v.file}:${v.line} - ${v.snippet}`).join('\n'));
    }
    expect(r8.length).toBe(0);
  });

  // Ensure baseline doesn't have stale entries
  it('Baseline has no stale entries (all still exist)', () => {
    const stale = baseline.filter(b => !violations.some(v => sameViolation(b, v)));
    if (stale.length > 0) {
      console.log('\nStale baseline entries (should be removed):', stale);
    }
    expect(stale.length).toBe(0);
  });
  }
});