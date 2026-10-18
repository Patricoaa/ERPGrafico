/**
 * Tipos compartidos para configuración de navegación canónica.
 * Single Source of Truth para títulos en: Riel, TopBar, Metadata SEO.
 */

export interface NavTabConfig {
  /** Valor único para matching programático */
  value: string
  /** Label visible en riel/sidebar */
  label: string
  /** HREF de navegación */
  href: string
  /** Nombre del icono Lucide */
  iconName: string
  /** Título en TopBar (PageHeader) */
  headerTitle: string
  /** Descripción en TopBar (PageHeader) */
  headerDescription: string
  /** Título completo para metadata SEO (incluye " | ERPGrafico") */
  metadataTitle: string
  /** Sub-tabs anidadas (opcional) */
  subTabs?: NavTabConfig[]
}

/** Configuración plana para headers que no usan tabs anidados */
export interface FlatNavConfig {
  value: string
  label: string
  headerTitle: string
  headerDescription: string
  metadataTitle: string
  iconName: string
}