/**
 * drawer-no-rounded
 *
 * Prohibits passing any `rounded-*` Tailwind class via `className` to the
 * `<Drawer>` or `<CollapsibleSheet>` edge panels. Their surface is ALWAYS
 * square (`rounded-none`) in every context — all sides, both boundaries
 * (screen/embedded), all modes (create/edit/view), resizable or not.
 *
 * The squareness is enforced by the components themselves (`rounded-none!`);
 * a consumer `rounded-*` override would reintroduce rounded borders and is
 * therefore a regression. Inner content (`contentClassName`, cards, buttons,
 * etc.) is NOT checked — only the panel surface `className`.
 *
 * See ADR-0073 (docs/10-architecture/adr/0073-drawers-zero-border-radius.md)
 * and docs/20-contracts/component-drawer.md (§Surface treatment).
 */

const EDGE_PANELS = new Set(['Drawer', 'CollapsibleSheet']);

const ROUNDED_TOKEN_PATTERN = /(^|\s)(rounded-[^\s]+)(\s|$)/;

function findRoundedToken(className) {
  if (typeof className !== 'string') return null;
  const match = className.match(ROUNDED_TOKEN_PATTERN);
  return match ? match[2] : null;
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
    type: 'problem',
    docs: {
      description:
        'Disallow rounded-* classes on <Drawer> and <CollapsibleSheet> surfaces. Edge panels are always square (rounded-none) in every context.',
    },
    schema: [],
    messages: {
      noRounded:
        'Drawer/CollapsibleSheet surfaces are always square (rounded-none) in every context — ADR-0073. Class "{{ value }}" is not allowed on the panel surface. See docs/20-contracts/component-drawer.md.',
    },
  },
  create(context) {
    function checkLiteral(node, value) {
      const token = findRoundedToken(value);
      if (token) {
        context.report({ node, messageId: 'noRounded', data: { value: token } });
      }
    }

    return {
      JSXOpeningElement(node) {
        const name = node.name?.name;
        if (typeof name !== 'string' || !EDGE_PANELS.has(name)) return;

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
