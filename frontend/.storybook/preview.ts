import { createElement } from 'react'
import type { Preview } from '@storybook/nextjs-vite'
import '../app/globals.css'

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  globalTypes: {
    theme: {
      description: 'Tema',
      toolbar: { title: 'Tema', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
    density: {
      description: 'Densidad',
      toolbar: { title: 'Densidad', icon: 'component', items: ['compact', 'comfortable'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', density: 'compact' },
  decorators: [
    (Story, context) => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', context.globals.theme === 'dark')
      }
      const className = context.globals.density === 'comfortable' ? 'table-comfortable bg-background p-4' : 'bg-background p-4'
      return createElement('div', { className }, createElement(Story))
    },
  ],
};

export default preview;
