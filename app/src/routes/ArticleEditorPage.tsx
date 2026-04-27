import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Pin, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CategoryBadge } from '@/features/articles/CategoryBadge'
import { ArticleEditor } from '@/features/articles/ArticleEditor'
import { RelationsPanel } from '@/features/relations/RelationsPanel'
import {
  deleteArticle,
  getArticle,
  listCategories,
  updateArticle,
} from '@/features/articles/api'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import type { Article, Category, Json } from '@/lib/database.types'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function ArticleEditorPage() {
  const { projectId, articleId } = useParams<{ projectId: string; articleId: string }>()
  const navigate = useNavigate()

  const [article, setArticle] = useState<Article | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const lastSavedAtRef = useRef<string | null>(null)

  // Load
  useEffect(() => {
    if (!articleId || !projectId) return
    let cancelled = false
    setLoading(true)
    Promise.all([getArticle(articleId), listCategories(projectId)])
      .then(([a, c]) => {
        if (cancelled) return
        setArticle(a)
        setCategories(c)
        lastSavedAtRef.current = a?.updated_at ?? null
      })
      .catch((err) => {
        if (cancelled) return
        toast.error('Не удалось загрузить статью', {
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [articleId, projectId])

  const persist = useCallback(
    async (patch: Parameters<typeof updateArticle>[1]) => {
      if (!articleId) return
      setSaveState('saving')
      try {
        const updated = await updateArticle(articleId, patch)
        setArticle(updated)
        lastSavedAtRef.current = updated.updated_at
        setSaveState('saved')
      } catch (err: unknown) {
        setSaveState('error')
        toast.error('Не удалось сохранить', {
          description: err instanceof Error ? err.message : 'Неизвестная ошибка',
        })
      }
    },
    [articleId],
  )

  const debouncedPersist = useDebouncedCallback(persist, 2000)

  function handleTitleChange(title: string) {
    if (!article) return
    setArticle({ ...article, title })
    setSaveState('dirty')
    debouncedPersist({ title })
  }

  function handleContentChange(content: Json) {
    if (!article) return
    setArticle({ ...article, content })
    setSaveState('dirty')
    debouncedPersist({ content })
  }

  async function handleCategoryChange(categoryId: string | null) {
    if (!article) return
    setArticle({ ...article, category_id: categoryId })
    await persist({ category_id: categoryId })
  }

  async function handleTogglePin() {
    if (!article) return
    await persist({ is_pinned: !article.is_pinned })
  }

  async function handleDelete() {
    if (!article || !projectId) return
    const ok = window.confirm(`Удалить статью «${article.title}»?`)
    if (!ok) return
    try {
      await deleteArticle(article.id)
      toast.success('Статья удалена')
      navigate(`/worlds/${projectId}/articles`)
    } catch (err: unknown) {
      toast.error('Не удалось удалить', {
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    }
  }

  const currentCategory = useMemo(
    () => categories.find((c) => c.id === article?.category_id) ?? null,
    [categories, article?.category_id],
  )

  if (loading) {
    return <div className="h-64 rounded-lg bg-bg-surface/40 animate-pulse" />
  }

  if (!article || !projectId) {
    return (
      <div className="text-center py-12 text-text-muted">
        Статья не найдена.{' '}
        <button
          className="text-brand hover:underline"
          onClick={() => navigate(`/worlds/${projectId}/articles`)}
        >
          К списку
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/worlds/${projectId}/articles`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Все статьи
          </Button>
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} updatedAt={lastSavedAtRef.current} />
            <Button
              variant={article.is_pinned ? 'primary' : 'ghost'}
              size="icon"
              onClick={handleTogglePin}
              aria-label={article.is_pinned ? 'Открепить' : 'Закрепить'}
              title={article.is_pinned ? 'Открепить' : 'Закрепить'}
            >
              <Pin className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Удалить">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Input
          value={article.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          maxLength={200}
          className="!h-auto !text-3xl font-serif font-medium !py-3 !px-4 bg-transparent border-transparent focus-visible:border-border-strong"
          placeholder="Название"
        />

        <div className="flex flex-wrap items-center gap-2">
          <CategorySelector
            categories={categories}
            value={article.category_id}
            onChange={handleCategoryChange}
            current={currentCategory}
          />
        </div>

        <ArticleEditor content={article.content} onChange={handleContentChange} />
      </div>

      <aside className="space-y-4">
        <RelationsPanel projectId={projectId} articleId={article.id} />
      </aside>
    </div>
  )
}

function SaveIndicator({ state, updatedAt }: { state: SaveState; updatedAt: string | null }) {
  const text =
    state === 'saving'
      ? 'Сохраняем…'
      : state === 'dirty'
        ? 'Изменения не сохранены'
        : state === 'error'
          ? 'Ошибка сохранения'
          : updatedAt
            ? `Сохранено ${formatRelativeTime(updatedAt)}`
            : 'Сохранено'

  const Icon =
    state === 'saving' ? Loader2 : state === 'error' ? Trash2 : state === 'dirty' ? Pin : Check
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        state === 'error' ? 'text-red-400' : 'text-text-dim',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', state === 'saving' && 'animate-spin')} />
      {text}
    </span>
  )
}

function CategorySelector({
  categories,
  value,
  onChange,
  current,
}: {
  categories: Category[]
  value: string | null
  onChange: (id: string | null) => void
  current: Category | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring rounded-full"
        aria-label="Сменить категорию"
      >
        <CategoryBadge category={current} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 z-30 rounded border border-border-strong bg-bg-surface p-2 shadow-xl min-w-[200px] flex flex-col gap-1">
          <CategoryRow
            label="без категории"
            color="#64748B"
            selected={value === null}
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          />
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              label={c.name}
              color={c.color}
              selected={value === c.id}
              onClick={() => {
                onChange(c.id)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  label,
  color,
  selected,
  onClick,
}: {
  label: string
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-sm transition-colors focus-ring',
        selected ? 'bg-bg-surface2 text-text' : 'text-text-muted hover:bg-bg-surface2 hover:text-text',
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
      {selected && <Check className="h-3.5 w-3.5 ml-auto text-brand" />}
    </button>
  )
}
