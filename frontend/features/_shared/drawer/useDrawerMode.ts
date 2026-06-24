"use client"

import type { DrawerMode } from "./types"

export interface UseDrawerModeOptions {
  mode?: DrawerMode
  initialData?: unknown
  /** Modo por defecto cuando hay initialData (default: 'edit') */
  defaultMode?: DrawerMode
}

export function useDrawerMode({ mode, initialData, defaultMode }: UseDrawerModeOptions = {}) {
  const resolved: DrawerMode = mode ?? (initialData ? defaultMode ?? 'edit' : 'create')

  return {
    mode: resolved,
    isView: resolved === 'view',
    isEdit: resolved === 'edit',
    isCreate: resolved === 'create',
  } as const
}
