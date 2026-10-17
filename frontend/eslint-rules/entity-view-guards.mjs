/**
 * entity-view guards — ADR-0087 §9, contract docs/20-contracts/component-entity-view.md §9.
 *
 * Four rules that keep the entity view system from drifting back into the rigidity
 * the audit measured (docs/50-audit/Tablascards/01-rigidity-forensics.md):
 *
 *   - no-legacy-presentation: code built on entity-view (it imports
 *     `@/components/entity-view` or lives in `features/* /entity-view/`) must not import
 *     the frozen legacy authoring API (`createEntityFields`, `AutoEntityCard`,
 *     `DataTable`, `DataTableView`, card-view factories).
 *   - no-adhoc-format: inside entity-view code, money/number/date formatting goes
 *     through the kind formatters (`core/formatters.ts`), never `Intl.*` or
 *     `toLocale*String` — one formatter feeds table, card, sort and export.
 *   - no-adhoc-table: entity-view code renders tables through `Collection.*` /
 *     `EditableCollection`, never a hand-written `<table>` or the `ui/table` primitive.
 *   - no-deep-import: outside `components/entity-view/`, import the system from its
 *     barrel (invariant #6). Module augmentation (`declare module "…/core/value-kinds"`)
 *     is not an import and stays allowed. Stories may reach the story helpers.
 *
 * Test files are skipped.
 */

const BARREL = '@/components/entity-view'
const LEGACY_NAMES = new Set([
  'createEntityFields',
  'AutoEntityCard',
  'DataTable',
  'DataTableView',
  'createEntityCardView',
  'createCardGroupView',
  'createCardLoadingView',
])
const FORMATTERS_FILE = /components\/entity-view\/core\/formatters\.ts$/
const ENTITY_VIEW_CORE = /components\/entity-view\//
const FEATURE_ENTITY_VIEW = /features\/[^/]+\/(?:[^/]+\/)*entity-view\//

function isTestFile(filename) {
  return /\.(test|spec)\.[tj]sx?$/.test(filename) || filename.includes('__tests__')
}

/** True for files that belong to the entity-view system or are built on it. */
function createEntityViewScope(context) {
  const filename = context.filename || context.getFilename()
  const inScopeByPath = ENTITY_VIEW_CORE.test(filename) || FEATURE_ENTITY_VIEW.test(filename)
  let importsBarrel = false
  return {
    filename,
    noteImport(source) {
      if (source === BARREL || source.startsWith(`${BARREL}/`)) importsBarrel = true
    },
    inScope: () => inScopeByPath || importsBarrel,
  }
}

const noLegacyPresentation = {
  meta: {
    type: 'problem',
    docs: { description: 'Code built on entity-view must not import the frozen legacy presentation API (ADR-0087).' },
    schema: [],
    messages: {
      legacy:
        '"{{ name }}" is the frozen legacy presentation API. Code built on @/components/entity-view uses defineEntity + Collection.* (docs/20-contracts/component-entity-view.md).',
    },
  },
  create(context) {
    const scope = createEntityViewScope(context)
    if (isTestFile(scope.filename)) return {}
    const legacy = []
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value)
        scope.noteImport(source)
        if (source !== '@/components/shared' && !source.startsWith('@/components/shared/')) return
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && LEGACY_NAMES.has(spec.imported.name)) {
            legacy.push({ node: spec, name: spec.imported.name })
          }
        }
      },
      'Program:exit'() {
        if (!scope.inScope()) return
        for (const { node, name } of legacy) context.report({ node, messageId: 'legacy', data: { name } })
      },
    }
  },
}

const noAdhocFormat = {
  meta: {
    type: 'problem',
    docs: { description: 'Entity-view code formats values only through the kind formatters (ADR-0087 §2).' },
    schema: [],
    messages: {
      format:
        'Do not format with {{ what }} in entity-view code. Use a value kind (f.money, f.date, f.quantity…) or the formatters exported by @/components/entity-view.',
    },
  },
  create(context) {
    const scope = createEntityViewScope(context)
    if (isTestFile(scope.filename) || FORMATTERS_FILE.test(scope.filename)) return {}
    const found = []
    return {
      ImportDeclaration(node) {
        scope.noteImport(String(node.source.value))
      },
      "MemberExpression[object.name='Intl']"(node) {
        found.push({ node, what: `Intl.${node.property.name ?? ''}` })
      },
      "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]"(node) {
        found.push({ node, what: `.${node.callee.property.name}()` })
      },
      'Program:exit'() {
        if (!scope.inScope()) return
        for (const { node, what } of found) context.report({ node, messageId: 'format', data: { what } })
      },
    }
  },
}

const noAdhocTable = {
  meta: {
    type: 'problem',
    docs: { description: 'Entity-view code renders tables through Collection.* / EditableCollection (ADR-0087 §4–5).' },
    schema: [],
    messages: {
      table:
        'Hand-written tables are not allowed in entity-view code. Use <Collection.View>/<Collection.Table> or <EditableCollection> from @/components/entity-view.',
    },
  },
  create(context) {
    const scope = createEntityViewScope(context)
    // The core surfaces are the one place that renders the semantic <table>.
    if (isTestFile(scope.filename) || ENTITY_VIEW_CORE.test(scope.filename)) return {}
    const found = []
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value)
        scope.noteImport(source)
        if (source === '@/components/ui/table') found.push(node)
      },
      "JSXOpeningElement[name.name='table']"(node) {
        found.push(node)
      },
      'Program:exit'() {
        if (!scope.inScope()) return
        for (const node of found) context.report({ node, messageId: 'table' })
      },
    }
  },
}

const noDeepImport = {
  meta: {
    type: 'problem',
    docs: { description: 'Import the entity view system from its barrel (invariant #6).' },
    schema: [],
    messages: {
      deep: 'Import from the barrel (@/components/entity-view), not "{{ source }}".',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isTestFile(filename) || ENTITY_VIEW_CORE.test(filename)) return {}
    const isStory = /\.stories\.tsx?$/.test(filename)
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value)
        if (!source.startsWith(`${BARREL}/`)) return
        if (isStory && source.startsWith(`${BARREL}/stories/`)) return
        context.report({ node, messageId: 'deep', data: { source } })
      },
    }
  },
}

const plugin = {
  rules: {
    'no-legacy-presentation': noLegacyPresentation,
    'no-adhoc-format': noAdhocFormat,
    'no-adhoc-table': noAdhocTable,
    'no-deep-import': noDeepImport,
  },
}

export default plugin
