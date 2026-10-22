/**
 * Selector Typography Contract Test
 *
 * Enforces the selector typography + placeholder policy
 * (docs/20-contracts/component-selectors.md, docs/20-contracts/typography-scale.md):
 *
 *   R9:  Selectors must not hand-roll a combobox trigger — they use the
 *        shared `SelectorTrigger` primitive (single source of truth).
 *   R10: Every placeholder rendered by a selector uses the canonical token
 *        `text-sm text-muted-foreground/60 font-normal` and no other size.
 *   R11: Every selector defaults its placeholder to "Seleccionar...".
 *   R12: The shared selector constants are canonical.
 *
 * Scope: ALL files under components/selectors/** (plus the shared selector
 * primitives). The notched-field detector only reaches files that contain
 * notched primitives, so this test exists to verify EVERY selector.
 *
 * Opt-out: add the comment "selector-allow: <reason>" on the line before the
 * offending node.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..'); // frontend/

const SELECTORS_DIR = join(ROOT, 'components/selectors');
const SHARED_FILES = [
  join(ROOT, 'components/shared/SelectorTrigger.tsx'),
  join(ROOT, 'components/shared/LabeledSelect.tsx'),
];

const EXCLUDE_DIRS = ['node_modules', '.next', 'e2e', 'out', 'dist', '.git'];

/** Canonical placeholder token (N3). */
const CANONICAL_PLACEHOLDER = ['text-sm', 'text-muted-foreground/60', 'font-normal'];
/** Size tokens that are NOT allowed on a placeholder. */
const FORBIDDEN_PLACEHOLDER_SIZES = ['text-xs', 'text-2xs', 'text-3xs', 'text-base', 'text-lg', 'text-xl'];

interface Violation {
  file: string;
  line: number;
  rule: 'R9' | 'R10' | 'R11' | 'R12';
  message: string;
  snippet: string;
}

// ──────────────────────────────────────────────────────────────
// Helpers
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

function getAttributeText(initializer: ts.JsxAttributeValue | undefined, sourceFile: ts.SourceFile): string | null {
  if (!initializer) return null;
  if (ts.isJsxExpression(initializer)) {
    if (initializer.expression) return initializer.expression.getText(sourceFile);
  } else if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }
  return null;
}

function getAttributes(node: ts.JsxElement | ts.JsxSelfClosingElement): readonly ts.JsxAttribute[] {
  const props = ts.isJsxElement(node) ? node.openingElement.attributes.properties : node.attributes.properties;
  return props.filter(ts.isJsxAttribute);
}

function getAttribute(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): ts.JsxAttribute | undefined {
  return getAttributes(node).find(a => a.name.getText() === name);
}

function textContent(node: ts.Node): string {
  // Only JSX children — attributes (e.g. className expressions) are not content.
  const children = ts.isJsxElement(node) ? node.children : [];
  let content = '';
  for (const child of children) {
    if (ts.isJsxText(child)) content += child.getText();
    else if (ts.isJsxExpression(child) && child.expression) content += child.expression.getText();
    else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) content += textContent(child);
  }
  return content;
}

function hasAllowComment(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  const start = node.getStart(sourceFile);
  const comments = ts.getLeadingCommentRanges(sourceFile.text, start);
  if (!comments) return false;
  return comments.some(c => sourceFile.text.slice(c.pos, c.end).includes('selector-allow:'));
}

// ──────────────────────────────────────────────────────────────
// Scans
// ──────────────────────────────────────────────────────────────

function scanFile(file: string): Violation[] {
  const violations: Violation[] = [];
  const relFile = relative(ROOT, file);
  const text = readFileSync(file, 'utf-8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText(sourceFile);
      const classAttr = getAttribute(node, 'className');
      const classText = classAttr ? getAttributeText(classAttr.initializer, sourceFile) : null;

      // R9: raw combobox triggers inside components/selectors/**
      if (relFile.startsWith('components/selectors/') && tag === 'Button') {
        const roleAttr = getAttribute(node, 'role');
        const role = roleAttr ? getAttributeText(roleAttr.initializer, sourceFile) : null;
        if (role === '"combobox"' || role === "'combobox'" || role === 'combobox') {
          push('R9', node, 'Hand-rolled combobox trigger. Use the shared SelectorTrigger primitive.', classText ?? 'Button role="combobox"');
        }
      }

      // R10: placeholder typography
      if (classText && classText.includes('text-muted-foreground')) {
        const content = textContent(node);
        const looksLikePlaceholder =
          content.includes('Seleccionar') ||
          /\bplaceholder\b/.test(content) ||
          /placeholder\}/.test(content);

        if (looksLikePlaceholder) {
          const usesSharedConstant = classText.includes('SELECTOR_PLACEHOLDER_CLASS');

          if (!usesSharedConstant) {
            const missing = CANONICAL_PLACEHOLDER.filter(token => !classText.includes(token));
            if (missing.length > 0) {
              push('R10', node, `Placeholder misses ${missing.join(' + ')}. Use SELECTOR_PLACEHOLDER_CLASS.`, classText);
            }
          }

          const badSize = FORBIDDEN_PLACEHOLDER_SIZES.find(size => classText.includes(size));
          if (badSize) {
            push('R10', node, `Placeholder uses ${badSize}. The placeholder is always text-sm.`, classText);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  function push(rule: Violation['rule'], node: ts.Node, message: string, snippet: string) {
    if (hasAllowComment(node, sourceFile)) return;
    violations.push({
      file: relFile,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      rule,
      message,
      snippet: snippet.substring(0, 160),
    });
  }

  visit(sourceFile);

  // R11: default placeholder policy — every selector defaults to "Seleccionar..."
  if (relFile.startsWith('components/selectors/')) {
    const isSelectorFile = /<\s*SelectorTrigger\b/.test(text) || /<\s*SelectTrigger\b/.test(text);
    const declaresPlaceholder = /placeholder\??\s*:/.test(text);
    const hasDefault = /placeholder\s*=\s*["']Seleccionar\.\.\.["']/.test(text);
    if (isSelectorFile && declaresPlaceholder && !hasDefault) {
      const line = text.split('\n').findIndex(l => /placeholder\??\s*:/.test(l)) + 1;
      violations.push({
        file: relFile,
        line,
        rule: 'R11',
        message: 'Selector must default its placeholder to "Seleccionar...".',
        snippet: 'placeholder',
      });
    }
  }

  return violations;
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

let violations: Violation[];

beforeAll(() => {
  violations = [];
  for (const file of [...findTsxFiles(SELECTORS_DIR), ...SHARED_FILES]) {
    violations.push(...scanFile(file));
  }
});

describe('Selector Typography Contract', () => {
  it('R9: Selectors must use the shared SelectorTrigger primitive', () => {
    const r9 = violations.filter(v => v.rule === 'R9');
    if (r9.length > 0) {
      console.log('\nR9 violations:', r9.map(v => `${v.file}:${v.line} — ${v.message}`).join('\n'));
    }
    expect(r9.length).toBe(0);
  });

  it('R10: Placeholders must use the canonical token', () => {
    const r10 = violations.filter(v => v.rule === 'R10');
    if (r10.length > 0) {
      console.log('\nR10 violations:', r10.map(v => `${v.file}:${v.line} — ${v.message} > ${v.snippet}`).join('\n'));
    }
    expect(r10.length).toBe(0);
  });

  it('R11: Every selector defaults its placeholder to "Seleccionar..."', () => {
    const r11 = violations.filter(v => v.rule === 'R11');
    if (r11.length > 0) {
      console.log('\nR11 violations:', r11.map(v => `${v.file}:${v.line} — ${v.message}`).join('\n'));
    }
    expect(r11.length).toBe(0);
  });

  it('R12: The shared selector constants are canonical', () => {
    const triggerPath = join(ROOT, 'components/shared/SelectorTrigger.tsx');
    const source = readFileSync(triggerPath, 'utf-8');

    const placeholder = source.match(/SELECTOR_PLACEHOLDER_CLASS\s*=\s*["'`]([^"'`]*)["'`]/)?.[1];
    expect(placeholder, 'SELECTOR_PLACEHOLDER_CLASS must be exported').toBeDefined();
    for (const token of CANONICAL_PLACEHOLDER) {
      expect(placeholder, `SELECTOR_PLACEHOLDER_CLASS must contain ${token}`).toContain(token);
    }

    const value = source.match(/SELECTOR_VALUE_CLASS\s*=\s*["'`]([^"'`]*)["'`]/)?.[1];
    expect(value, 'SELECTOR_VALUE_CLASS must be exported').toBeDefined();
    expect(value).toContain('text-sm');
    expect(value).toContain('font-normal');

    const base = source.match(/SELECTOR_TRIGGER_BASE\s*=\s*["'`]([^"'`]*)["'`]/)?.[1];
    expect(base, 'SELECTOR_TRIGGER_BASE must be exported').toBeDefined();
    expect(base).toContain('font-normal');
  });
});
