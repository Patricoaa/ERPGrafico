import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor default to 1 s. A full run shares the CPU with the repo-wide contract
// scans, and a render that settles in ~100 ms alone could miss that window. A real
// failure still fails, only later (testTimeout in vitest.config.ts is 15 s).
configure({ asyncUtilTimeout: 4000 })

// Clean up DOM after each test
afterEach(() => {
  cleanup()
})
