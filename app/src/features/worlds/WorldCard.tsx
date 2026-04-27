import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Network, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '@/lib/utils'
import type { Project } from '@/lib/database.types'
import { deleteWorld, getWorldStats } from './api'

interface WorldCardProps {
  world: Project
  onDeleted: (id: string) => void
}

export function WorldCard({ world, onDeleted }: WorldCardProps) {
  const [stats, setStats] = useState({ articles: 0, relations: 0 })

  useEffect(() => {
    let cancelled = false
    getWorldStats(world.id).then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [world.id])

  async function handleDelete() {
    const ok = window.confirm(`Удалить мир «${world.title}»? Все статьи и связи исчезнут.`)
    if (!ok) return
    try {
      await deleteWorld(world.id)
      toast.success('Мир удалён')
      onDeleted(world.id)
    } catch (err: unknown) {
      toast.error('Не удалось удалить', {
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    }
  }

  return (
    <Card className="group relative overflow-hidden hover:border-brand/50 hover:bg-bg-surface/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(59,130,246,0.3)]">
      <Link to={`/worlds/${world.id}/articles`} className="block">
        {/* Decorative gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-brand-gradient opacity-0 group-hover:opacity-100 transition-opacity" />

        <CardHeader>
          <CardTitle className="line-clamp-1">{world.title}</CardTitle>
          {world.description && (
            <CardDescription className="line-clamp-2">{world.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-4 text-xs text-text-dim">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {stats.articles} {pluralizeArticles(stats.articles)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" />
              {stats.relations} {pluralizeRelations(stats.relations)}
            </span>
            <span className="ml-auto">обновлён {formatRelativeTime(world.updated_at)}</span>
          </div>
        </CardContent>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-3 right-3 rounded-sm p-1.5 text-text-dim opacity-0 group-hover:opacity-100 hover:bg-bg-surface2 hover:text-text transition-all focus-ring"
          onClick={(e) => e.stopPropagation()}
          aria-label="Меню мира"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleDelete} className="text-red-400">
            <Trash2 className="h-4 w-4" />
            Удалить мир
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  )
}

function pluralizeArticles(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'статья'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'статьи'
  return 'статей'
}

function pluralizeRelations(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'связь'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'связи'
  return 'связей'
}
