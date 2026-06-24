"use client"

import { getEntityMetadata, getEntityIcon } from "@/lib/entity-registry"
import type { DrawerMode } from "./types"

export interface DrawerIdentityData {
  id?: number | string
  [key: string]: unknown
}

export interface UseDrawerIdentityOptions {
  /** Si el nombre de la entidad es femenino, usa "Nueva" en vez de "Nuevo" (default: false) */
  feminine?: boolean
  /** Subtítulo estático. Si se omite, se usa un default según el modo */
  subtitle?: string
  /** Título completamente custom (anula la resolución automática) */
  customTitle?: string
}

function formatEntityTitle(label: string, mode: DrawerMode, data?: DrawerIdentityData | null, feminine?: boolean) {
  const meta = getEntityMetadata(label)
  const entityTitle = meta?.title ?? label.split('.').pop() ?? label

  if (mode === 'create') {
    const prefix = feminine ? 'Nueva' : 'Nuevo'
    return `${prefix} ${entityTitle}`
  }

  if (mode === 'edit') {
    return `Editar ${entityTitle}`
  }

  const idStr = data?.id != null ? ` #${data.id}` : ''
  return `Ficha de ${entityTitle}${idStr}`
}

function formatDefaultSubtitle(mode: DrawerMode, label: string) {
  const meta = getEntityMetadata(label)
  const entityTitle = meta?.title ?? label.split('.').pop() ?? label

  switch (mode) {
    case 'create':
      return `Ingrese los datos del nuevo/a ${entityTitle.toLowerCase()}`
    case 'edit':
      return `Actualice la información de ${entityTitle.toLowerCase()}`
    case 'view':
      return `Detalle de ${entityTitle.toLowerCase()}`
  }
}

export function useDrawerIdentity(
  label: string,
  mode: DrawerMode,
  data?: DrawerIdentityData | null,
  options?: UseDrawerIdentityOptions,
) {
  const {
    feminine = false,
    subtitle: customSubtitle,
    customTitle,
  } = options ?? {}

  const title = customTitle ?? formatEntityTitle(label, mode, data, feminine)

  const subtitle = customSubtitle ?? formatDefaultSubtitle(mode, label)

  const IconComponent = getEntityIcon(label)

  return {
    title,
    subtitle,
    icon: IconComponent,
  }
}
