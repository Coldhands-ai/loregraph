import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/BrandLogo'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <BrandLogo size="md" />
        <p className="font-mono text-xs tracking-widest text-text-dim uppercase">404</p>
        <h1 className="font-serif text-4xl">Эта тропа никуда не ведёт</h1>
        <p className="text-text-muted">
          Узла, который ты ищешь, нет на графе. Возможно, его удалили — или он тебе приснился.
        </p>
        <Button asChild size="lg">
          <Link to="/worlds">Вернуться в миры</Link>
        </Button>
      </div>
    </div>
  )
}
