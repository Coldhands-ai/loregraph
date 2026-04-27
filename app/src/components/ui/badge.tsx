import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string
}

export const Badge = ({ className, color, style, children, ...props }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
      className,
    )}
    style={
      color
        ? {
            color,
            backgroundColor: `${color}1A`,
            borderColor: `${color}55`,
            ...style,
          }
        : style
    }
    {...props}
  >
    {color && (
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    )}
    {children}
  </span>
)
