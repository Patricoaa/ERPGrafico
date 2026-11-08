/**
 * fsd/no-cross-feature-internals
 *
 * Disallow importing another feature's internals (`components`, `hooks`,
 * `api`, `types`, `utils`, `actions`, `contexts`, `entity-view`). Cross-feature
 * consumers must import from the owning feature barrel (`@/features/<name>`),
 * per FSD invariant #3.
 *
 * Why a custom rule and not `no-restricted-imports`:
 *   - ESLint flat-config overwrites `no-restricted-imports` between blocks
 *     that match the same files (rule options do not merge), so the TanStack
 *     block for feature TSX files used to silently drop the cross-feature
 *     patterns (issue #176).
 *   - The static patterns also cannot tell the owner feature apart: a rule
 *     matching the internals of every feature flags `features/pos` importing
 *     its own `@/features/pos/components/...`. This rule compares the
 *     importing file's feature against the target and only reports real
 *     cross-feature imports.
 *
 * Files outside `features/` (`app/`, `hooks/`, `components/shared/`) are
 * always treated as cross-feature consumers.
 */
import path from "node:path"

const INTERNAL_SEGMENTS = new Set([
    "components",
    "hooks",
    "api",
    "types",
    "utils",
    "actions",
    "contexts",
    "entity-view",
])

function ownerFeature(filename) {
    // Resolve against the filesystem instead of process.cwd(): the rule must
    // behave the same whether ESLint runs from `frontend/` or the repo root.
    const parts = path.resolve(filename).split(path.sep)
    const index = parts.lastIndexOf("features")
    return index !== -1 && index < parts.length - 2 ? parts[index + 1] : null
}

const rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow importing another feature's internals. Import from the owning feature barrel (@/features/<name>) instead.",
        },
        schema: [],
        messages: {
            crossFeature:
                "Cross-feature: import from the owning feature barrel (@/features/{{target}}), not '{{source}}'. See FSD invariant #3.",
        },
    },
    create(context) {
        const owner = ownerFeature(context.filename)

        function check(node) {
            const source = node.source?.value
            if (typeof source !== "string" || !source.startsWith("@/features/")) return

            const [target, segment] = source.slice("@/features/".length).split("/")
            if (!target || target === owner) return
            // Bare barrel (`@/features/orders`) and explicit barrel entry are fine.
            if (!segment || segment === "index" || segment.startsWith("index.")) return
            if (!INTERNAL_SEGMENTS.has(segment)) return

            context.report({
                node,
                messageId: "crossFeature",
                data: { target, source },
            })
        }

        return {
            ImportDeclaration: check,
            ExportNamedDeclaration: check,
            ExportAllDeclaration: check,
        }
    },
}

export default rule
