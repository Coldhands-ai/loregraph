import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border-strong p-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="rounded-full bg-bg-surface p-4 text-text-dim border border-border">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="font-serif text-xl font-medium text-text">{title}</h3>
        {description && <p className="text-sm text-text-muted max-w-md">{description}</p>}
      </div>
      {action}
    </div>
  )
}
