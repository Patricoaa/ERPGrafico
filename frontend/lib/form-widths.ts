import type { VariantProps } from "class-variance-authority"
import { dialogContentVariants } from "@/components/ui/dialog"

export type BaseModalSize = NonNullable<VariantProps<typeof dialogContentVariants>["size"]>

export type FormComplexity = "micro" | "simple" | "medium" | "complex" | "master"

const DRAWER_BASE: Record<FormComplexity, string> = {
  micro: "25%",
  simple: "30%",
  medium: "40%",
  complex: "50%",
  master: "75%",
}

const DRAWER_WITH_SIDEBAR: Record<FormComplexity, string> = {
  micro: "40%",
  simple: "45%",
  medium: "55%",
  complex: "65%",
  master: "90%",
}

const MODAL_BASE: Record<FormComplexity, BaseModalSize> = {
  micro: "xs",
  simple: "sm",
  medium: "md",
  complex: "lg",
  master: "xl",
}

const MODAL_NEXT_TIER: Record<BaseModalSize, BaseModalSize> = {
  default: "sm",
  xs: "sm",
  sm: "md",
  md: "lg",
  lg: "xl",
  xl: "2xl",
  "2xl": "full",
  full: "full",
}

export function formDrawerWidth(complexity: FormComplexity, hasSidebar: boolean): string {
  return hasSidebar ? DRAWER_WITH_SIDEBAR[complexity] : DRAWER_BASE[complexity]
}

export function formModalSize(complexity: FormComplexity, hasSidebar: boolean): BaseModalSize {
  const base = MODAL_BASE[complexity]
  return hasSidebar ? MODAL_NEXT_TIER[base] : base
}
