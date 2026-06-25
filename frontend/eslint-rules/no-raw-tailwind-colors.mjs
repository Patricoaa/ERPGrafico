/**
 * no-raw-tailwind-colors
 *
 * Disallows raw Tailwind color utility classes (e.g. `bg-red-500`, `text-blue-600`,
 * `border-emerald-300`) in JSX `className` attributes. Only semantic tokens from
 * frontend/app/globals.css are allowed (e.g. `text-primary`, `bg-destructive`).
 *
 * See GOVERNANCE.md §3 rule 12 — "No raw Tailwind colors. Semantic tokens only."
 * See docs/10-architecture/frontend-fsd.md — visual source of truth is globals.css.
 */

const TAILWIND_COLORS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'indigo',
  'violet', 'teal', 'cyan', 'emerald', 'lime', 'amber', 'fuchsia', 'rose',
  'sky', 'slate', 'gray', 'zinc', 'neutral', 'stone', 'white', 'black',
];

const UTILITY_PREFIXES = [
  'bg', 'text', 'border', 'ring', 'shadow', 'outline', 'accent', 'caret',
  'decoration', 'divide', 'from', 'via', 'to', 'stroke', 'fill',
  'placeholder',
];

/**
 * Raw palette utilities: `{prefix}-{color}-{shade}` with an optional `/opacity`.
 * The `-{shade}` (50–950) is REQUIRED, which is what distinguishes a raw Tailwind
 * class (`bg-red-500`) from a legitimate theme token whose name happens to collide
 * with a palette name (`bg-cyan`, `bg-black/50`, `bg-neutral` are Layer-1/Layer-2
 * tokens and have no numeric shade).
 */
const RAW_COLOR_PATTERN = new RegExp(
  `(^|\\s|\\[|:)(${UTILITY_PREFIXES.join('|')})-(${TAILWIND_COLORS.join('|')})-(\\d{2,3})(\\/\\d{1,3})?($|\\s|\\]|:|\\/)`,
);

/**
 * Hardcoded color VALUES embedded in className/cn (arbitrary values and inline
 * rgb/rgba literals). Catches `text-[#3b82f6]` and `shadow-[…rgba(245,158,11,…)]`.
 * Token-based arbitrary values like `oklch(var(--success-raw)/0.6)` are allowed.
 */
const HARDCODED_VALUE_PATTERN = /\[#[0-9a-fA-F]{3,8}\]|rgba?\(\s*\d/;

function isRawTailwindColor(className) {
  return RAW_COLOR_PATTERN.test(className);
}

function isHardcodedColorValue(className) {
  return HARDCODED_VALUE_PATTERN.test(className);
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw Tailwind color utility classes. Use semantic tokens (text-primary, bg-destructive, etc.) from globals.css.',
    },
    schema: [],
    messages: {
      rawColor:
        'Raw Tailwind color class "{{ value }}" detected. Use semantic tokens from globals.css (e.g. text-primary, bg-destructive, text-muted-foreground). See GOVERNANCE.md §3 rule 12.',
      hardcodedValue:
        'Hardcoded color value "{{ value }}" detected. Use a semantic token (e.g. shadow-[0_0_8px_oklch(var(--warning-raw)/0.6)] or bg-foreground/50), not literal hex/rgb. See docs/20-contracts/color-system.md §8.',
    },
  },
  create(context) {
    function checkLiteral(node, value) {
      if (typeof value !== 'string') return;
      const parts = value.split(/\s+/);
      for (const part of parts) {
        if (isRawTailwindColor(part)) {
          context.report({
            node,
            messageId: 'rawColor',
            data: { value: part },
          });
        } else if (isHardcodedColorValue(part)) {
          context.report({
            node,
            messageId: 'hardcodedValue',
            data: { value: part },
          });
        }
      }
    }

    /**
     * Recursively extract class-name strings from an expression so composed
     * className helpers are inspected too, e.g.
     *   cn(cond && "bg-red-500", cond ? "a" : "b", ["x"], { "y": cond })
     *   className={cond ? "bg-red-500" : ""}
     */
    function checkExpression(node, expr) {
      if (!expr) return;
      switch (expr.type) {
        case 'Literal':
          if (typeof expr.value === 'string') checkLiteral(node, expr.value);
          break;
        case 'TemplateLiteral':
          for (const quasi of expr.quasis) {
            if (quasi.value?.raw) checkLiteral(node, quasi.value.raw);
          }
          break;
        case 'LogicalExpression':
          checkExpression(node, expr.left);
          checkExpression(node, expr.right);
          break;
        case 'ConditionalExpression':
          checkExpression(node, expr.consequent);
          checkExpression(node, expr.alternate);
          break;
        case 'ArrayExpression':
          for (const el of expr.elements) checkExpression(node, el);
          break;
        case 'ObjectExpression':
          // clsx/cn object form: keys are class names
          for (const prop of expr.properties) {
            if (
              prop.type === 'Property' &&
              prop.key?.type === 'Literal' &&
              typeof prop.key.value === 'string'
            ) {
              checkLiteral(node, prop.key.value);
            }
          }
          break;
        default:
          break;
      }
    }

    return {
      JSXAttribute(node) {
        if (
          node.name?.type !== 'JSXIdentifier' ||
          node.name.name !== 'className'
        ) return;

        if (node.value?.type === 'Literal' && typeof node.value.value === 'string') {
          checkLiteral(node, node.value.value);
        }

        // CallExpression (e.g. cn(...)) is handled by the CallExpression visitor.
        if (
          node.value?.type === 'JSXExpressionContainer' &&
          node.value.expression?.type !== 'CallExpression'
        ) {
          checkExpression(node, node.value.expression);
        }
      },

      CallExpression(node) {
        if (
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'cn' &&
          node.arguments
        ) {
          for (const arg of node.arguments) {
            checkExpression(node, arg);
          }
        }
      },
    };
  },
};

export default rule;
