import * as React from 'react'
import { cn, initials } from '@/lib/utils'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
} as const

export const Avatar = ({ className, src, name, size = 'md', ...props }: AvatarProps) => (
  <div
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
      'bg-brand-gradient text-white font-semibold tracking-wider select-none',
      sizeMap[size],
      className,
    )}
    {...props}
  >
    {src ? (
      <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
    ) : (
      <span>{initials(name)}</span>
    )}
  </div>
)
