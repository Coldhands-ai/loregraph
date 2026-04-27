import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { BrandLogo } from '@/components/BrandLogo'
import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/database.types'

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const { projectId } = useParams<{ projectId?: string }>()
  const [currentProject, setCurrentProject] = useState<Project | null>(null)

  useEffect(() => {
    if (!projectId) {
      setCurrentProject(null)
      return
    }
    let cancelled = false
    supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCurrentProject(data)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="mx-auto max-w-[1400px] flex items-center gap-6 px-6 h-14">
          <BrandLogo asLink size="sm" />

          <nav className="flex items-center gap-1 text-sm">
            <CrumbLink to="/worlds">Миры</CrumbLink>
            {currentProject && (
              <>
                <span className="text-text-dim">/</span>
                <CrumbLink to={`/worlds/${currentProject.id}/articles`} accent>
                  {currentProject.title}
                </CrumbLink>
              </>
            )}
          </nav>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full focus-ring">
                <Avatar src={profile?.avatar_url} name={profile?.display_name ?? profile?.email} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {profile?.display_name ?? 'Без имени'}
                  <div className="mt-0.5 text-text-dim normal-case tracking-normal text-xs font-normal">
                    {profile?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <User className="h-4 w-4" />
                  Профиль (скоро)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut className="h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-8 animate-fade-in">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-text-dim">
        <Link to="/worlds" className="hover:text-text-muted transition-colors">
          LoreGraph · v0.1
        </Link>
      </footer>
    </div>
  )
}

function CrumbLink({
  to,
  children,
  accent = false,
}: {
  to: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `px-2.5 py-1 rounded-sm transition-colors ${
          isActive || accent
            ? 'text-text font-medium'
            : 'text-text-muted hover:text-text hover:bg-bg-surface'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
