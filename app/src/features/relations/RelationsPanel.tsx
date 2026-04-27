import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Network, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { AddRelationDialog } from './AddRelationDialog'
import { deleteRelation, listRelationsForArticle, type RelationWithEnds } from './api'

interface RelationsPanelProps {
  projectId: string
  articleId: string
}

export function RelationsPanel({ projectId, articleId }: RelationsPanelProps) {
  const [relations, setRelations] = useState<RelationWithEnds[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listRelationsForArticle(articleId)
      setRelations(list)
    } catch (err: unknown) {
      toast.error('Не удалось загрузить связи', {
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleDelete(id: string) {
    try {
      await deleteRelation(id)
      setRelations((prev) => prev.filter((r) => r.id !== id))
    } catch (err: unknown) {
      toast.error('Не удалось удалить', {
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-3">
          <Network className="h-4 w-4 text-brand" />
          <CardTitle className="text-base font-sans font-semibold uppercase tracking-wider">
            Связи
          </CardTitle>
          <span className="ml-auto text-xs text-text-dim">{relations.length}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 rounded-sm bg-bg-surface2/60 animate-pulse" />
            ))}
          </div>
        ) : relations.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            Пока ни одной связи. Свяжи эту статью с другими — и&nbsp;граф оживёт.
          </p>
        ) : (
          <ul className="space-y-1.5 mb-3">
            {relations.map((r) => {
              const outgoing = r.source_article_id === articleId
              const other = outgoing ? r.target : r.source
              return (
                <li
                  key={r.id}
                  className="group flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-bg-surface2/80 transition-colors"
                >
                  {outgoing ? (
                    <ArrowRight className="h-3 w-3 text-brand shrink-0" />
                  ) : (
                    <ArrowLeft className="h-3 w-3 text-brand-violet shrink-0" />
                  )}
                  <Link
                    to={`/worlds/${projectId}/articles/${other.id}`}
                    className="text-sm font-medium text-text hover:text-brand transition-colors line-clamp-1 flex-1"
                  >
                    {other.title}
                  </Link>
                  <span className="text-xs text-text-dim shrink-0 italic">{r.label}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-red-400 transition-all focus-ring rounded-sm p-0.5"
                    aria-label="Удалить связь"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <AddRelationDialog
          projectId={projectId}
          fromArticleId={articleId}
          onCreated={() => void refresh()}
        />
      </CardHeader>
    </Card>
  )
}
