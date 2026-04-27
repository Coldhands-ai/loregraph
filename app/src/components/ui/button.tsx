import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-gradient text-white shadow-[0_4px_16px_-4px_rgba(59,130,246,0.5)] hover:shadow-[0_8px_24px_-4px_rgba(59,130,246,0.6)] hover:-translate-y-px',
        secondary:
          'bg-bg-surface text-text border border-border-strong hover:bg-bg-surface2 hover:border-brand/60',
        outline:
          'bg-transparent text-text border border-border-strong hover:bg-bg-surface hover:border-brand/60',
        ghost: 'bg-transparent text-text-muted hover:bg-bg-surface hover:text-text',
        destructive:
          'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50',
        link: 'text-brand underline-offset-4 hover:underline px-0 py-0',
      },
      size: {
        sm: 'h-8 px-3 text-xs tracking-wide',
        md: 'h-10 px-4 text-sm tracking-wide',
        lg: 'h-12 px-6 text-sm tracking-wider',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { buttonVariants }
