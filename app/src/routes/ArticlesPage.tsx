import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { ArticleCard } from '@/features/articles/ArticleCard'
import { CreateArticleDialog } from '@/features/articles/CreateArticleDialog'
import { listArticles, listCategories } from '@/features/articles/api'
import type { Article, Category } from '@/lib/database.types'

export function ArticlesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null) // category_id | null

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    Promise.all([listArticles(projectId), listCategories(projectId)])
      .then(([a, c]) => {
        if (cancelled) return
        setArticles(a)
        setCategories(c)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const filtered = useMemo(() => {
    let list = articles
    if (filter) list = list.filter((a) => a.category_id === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.title.toLowerCase().includes(q))
    }
    return list
  }, [articles, search, filter])

  if (!projectId) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию"
            className="pl-9"
          />
        </div>
        <div className="ml-auto">
          <CreateArticleDialog projectId={projectId} categories={categories} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip selected={filter === null} onClick={() => setFilter(null)} color="#94A3B8" label="Все" />
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            selected={filter === c.id}
            onClick={() => setFilter(c.id)}
            color={c.color}
            label={c.name}
          />
        ))}
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        articles.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Чистый лист"
            description="Это идеальный момент, чтобы записать первый кусок лора. Кто, где и зачем?"
            action={<CreateArticleDialog projectId={projectId} categories={categories} />}
          />
        ) : (
          <p className="text-text-muted text-sm py-8 text-center">
            По запросу «{search}» ничего не нашлось.
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              category={article.category_id ? categoryById.get(article.category_id) : undefined}
              to={`/worlds/${projectId}/articles/${article.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  selected,
  onClick,
  color,
  label,
}: {
  selected: boolean
  onClick: () => void
  color: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all focus-ring"
      style={{
        color: selected ? '#fff' : color,
        backgroundColor: selected ? color : 'transparent',
        borderColor: selected ? color : `${color}55`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected ? '#fff' : color }} />
      {label}
    </button>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-32 rounded-lg border border-border bg-bg-surface/40 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}
