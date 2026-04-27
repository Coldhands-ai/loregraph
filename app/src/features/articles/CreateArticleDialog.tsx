import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createArticle } from './api'
import type { Category } from '@/lib/database.types'

interface CreateArticleDialogProps {
  projectId: string
  categories: Category[]
  trigger?: React.ReactNode
}

export function CreateArticleDialog({ projectId, categories, trigger }: CreateArticleDialogProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const article = await createArticle({
        projectId,
        title,
        categoryId: categoryId || null,
      })
      toast.success('Статья создана')
      setOpen(false)
      setTitle('')
      setCategoryId('')
      navigate(`/worlds/${projectId}/articles/${article.id}`)
    } catch (err: unknown) {
      toast.error('Не удалось создать статью', {
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            Новая статья
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Новая статья</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="article-title">Название</Label>
              <Input
                id="article-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                autoFocus
                placeholder="Имя персонажа, название локации, событие…"
              />
            </div>
            <div>
              <Label>Категория</Label>
              <div className="flex flex-wrap gap-2">
                <CategoryChip
                  selected={categoryId === ''}
                  onClick={() => setCategoryId('')}
                  color="#64748B"
                  label="без категории"
                />
                {categories.map((c) => (
                  <CategoryChip
                    key={c.id}
                    selected={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                    color={c.color}
                    label={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? 'Создаём…' : 'Создать и открыть'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CategoryChip({
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
        backgroundColor: selected ? color : `${color}1A`,
        borderColor: selected ? color : `${color}55`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected ? '#fff' : color }} />
      {label}
    </button>
  )
}
