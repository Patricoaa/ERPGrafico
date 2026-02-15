import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Package } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

interface DynamicIconProps extends LucideProps {
  name: string
}

export const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  const iconName = name as keyof typeof dynamicIconImports

  const Icon = useMemo(() => {
    if (!dynamicIconImports[iconName]) return Package
    return dynamic(dynamicIconImports[iconName], {
      loading: () => <div className="animate-pulse bg-muted rounded-full" style={{ width: props.size || 24, height: props.size || 24 }} />
    })
  }, [iconName])

  return <Icon {...props} />
}
