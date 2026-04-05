import { Account } from "../types"

interface AccountWithChildren extends Account {
    children?: AccountWithChildren[]
}

/**
 * Transforms a flat list of accounts into a hierarchical tree structure.
 * Each account with children will have them in the 'children' property.
 */
export function buildAccountTree(accounts: Account[]): AccountWithChildren[] {
    const accountMap: Record<number, AccountWithChildren> = {}
    const tree: AccountWithChildren[] = []

    // First pass: Create map and initialize children arrays
    accounts.forEach(account => {
        accountMap[account.id] = { ...account, children: [] }
    })

    // Second pass: Build the tree
    accounts.forEach(account => {
        const node = accountMap[account.id]
        if (account.parent && accountMap[account.parent]) {
            accountMap[account.parent].children?.push(node)
        } else {
            tree.push(node)
        }
    })

    // Sort by code (assuming numeric/string codes)
    const sortTree = (nodes: AccountWithChildren[]) => {
        nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        nodes.forEach(node => {
            if (node.children?.length) {
                sortTree(node.children)
            }
        })
    }

    sortTree(tree)
    return tree
}
