/**
 * forms-must-use-hook
 *
 * Disallow native `<form>` elements unless the file imports `useForm` from
 * `react-hook-form` and `zodResolver` from `@hookform/resolvers/zod`.
 * This enforces GOVERNANCE.md §6 rule 29: "All forms use react-hook-form +
 * zodResolver."
 *
 * Files that use `<form>` without these imports are likely using raw
 * `useState` for form state — which means no Zod validation, inconsistent
 * error handling, and a governance violation.
 *
 * Severity is `warn` during the migration window; bump to `error` when
 * the global violation count reaches 0.
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Forms must use react-hook-form (useForm) + zodResolver. Raw <form> without these imports is a governance violation.',
    },
    schema: [],
    messages: {
      missingUseForm:
        'This file uses a <form> element without importing useForm from react-hook-form. All forms must use react-hook-form + zodResolver. See GOVERNANCE.md §6 rule 29.',
      missingZodResolver:
        'This file uses a <form> element without importing zodResolver from @hookform/resolvers/zod. All forms must use a Zod schema with zodResolver.',
    },
  },
  create(context) {
    let hasFormElement = false;
    let hasDirectUseForm = false;     // useForm from react-hook-form
    let hasWrapperUseForm = false;    // useForm* from a project wrapper
    let hasZodResolverImport = false;
    let firstFormNode = null;

    return {
      ImportDeclaration(node) {
        // Direct react-hook-form import (useForm)
        if (node.source.value === 'react-hook-form') {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportSpecifier' && spec.imported?.name === 'useForm') {
              hasDirectUseForm = true;
            }
          }
        }
        // Project wrappers (useFormWithToast, etc.) — any useForm* hook from non-react-hook-form sources
        if (node.source.value !== 'react-hook-form') {
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              (spec.imported?.name === 'useForm' || spec.local?.name.startsWith('useForm'))
            ) {
              hasWrapperUseForm = true;
            }
            if (
              spec.type === 'ImportDefaultSpecifier' &&
              spec.local?.name.startsWith('useForm')
            ) {
              hasWrapperUseForm = true;
            }
          }
        }
        if (node.source.value === '@hookform/resolvers/zod') {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportSpecifier' && spec.imported?.name === 'zodResolver') {
              hasZodResolverImport = true;
            }
          }
        }
      },

      JSXOpeningElement(node) {
        if (node.name?.type === 'JSXIdentifier' && node.name.name === 'form') {
          hasFormElement = true;
          if (!firstFormNode) firstFormNode = node;
        }
      },

      'Program:exit'() {
        if (!hasFormElement || !firstFormNode) return;

        if (!hasDirectUseForm && !hasWrapperUseForm) {
          context.report({ node: firstFormNode, messageId: 'missingUseForm' });
          return;
        }
        // Only require zodResolver when useForm is imported directly from
        // react-hook-form (wrappers like useFormWithToast include it already).
        if (hasDirectUseForm && !hasZodResolverImport) {
          context.report({ node: firstFormNode, messageId: 'missingZodResolver' });
        }
      },
    };
  },
};
