import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export function RegisterPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    setSubmitting(false)
    if (error) {
      toast.error('Не удалось создать аккаунт', { description: error.message })
      return
    }
    if (!data.session) {
      toast.success('Письмо с подтверждением отправлено', {
        description: 'Проверь почту и активируй аккаунт.',
      })
      navigate('/login', { replace: true })
      return
    }
    toast.success('Аккаунт создан', { description: 'Поехали строить миры.' })
    navigate('/worlds', { replace: true })
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/worlds' },
    })
    if (error) toast.error('Google OAuth недоступен', { description: error.message })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-normal">Создание аккаунта</h1>
        <p className="text-sm text-text-muted">Бесплатно. Без обязательств. Без рекламы.</p>
      </header>

      <Button variant="secondary" size="lg" className="w-full" onClick={handleGoogle}>
        Продолжить с Google
      </Button>

      <div className="relative flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] uppercase tracking-widest text-text-dim">или email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="display-name">Имя</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="Как тебя называть"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="мин. 6 символов"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Создаём…' : 'Создать аккаунт'}
        </Button>
      </form>

      <p className="text-sm text-center text-text-muted">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="text-brand hover:underline underline-offset-2">
          Войти
        </Link>
      </p>
    </div>
  )
}
