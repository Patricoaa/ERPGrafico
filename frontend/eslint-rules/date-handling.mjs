/**
 * Date handling guards — GOVERNANCE.md rule 47, component-entity-view.md (kind `date`).
 *
 *   - no-date-only-ctor: `new Date("YYYY-MM-DD")` parses as UTC midnight and shifts the day in
 *     negative offsets (Chile UTC-3/-4). Date-only values go through `parseDateOnly`
 *     (`@/lib/utils`) or `new Date(y, m - 1, d)`. Flags: a date-only string literal, a template
 *     literal that starts like one, and a single identifier/member argument whose name reads as a
 *     date-only field (`date`, `dueDate`, `issue_date`, `from`/`to` ranges…). Datetime names
 *     (`createdAt`, `*_at`, `timestamp`, `datetime`) are not flagged.
 *   - no-adhoc-date-format: `toLocaleDateString` / `toLocaleTimeString` / `Intl.DateTimeFormat`
 *     outside the shared formatters. Use the `date` value kind, `formatDate`/`formatPlainDate`.
 *
 * Test and story files are skipped; `lib/utils.ts` and the entity-view formatters own the logic.
 */

const OWNERS = /(?:^|\/)(?:lib\/utils\.ts|components\/entity-view\/core\/formatters\.ts)$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_ONLY_PREFIX = /^\d{4}-\d{2}-\d{2}/
const DATE_NAME = /(?:^|[_.])(?:date|due|from|to)$|(?:Date|Due|From|To)$|^(?:date|due|from|to)$/
const DATETIME_NAME = /(?:_at|At|time|Time|timestamp|Timestamp|now|Now)$|^history_date$|^buildDate$/

function skip(filename) {
  return (
    OWNERS.test(filename.replaceAll('\\', '/')) ||
    /\.(test|spec|stories)\.[tj]sx?$/.test(filename) ||
    /(?:^|\/)components\/ui\//.test(filename.replaceAll('\\', '/')) ||
    filename.includes('__tests__')
  )
}

function argName(arg) {
  if (arg.type === 'Identifier') return arg.name
  if (arg.type === 'MemberExpression' && !arg.computed && arg.property.type === 'Identifier') return arg.property.name
  return null
}

const noDateOnlyCtor = {
  meta: {
    type: 'problem',
    docs: { description: 'Date-only strings must not be parsed with new Date(string) (UTC shift).' },
    schema: [],
    messages: {
      shift:
        'new Date(<date-only string>) parses as UTC and can shift the day. Use parseDateOnly() from @/lib/utils or new Date(y, m - 1, d).',
    },
  },
  create(context) {
    if (skip(context.filename ?? context.getFilename())) return {}
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Date' || node.arguments.length !== 1) return
        const arg = node.arguments[0]
        let bad = false
        if (arg.type === 'Literal' && typeof arg.value === 'string') bad = DATE_ONLY.test(arg.value)
        else if (arg.type === 'TemplateLiteral') bad = DATE_ONLY_PREFIX.test(arg.quasis[0]?.value.cooked ?? '') && !arg.quasis.some((q) => q.value.cooked.includes('T'))
        else {
          const name = argName(arg)
          bad = name !== null && DATE_NAME.test(name) && !DATETIME_NAME.test(name)
        }
        if (bad) context.report({ node, messageId: 'shift' })
      },
    }
  },
}

const noAdhocDateFormat = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Format dates through the shared formatters / date value kind.' },
    schema: [],
    messages: {
      format:
        'Do not format dates with {{ what }}. Use the `date` value kind, formatDate() (@/components/entity-view) or formatPlainDate() (@/lib/utils).',
    },
  },
  create(context) {
    if (skip(context.filename ?? context.getFilename())) return {}
    return {
      "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]"(node) {
        context.report({ node, messageId: 'format', data: { what: `.${node.callee.property.name}()` } })
      },
      "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']"(node) {
        // `Intl.DateTimeFormat().resolvedOptions()` only reads the browser timezone.
        const call = node.parent
        if (call?.type === 'CallExpression' && call.parent?.type === 'MemberExpression' && call.parent.property.name === 'resolvedOptions') return
        context.report({ node, messageId: 'format', data: { what: 'Intl.DateTimeFormat' } })
      },
    }
  },
}

export default { rules: { 'no-date-only-ctor': noDateOnlyCtor, 'no-adhoc-date-format': noAdhocDateFormat } }
