import { useEffect, useState } from 'react'
import { Globe2, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { CreateWorldDialog } from '@/features/worlds/CreateWorldDialog'
import { WorldCard } from '@/features/worlds/WorldCard'
import { listWorlds } from '@/features/worlds/api'
import type { Project } from '@/lib/database.types'

export function WorldsPage() {
  const { user } = useAuth()
  const [worlds, setWorlds] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listWorlds(user.id)
      .then((data) => {
        if (!cancelled) setWorlds(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function handleCreated(world: Project) {
    setWorlds((prev) => [world, ...prev])
  }

  function handleDeleted(id: string) {
    setWorlds((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-text-dim mb-2">Мои миры</p>
          <h1 className="font-serif text-4xl">Вселенные ждут</h1>
          <p className="mt-2 text-text-muted max-w-xl">
            Каждый мир — это самостоятельная вики со своими персонажами, локациями и графом
            связей.
          </p>
        </div>
        {worlds.length > 0 && <CreateWorldDialog onCreated={handleCreated} />}
      </header>

      {loading ? (
        <SkeletonGrid />
      ) : worlds.length === 0 ? (
        <EmptyState
          icon={<Globe2 className="h-8 w-8" />}
          title="Здесь пока пусто"
          description="Создай первый мир — мы сразу подкинем 5 готовых категорий, чтобы ты не начинал с чистого листа."
          action={
            <CreateWorldDialog
              onCreated={handleCreated}
              trigger={
                <Button size="lg">
                  <Sparkles className="h-4 w-4" />
                  Создать первый мир
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {worlds.map((world) => (
            <WorldCard key={world.id} world={world} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-40 rounded-lg border border-border bg-bg-surface/40 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}
