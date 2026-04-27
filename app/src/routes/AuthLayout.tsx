import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { BrandLogo } from '@/components/BrandLogo'
import { ConstellationBackground } from '@/components/ConstellationBackground'

export function AuthLayout() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/worlds" replace />

  return (
    <div className="min-h-screen flex">
      {/* Left: hero / brand */}
      <aside className="hidden lg:flex flex-1 relative overflow-hidden bg-auth-gradient items-center justify-center p-16">
        <ConstellationBackground className="absolute inset-0 w-full h-full opacity-50" />
        <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-brand/15 blur-3xl animate-drift" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-brand-violet/15 blur-3xl animate-drift" />

        <div className="relative z-10 max-w-md text-center space-y-6 animate-fade-in">
          <BrandLogo size="lg" />
          <p className="text-sm tracking-[0.3em] uppercase text-text-muted">
            Конструктор миров
          </p>
          <h1 className="font-serif text-4xl leading-tight text-text">
            Сплети свою вселенную в&nbsp;живой граф связей
          </h1>
          <p className="text-text-muted leading-relaxed">
            Персонажи, локации, события и фракции — превращаются в&nbsp;интерактивную карту,
            где видно каждую нить сюжета.
          </p>
        </div>
      </aside>

      {/* Right: form */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden mb-10 text-center">
            <BrandLogo size="md" />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
