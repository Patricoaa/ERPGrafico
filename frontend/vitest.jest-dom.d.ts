/**
 * Vitest 5: `vitest.config.ts` imports `@vitest/browser-playwright` (Storybook project), which loads
 * `@vitest/browser/matchers` and augments `Assertion` with the browser-mode DOM matchers for the whole
 * program. Their `toHaveTextContent` takes only `string | number`, hiding jest-dom's `RegExp` form,
 * which the jsdom unit tests run (`@testing-library/jest-dom/vitest` in `vitest.setup.ts`).
 * This restores jest-dom's signature as an overload.
 */
import "vitest"

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- merging requires the same type parameters as vitest's `Assertion<T>`
    interface Assertion<T> {
        toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void
    }
}
