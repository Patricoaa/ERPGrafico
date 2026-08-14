/**
 * typography/token-first
 *
 * Enforces the typography contract (docs/20-contracts/typography-scale.md):
 *   1. No raw arbitrary font sizes in the N5 micro range (text-[9px]..[15px]).
 *      Use the tokens: text-4xs (9px), text-3xs (10px), text-2xs (11px),
 *      text-xs (12px+), text-sm (14px+).
 *   2. No arbitrary letter-spacing except the sanctioned N1 value
 *      `tracking-[0.25em]`. Use tracking-widest / tracking-loose /
 *      tracking-looser for wider spacing.
 *   3. Action buttons must use `font-medium` (never `font-bold`) per the
 *      "Escala de botones de acción" section of typography-scale.md.
 */

const FORBIDDEN_SIZES = new Map([
  ['text-[9px]', 'text-4xs'],
  ['text-[10px]', 'text-3xs'],
  ['text-[11px]', 'text-2xs'],
  ['text-[12px]', 'text-xs'],
  ['text-[13px]', 'text-xs'],
  ['text-[14px]', 'text-sm'],
  ['text-[15px]', 'text-sm'],
]);

const ARBITRARY_TRACKING = /^tracking-\[(?!0\.25em\])/;

const isCnCall = (node) =>
  node.callee?.type === 'Identifier' && node.callee.name === 'cn';

const isButtonElement = (name) =>
  name?.type === 'JSXIdentifier' && name.name === 'Button';

function collectTokens(expr, out) {
  if (!expr) return out;
  switch (expr.type) {
    case 'Literal':
      if (typeof expr.value === 'string') out.push(expr.value);
      break;
    case 'TemplateLiteral':
      for (const quasi of expr.quasis) {
        if (quasi.value?.raw) out.push(quasi.value.raw);
      }
      break;
    case 'LogicalExpression':
      collectTokens(expr.left, out);
      collectTokens(expr.right, out);
      break;
    case 'ConditionalExpression':
      collectTokens(expr.consequent, out);
      collectTokens(expr.alternate, out);
      break;
    case 'ArrayExpression':
      for (const el of expr.elements) collectTokens(el, out);
      break;
    case 'ObjectExpression':
      for (const prop of expr.properties) {
        if (
          prop.type === 'Property' &&
          prop.key?.type === 'Literal' &&
          typeof prop.key.value === 'string'
        ) {
          out.push(prop.key.value);
        }
      }
      break;
    default:
      break;
  }
  return out;
}

function checkTokenString(context, node, className, inButton) {
  const tokens = className.split(/\s+/);
  for (const token of tokens) {
    const replacement = FORBIDDEN_SIZES.get(token);
    if (replacement) {
      context.report({
        node,
        messageId: 'rawSize',
        data: { value: token, replacement },
      });
      continue;
    }
    if (ARBITRARY_TRACKING.test(token)) {
      context.report({
        node,
        messageId: 'arbitraryTracking',
        data: { value: token },
      });
      continue;
    }
    if (inButton && token === 'font-bold') {
      context.report({
        node,
        messageId: 'buttonWeight',
      });
    }
  }
}

function checkExpression(context, node, expr, inButton) {
  const out = [];
  collectTokens(expr, out);
  for (const className of out) checkTokenString(context, node, className, inButton);
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw arbitrary font-size and letter-spacing classes in favor of typography tokens (text-2xs/3xs/4xs, tracking-loose/looser) and forbid font-bold on action buttons.',
    },
    schema: [],
    messages: {
      rawSize:
        'Raw font-size class "{{ value }}" detected. Use the token "{{ replacement }}" (see docs/20-contracts/typography-scale.md).',
      arbitraryTracking:
        'Arbitrary letter-spacing "{{ value }}" detected. Use tracking-widest (0.1em), tracking-loose (0.15em), tracking-looser (0.2em) or the sanctioned tracking-[0.25em] (see typography-scale.md).',
      buttonWeight:
        'Action buttons must use font-medium, not font-bold (see "Escala de botones de acción" in typography-scale.md).',
    },
  },
  create(context) {
    // <Button> nesting depth — incremented on the opening element (before its
    // attributes are visited) and decremented on the closing element. Self-closing
    // buttons balance in a single step. ESLint 9 flat config has no getAncestors().
    let buttonDepth = 0;
    const isInsideButton = () => buttonDepth > 0;

    function handleAttribute(node) {
      if (
        node.name?.type !== 'JSXIdentifier' ||
        node.name.name !== 'className'
      ) return;

      const inButton = isInsideButton();
      const value = node.value;

      if (value?.type === 'Literal' && typeof value.value === 'string') {
        checkTokenString(context, node, value.value, inButton);
      } else if (
        value?.type === 'JSXExpressionContainer' &&
        value.expression?.type !== 'CallExpression'
      ) {
        checkExpression(context, node, value.expression, inButton);
      }
    }

    function handleCall(node) {
      if (!isCnCall(node)) return;
      const inButton = isInsideButton();
      for (const arg of node.arguments) {
        checkExpression(context, node, arg, inButton);
      }
    }

    return {
      JSXOpeningElement(node) {
        if (!isButtonElement(node.name)) return;
        buttonDepth += 1;
        if (node.selfClosing) buttonDepth -= 1;
      },
      JSXClosingElement(node) {
        if (isButtonElement(node.name)) buttonDepth -= 1;
      },
      JSXAttribute: handleAttribute,
      CallExpression: handleCall,
    };
  },
};

export default rule;
