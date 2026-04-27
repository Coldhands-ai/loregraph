import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Network, Search } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GraphView } from '@/features/graph/GraphView'
import { listArticles, listCategories } from '@/features/articles/api'
import { listRelationsForProject } from '@/features/relations/api'
import { useDebouncedValue } from '@/hooks/useDebounce'
import type { Article, Category, Relation } from '@/lib/database.types'

export function GraphPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [articles, setArticles] = useState<Article[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Article | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    Promise.all([
      listArticles(projectId),
      listRelationsForProject(projectId),
      listCategories(projectId),
    ])
      .then(([a, r, c]) => {
        if (cancelled) return
        setArticles(a)
        setRelations(r)
        setCategories(c)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const visibleCategoryIds = useMemo(() => {
    const all = new Set<string | 'none'>(['none', ...categories.map((c) => c.id)])
    hidden.forEach((id) => all.delete(id))
    return all
  }, [categories, hidden])

  function toggleCategory(id: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const debouncedSearch = useDebouncedValue(search, 200)
  const focusNodeId = useMemo(() => {
    if (!debouncedSearch.trim()) return null
    const q = debouncedSearch.toLowerCase()
    const found = articles.find((a) => a.title.toLowerCase().includes(q))
    return found?.id ?? null
  }, [debouncedSearch, articles])

  if (!projectId) return null

  if (loading) {
    return (
      <div className="h-[calc(100vh-220px)] min-h-[480px] rounded-lg bg-bg-surface/30 animate-pulse" />
    )
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="Пока нечего отображать"
        description="Граф появится, как только в мире будут статьи и связи между ними."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти узел и сфокусироваться"
              className="pl-9"
            />
          </div>
          <div className="text-xs text-text-dim ml-auto">
            ЛКМ — выбрать · ПКМ — открыть
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPill
            color="#94A3B8"
            label="без категории"
            active={!hidden.has('none')}
            onClick={() => toggleCategory('none')}
          />
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              color={c.color}
              label={c.name}
              active={!hidden.has(c.id)}
              onClick={() => toggleCategory(c.id)}
            />
          ))}
        </div>

        <GraphView
          projectId={projectId}
          articles={articles}
          relations={relations}
          categories={categories}
          visibleCategoryIds={visibleCategoryIds}
          focusNodeId={focusNodeId}
          onSelectNode={setSelected}
        />
      </div>

      <aside>
        <NodePreview projectId={projectId} article={selected} categories={categories} />
      </aside>
    </div>
  )
}

function FilterPill({
  color,
  label,
  active,
  onClick,
}: {
  color: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all focus-ring"
      style={{
        color: active ? color : '#475569',
        backgroundColor: active ? `${color}1A` : 'transparent',
        borderColor: active ? `${color}55` : 'rgba(255,255,255,0.08)',
        opacity: active ? 1 : 0.55,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? color : '#475569' }} />
      {label}
    </button>
  )
}

function NodePreview({
  projectId,
  article,
  categories,
}: {
  projectId: string
  article: Article | null
  categories: Category[]
}) {
  if (!article) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-text-muted text-center">
        Кликни на узел, чтобы увидеть его карточку.
      </div>
    )
  }
  const cat = categories.find((c) => c.id === article.category_id)
  return (
    <div className="rounded-lg border border-border bg-bg-surface/60 p-5 space-y-3 animate-fade-in sticky top-20">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: cat?.color ?? '#64748B' }}
        />
        <span
          className="text-xs uppercase tracking-wider font-medium"
          style={{ color: cat?.color ?? '#94A3B8' }}
        >
          {cat?.name ?? 'без категории'}
        </span>
      </div>
      <h3 className="font-serif text-2xl font-medium leading-tight">{article.title}</h3>
      {article.summary && <p className="text-sm text-text-muted leading-relaxed">{article.summary}</p>}
      <Button asChild className="w-full" size="sm">
        <Link to={`/worlds/${projectId}/articles/${article.id}`}>
          Открыть статью
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
