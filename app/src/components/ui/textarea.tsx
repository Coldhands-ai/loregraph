import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[88px] w-full rounded-sm border border-border-strong bg-bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim leading-6 transition-colors resize-y',
        'focus-visible:outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
