import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { createWorld } from './api'
import type { Project } from '@/lib/database.types'

interface CreateWorldDialogProps {
  trigger?: React.ReactNode
  onCreated?: (world: Project) => void
}

export function CreateWorldDialog({ trigger, onCreated }: CreateWorldDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitle('')
    setDescription('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    try {
      const world = await createWorld({ title, description }, user.id)
      toast.success('Мир создан', { description: 'Категории уже на месте — можно писать статьи.' })
      onCreated?.(world)
      reset()
      setOpen(false)
    } catch (err: unknown) {
      toast.error('Не удалось создать мир', {
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
          <Button size="lg">
            <Sparkles className="h-4 w-4" />
            Новый мир
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Новый мир</DialogTitle>
            <DialogDescription>
              Каждый мир получит 5 предустановленных категорий: персонаж, локация, событие, предмет,
              фракция.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="world-title">Название</Label>
              <Input
                id="world-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={100}
                autoFocus
                placeholder="Например, «Северные королевства»"
              />
            </div>
            <div>
              <Label htmlFor="world-desc">Описание (опционально)</Label>
              <Textarea
                id="world-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="О чём этот мир, чего ждать читателю"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? 'Создаём…' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
