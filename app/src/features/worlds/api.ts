import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/database.types'

export async function listWorlds(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface CreateWorldInput {
  title: string
  description?: string
}

export async function createWorld(input: CreateWorldInput, userId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteWorld(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
}

export async function getWorldStats(projectId: string) {
  const [articles, relations] = await Promise.all([
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('relations').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
  ])
  return {
    articles: articles.count ?? 0,
    relations: relations.count ?? 0,
  }
}
