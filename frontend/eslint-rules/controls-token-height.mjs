/**
 * controls-token-height
 *
 * Interactive controls take their height from a ROLE (`h-control-{xs,sm,md,lg,touch}` /
 * `size-control-*`), not from a literal `h-7 … h-12` / `size-9 … size-12` (ADR-0142 D4,
 * GOVERNANCE #17). Literal heights stay exempt from the Interaction Guard only transitionally
 * (globals.css); this rule reports them so the inventory can reach zero (plan phase 6) and the
 * guard's `:not(.h-N)` chains can go away.
 *
 * Checked elements: <button>, <input>, <select>, Button, IconButton, SubmitButton, CancelButton,
 * DangerButton, Input, SelectTrigger, TabsTrigger. Severity: warn (promote to error at inventory 0).
 * See docs/20-contracts/density-system.md §5.
 */

const CONTROLS = new Set([
  'button', 'input', 'select',
  'Button', 'IconButton', 'SubmitButton', 'CancelButton', 'DangerButton',
  'Input', 'SelectTrigger', 'TabsTrigger',
]);

// h-7|8|9|10|11|12 and size-7..12, with optional variant prefixes (md:, hover:, ...).
const LITERAL_HEIGHT = /(?:^|[\s:])((?:h|size)-(?:7|8|9|10|12))(?=\s|$)/;

function findLiteralHeight(className) {
  if (typeof className !== 'string') return null;
  const match = className.match(LITERAL_HEIGHT);
  return match ? match[1] : null;
}

/**
 * Recursively extract class-name strings from an expression so composed
 * className helpers are inspected too, e.g.
 *   className={cn(cond && "rounded-xl", cond ? "a" : "b", ["x"], { "y": cond })}
 *   className={cond ? "rounded-xl" : ""}
 */
function checkExpression(context, node, report) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') report(node, node.value);
      break;
    case 'TemplateLiteral':
      for (const quasi of node.quasis) {
        if (quasi.value?.raw) report(node, quasi.value.raw);
      }
      break;
    case 'LogicalExpression':
      checkExpression(context, node.left, report);
      checkExpression(context, node.right, report);
      break;
    case 'ConditionalExpression':
      checkExpression(context, node.consequent, report);
      checkExpression(context, node.alternate, report);
      break;
    case 'CallExpression':
      // cn(...) / clsx(...): inspect the class-name arguments recursively
      for (const arg of node.arguments) checkExpression(context, arg, report);
      break;
    case 'ArrayExpression':
      for (const el of node.elements) checkExpression(context, el, report);
      break;
    case 'ObjectExpression':
      // clsx/cn object form: keys are class names
      for (const prop of node.properties) {
        if (
          prop.type === 'Property' &&
          prop.key?.type === 'Literal' &&
          typeof prop.key.value === 'string'
        ) {
          report(node, prop.key.value);
        }
      }
      break;
    default:
      break;
  }
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Interactive controls must use a height role (h-control-*) instead of a literal h-7…h-12.',
    },
    schema: [],
    messages: {
      literalHeight:
        'Use a height role (h-control-xs/sm/md/lg/touch or size-control-*) instead of the literal "{{ value }}" on interactive controls — ADR-0142 D4. See docs/20-contracts/density-system.md §5.',
    },
  },
  create(context) {
    function checkLiteral(node, value) {
      const token = findLiteralHeight(value);
      if (token) context.report({ node, messageId: 'literalHeight', data: { value: token } });
    }

    return {
      JSXOpeningElement(node) {
        const name = node.name?.name;
        if (typeof name !== 'string' || !CONTROLS.has(name)) return;

        const classNameAttr = node.attributes.find(
          (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
        );
        if (!classNameAttr || !classNameAttr.value) return;

        if (classNameAttr.value.type === 'Literal') {
          checkLiteral(classNameAttr.value, classNameAttr.value.value);
        } else if (
          classNameAttr.value.type === 'JSXExpressionContainer' &&
          classNameAttr.value.expression
        ) {
          checkExpression(context, classNameAttr.value.expression, checkLiteral);
        }
      },
    };
  },
};

export default rule;
