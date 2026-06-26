const rule = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'useMutation with onSuccess must call markLocalMutation() to notify the local mutation tracker for realtime cache invalidation. See docs/20-contracts/hook-contracts.md Rule 2.',
        },
        schema: [],
        messages: {
            missing:
                'useMutation with onSuccess must include a call to markLocalMutation() as the first statement to notify the local mutation tracker. See docs/20-contracts/hook-contracts.md Rule 2.',
        },
    },
    create(context) {
        function isMarkLocalMutationCall(node) {
            if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression') {
                return false;
            }
            const callee = node.expression.callee;
            return callee.type === 'Identifier' && callee.name === 'markLocalMutation';
        }

        function checkOnSuccessBody(body) {
            if (!body || !body.body) return;
            const hasMark = body.body.some(
                (stmt) => isMarkLocalMutationCall(stmt) ||
                    (stmt.type === 'TryStatement' &&
                     stmt.block.body.some((s) => isMarkLocalMutationCall(s))),
            );
            return hasMark;
        }

        return {
            CallExpression(node) {
                if (node.callee.type !== 'Identifier' || node.callee.name !== 'useMutation') {
                    return;
                }
                const opts = node.arguments[0];
                if (!opts || opts.type !== 'ObjectExpression') return;

                const onSuccessProp = opts.properties.find(
                    (p) =>
                        p.type === 'Property' &&
                        p.key.type === 'Identifier' &&
                        p.key.name === 'onSuccess',
                );
                if (!onSuccessProp) return;

                const fn = onSuccessProp.value;
                if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) {
                    return;
                }

                const body = fn.body;
                if (body.type === 'CallExpression') {
                    if (
                        body.callee.type === 'Identifier' &&
                        body.callee.name === 'markLocalMutation'
                    ) {
                        return;
                    }
                    context.report({ node: onSuccessProp, messageId: 'missing' });
                    return;
                }

                if (body.type === 'BlockStatement' && !checkOnSuccessBody(body)) {
                    context.report({ node: onSuccessProp, messageId: 'missing' });
                }
            },
        };
    },
};

export default rule;
