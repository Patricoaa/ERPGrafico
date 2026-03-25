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

export const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  const iconName = name ? toKebabCase(name) as keyof typeof dynamicIconImports : undefined

  const Icon = useMemo(() => {
    if (!iconName || !dynamicIconImports[iconName]) return Package
    return dynamic(dynamicIconImports[iconName], {
      loading: () => <div className="animate-pulse bg-muted rounded-full" style={{ width: props.size || 24, height: props.size || 24 }} />
    })
  }, [iconName, props.size])

  return <Icon {...props} />
}
