import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Package } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

// Helper to convert PascalCase/camelCase to kebab-case
const toKebabCase = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

interface DynamicIconProps extends LucideProps {
  name: string
}

const iconCache = new Map<string, React.LazyExoticComponent<React.ComponentType<any>>>()

const LoadingFallback = () => <div className="animate-pulse bg-muted rounded-full" style={{ width: 24, height: 24 }} />

const getIconComponent = (iconName: keyof typeof dynamicIconImports) => {
  if (!iconCache.has(iconName)) {
    iconCache.set(iconName, dynamic(dynamicIconImports[iconName], {
      loading: LoadingFallback
    }) as any)
  }
  return iconCache.get(iconName)!
}

export const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  const iconName = name ? toKebabCase(name) as keyof typeof dynamicIconImports : undefined

  // useMemo MUST be called before any conditional return (rules-of-hooks)
  const IconComponent = useMemo(
    () => (iconName && dynamicIconImports[iconName] ? getIconComponent(iconName) : null),
    [iconName]
  )

  if (!IconComponent) {
    return <Package {...props} />
  }

  // Render through a stable intermediary to avoid "component created during render"
  return React.createElement(IconComponent, props)
}
