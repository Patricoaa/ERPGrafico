import { icons, Package } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

interface DynamicIconProps extends LucideProps {
  name: string
}

export const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  const Icon = icons[name as keyof typeof icons] || Package
  return <Icon {...props} />
}
