/**
 * pagination/no-raw-response-data
 *
 * Forbids returning `response.data` (or `res.data`, etc.) directly from
 * `api.get()` / `api.post()` / `api.put()` / `api.patch()` / `api.delete()`
 * calls inside api/ and hooks/ files.
 *
 * That pattern leaks the full DRF pagination envelope
 * `{ count, next, previous, results: [...] }` to the caller, which expects
 * either `T[]` or `Page<T>`. At runtime, calling `.forEach` / `.map` on the
 * envelope object produces `TypeError: periods.forEach is not a function`.
 *
 * The fix: use `toPage()` from `@/lib/pagination` to produce `Page<T>`.
 * See docs/20-contracts/pagination-contract.md §2.
 *
 * Detail endpoints (URL with dynamic segments like `${id}`) are excluded
 * because their response is a single object, not a paginated list.
 */
const API_METHODS = new Set(['get'])

/**
 * Whether `node` is a URL that contains a dynamic segment (template
 * interpolation like `${id}` or string concatenation). Detail endpoints
 * use these; list endpoints use plain string literals.
 *
 * Template literals with expressions ONLY in the query string (after `?`)
 * are still treated as list endpoints — only path-level expressions
 * indicate a detail endpoint.
 */
function isDynamicUrl(node) {
    if (!node) return false

    // Template literal with expressions
    if (node.type === 'TemplateLiteral' && node.expressions?.length > 0) {
        const quasis = node.quasis.map(q => q.value?.raw ?? '')
        // Find the first quasi containing '?' (query string delimiter)
        const firstQueryIdx = quasis.findIndex(q => q.includes('?'))
        // If no '?' or expressions exist before the '?' quasi → path expressions → detail
        if (firstQueryIdx === -1 || firstQueryIdx > 0) return true
        // All expressions are in the query string → still a list endpoint
        return false
    }

    // String concatenation: '/path/' + id + '/'
    if (node.type === 'BinaryExpression' && node.operator === '+') return true
    return false
}

// URL path suffixes that are exclusive detail / singleton / action
// endpoints and are never paginated (pagination-contract.md §1.5).
const NON_PAGINATED_PATH_SUFFIXES = [
    '/current/',
    '/my-profile/',
    '/server-time/',
    '/status/',
]

function isExemptUrl(node) {
    if (!node) return false
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return NON_PAGINATED_PATH_SUFFIXES.some(suffix => node.value.endsWith(suffix))
    }
    return false
}

/**
 * Returns the CallExpression node for an api.X() call, or null.
 * Also returns null if the URL argument is dynamic (detail endpoint).
 */
function extractApiCall(node) {
    let callExpr = null
    if (node?.type === 'AwaitExpression' && isApiCall(node.argument)) {
        callExpr = node.argument
    } else if (isApiCall(node)) {
        callExpr = node
    }
    if (!callExpr) return null

    // Exclude detail endpoints (URL with dynamic segments)
    // and known non-paginated endpoints (singletons, actions)
    const urlArg = callExpr.arguments[0]
    if (!urlArg) return null
    if (isDynamicUrl(urlArg)) return null
    if (isExemptUrl(urlArg)) return null

    return callExpr
}

function isApiCall(node) {
    return (
        node?.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.object?.type === 'Identifier' &&
        node.callee.object.name === 'api' &&
        node.callee.property?.type === 'Identifier' &&
        API_METHODS.has(node.callee.property.name)
    )
}

function isResponseDataReturn(node) {
    // return response.data
    if (
        node?.type === 'ReturnStatement' &&
        node.argument?.type === 'MemberExpression' &&
        !node.argument.computed &&
        node.argument.property?.type === 'Identifier' &&
        node.argument.property.name === 'data' &&
        node.argument.object?.type === 'Identifier'
    ) {
        return node.argument.object.name
    }
    return null
}

function isInlineApiDataReturn(node) {
    // return (await api.get(...)).data
    if (
        node?.type === 'ReturnStatement' &&
        node.argument?.type === 'MemberExpression' &&
        !node.argument.computed &&
        node.argument.property?.type === 'Identifier' &&
        node.argument.property.name === 'data'
    ) {
        const obj = node.argument.object
        if (obj?.type === 'AwaitExpression' && isApiCall(obj.argument)) {
            const urlArg = obj.argument.arguments[0]
            if (urlArg && isDynamicUrl(urlArg)) return 'detail'
            return 'list'
        }
    }
    return null
}

const rule = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Forbid returning `response.data` from API calls — use toPage() from @/lib/pagination instead.',
        },
        schema: [],
        messages: {
            rawData:
                'Returning `{{ name }}.data` from a paginated API call returns the DRF envelope ({count, next, previous, results}). Use toPage() from @/lib/pagination. See docs/20-contracts/pagination-contract.md §2.',
            inlineData:
                'Returning `(await api.{{ method }}(...)).data` returns the DRF pagination envelope. Use toPage() from @/lib/pagination. See docs/20-contracts/pagination-contract.md §2.',
        },
    },
    create(context) {
        const apiVarStack = [new Set()]

        function pushScope() {
            apiVarStack.push(new Set())
        }

        function popScope() {
            apiVarStack.pop()
        }

        function currentScope() {
            return apiVarStack[apiVarStack.length - 1]
        }

        return {
            ':function'(node) {
                pushScope()
            },
            ':function:exit'() {
                if (apiVarStack.length > 1) {
                    popScope()
                }
            },

            VariableDeclarator(node) {
                // const response = await api.get('/path/')  → track "response"
                if (node.id?.type === 'Identifier' && node.init && extractApiCall(node.init)) {
                    currentScope().add(node.id.name)
                }
            },

            ReturnStatement(node) {
                // return <trackedVar>.data
                const varName = isResponseDataReturn(node)
                if (varName && currentScope().has(varName)) {
                    context.report({
                        node,
                        messageId: 'rawData',
                        data: { name: varName },
                    })
                    return
                }

                // return (await api.get(...)).data  (non-dynamic URL only)
                const inlineKind = isInlineApiDataReturn(node)
                if (inlineKind === 'list') {
                    const methodName = node.argument?.object?.argument?.callee?.property?.name ?? 'get'
                    context.report({
                        node,
                        messageId: 'inlineData',
                        data: { method: methodName },
                    })
                }
            },
        }
    },
}

export default rule
