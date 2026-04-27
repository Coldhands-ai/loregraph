import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  asLink?: boolean
  className?: string
}

const sizes = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
} as const

export function BrandLogo({ size = 'md', asLink = false, className }: BrandLogoProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-2 font-bold tracking-tight', sizes[size], className)}>
      <LogoMark className={size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-6 w-6' : 'h-5 w-5'} />
      <span>
        <span className="gradient-text">Lore</span>
        <span className="text-text">Graph</span>
      </span>
    </span>
  )

  if (asLink) return <Link to="/">{content}</Link>
  return content
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <circle cx="6" cy="6" r="3" fill="url(#logo-grad)" />
      <circle cx="26" cy="10" r="3" fill="url(#logo-grad)" />
      <circle cx="16" cy="22" r="3" fill="url(#logo-grad)" />
      <circle cx="6" cy="26" r="2" fill="#6366F1" opacity="0.6" />
      <path
        d="M6 6 L16 22 M26 10 L16 22 M6 6 L26 10 M6 26 L16 22"
        stroke="url(#logo-grad)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}
