import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchArticles } from '@/features/articles/api'
import { useDebouncedValue } from '@/hooks/useDebounce'
import { createRelation } from './api'
import { cn } from '@/lib/utils'

const COMMON_LABELS = ['друг', 'враг', 'владеет', 'находится в', 'участвовал в', 'родитель', 'союзник']

interface AddRelationDialogProps {
  projectId: string
  fromArticleId: string
  onCreated: () => void
}

export function AddRelationDialog({ projectId, fromArticleId, onCreated }: AddRelationDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null)
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 200)
  const [matches, setMatches] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (!open || !debouncedSearch.trim()) {
      setMatches([])
      return
    }
    let cancelled = false
    searchArticles(projectId, debouncedSearch).then((res) => {
      if (cancelled) return
      setMatches(res.filter((a) => a.id !== fromArticleId))
    })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, projectId, fromArticleId, open])

  function reset() {
    setSearch('')
    setTarget(null)
    setLabel('')
    setMatches([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target || !label.trim()) return
    setSubmitting(true)
    try {
      await createRelation({
        projectId,
        sourceArticleId: fromArticleId,
        targetArticleId: target.id,
        label,
      })
      toast.success('Связь добавлена')
      reset()
      setOpen(false)
      onCreated()
    } catch (err: unknown) {
      toast.error('Не удалось добавить', {
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4" />
          Добавить связь
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Новая связь</DialogTitle>
            <DialogDescription>
              Связь направлена: эта статья → выбранная. На графе показывается двусторонне.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Связать со статьёй</Label>
              {target ? (
                <div className="flex items-center justify-between gap-2 rounded-sm border border-brand/40 bg-brand/10 px-3 py-2">
                  <span className="text-sm font-medium text-text">{target.title}</span>
                  <button
                    type="button"
                    onClick={() => setTarget(null)}
                    className="text-xs text-text-muted hover:text-text"
                  >
                    сменить
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Начни вводить название…"
                  />
                  {matches.length > 0 && (
                    <ul className="mt-2 max-h-56 overflow-auto rounded-sm border border-border bg-bg-surface divide-y divide-border">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => setTarget(m)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm transition-colors',
                              'hover:bg-bg-surface2',
                            )}
                          >
                            {m.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {debouncedSearch.trim() && matches.length === 0 && (
                    <p className="mt-2 text-xs text-text-dim">Ничего не найдено</p>
                  )}
                </>
              )}
            </div>

            <div>
              <Label>Тип связи</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="напр. «друг», «владеет», «находится в»"
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COMMON_LABELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLabel(l)}
                    className="text-xs text-text-dim hover:text-brand transition-colors px-2 py-0.5 rounded-sm hover:bg-bg-surface2"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting || !target || !label.trim()}>
              {submitting ? 'Создаём…' : 'Создать связь'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
