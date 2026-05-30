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

const RAW_COLOR_PATTERN = new RegExp(
  `(^|\\s|\\[|:)(${UTILITY_PREFIXES.join('|')})(${TAILWIND_COLORS.join('|')})\\d{2,3}($|\\s|\\]|:)`,
);

function isRawTailwindColor(className) {
  return RAW_COLOR_PATTERN.test(className);
}

export default {
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
        }
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

        if (
          node.value?.type === 'JSXExpressionContainer' &&
          node.value.expression?.type === 'Literal' &&
          typeof node.value.expression.value === 'string'
        ) {
          checkLiteral(node, node.value.expression.value);
        }

        if (
          node.value?.type === 'JSXExpressionContainer' &&
          node.value.expression?.type === 'TemplateLiteral'
        ) {
          for (const quasi of node.value.expression.quasis) {
            if (quasi.value?.raw) {
              checkLiteral(node, quasi.value.raw);
            }
          }
        }
      },

      CallExpression(node) {
        if (
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'cn' &&
          node.arguments
        ) {
          for (const arg of node.arguments) {
            if (arg.type === 'Literal' && typeof arg.value === 'string') {
              checkLiteral(node, arg.value);
            }
            if (arg.type === 'TemplateLiteral') {
              for (const quasi of arg.quasis) {
                if (quasi.value?.raw) {
                  checkLiteral(node, quasi.value.raw);
                }
              }
            }
          }
        }
      },
    };
  },
};
