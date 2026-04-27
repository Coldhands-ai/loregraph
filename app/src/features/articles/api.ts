import { supabase } from '@/lib/supabase'
import type { Article, Category, Json } from '@/lib/database.types'

export async function listCategories(projectId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listArticles(projectId: string): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('project_id', projectId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function searchArticles(
  projectId: string,
  query: string,
  limit = 8,
): Promise<Pick<Article, 'id' | 'title' | 'category_id'>[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, category_id')
    .eq('project_id', projectId)
    .ilike('title', `%${query.trim()}%`)
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getArticle(articleId: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .maybeSingle()
  if (error) throw error
  return data
}

export interface CreateArticleInput {
  projectId: string
  title: string
  categoryId?: string | null
}

export async function createArticle(input: CreateArticleInput): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      project_id: input.projectId,
      title: input.title.trim(),
      category_id: input.categoryId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export interface UpdateArticleInput {
  title?: string
  content?: Json
  summary?: string | null
  category_id?: string | null
  is_pinned?: boolean
}

export async function updateArticle(
  articleId: string,
  patch: UpdateArticleInput,
): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .update(patch)
    .eq('id', articleId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteArticle(articleId: string): Promise<void> {
  const { error } = await supabase.from('articles').delete().eq('id', articleId)
  if (error) throw error
}
