import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Supabase env-переменные не заданы. Создай app/.env.local на основе .env.example.',
  )
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // No-op lock: обходит Web Locks API. Без этого supabase-js может вечно
    // ждать освобождения межвкладочного лока (типичный «висяк» на Chrome
    // после крэша вкладки/HMR-перезагрузки). Безопасно, пока приложение
    // работает в одной вкладке.
    lock: async (_name, _timeout, fn) => fn(),
  },
})
