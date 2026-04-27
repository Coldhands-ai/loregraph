import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadProfile = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[auth] loadProfile failed', error)
      setProfile(null)
      return
    }
    setProfile(data ?? null)
  }, [])

  React.useEffect(() => {
    let active = true

    // Watchdog: если сетевой запрос подвиснет (HTTP/2-стак, DNS, прокси...),
    // через 5 сек разблокируем UI вместо вечного экрана загрузки.
    const watchdog = setTimeout(() => {
      if (!active) return
      console.warn('[auth] init watchdog: forcing loading=false after 5s')
      setLoading(false)
    }, 5000)

    async function init() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        setSession(data.session)
        if (data.session?.user) await loadProfile(data.session.user.id)
      } catch (err) {
        console.error('[auth] init failed', err)
      } finally {
        clearTimeout(watchdog)
        if (active) setLoading(false)
      }
    }
    void init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        try {
          await loadProfile(newSession.user.id)
        } catch (err) {
          console.error('[auth] profile reload failed', err)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = React.useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
