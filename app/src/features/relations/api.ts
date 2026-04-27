import { supabase } from '@/lib/supabase'
import type { Relation } from '@/lib/database.types'

export interface RelationWithEnds extends Relation {
  source: { id: string; title: string; category_id: string | null }
  target: { id: string; title: string; category_id: string | null }
}

export async function listRelationsForArticle(articleId: string): Promise<RelationWithEnds[]> {
  const { data, error } = await supabase
    .from('relations')
    .select(
      `*,
       source:articles!relations_source_article_id_fkey(id,title,category_id),
       target:articles!relations_target_article_id_fkey(id,title,category_id)`,
    )
    .or(`source_article_id.eq.${articleId},target_article_id.eq.${articleId}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as RelationWithEnds[]
}

export async function listRelationsForProject(projectId: string): Promise<Relation[]> {
  const { data, error } = await supabase
    .from('relations')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw error
  return data ?? []
}

export interface CreateRelationInput {
  projectId: string
  sourceArticleId: string
  targetArticleId: string
  label: string
  description?: string | null
}

export async function createRelation(input: CreateRelationInput): Promise<Relation> {
  const { data, error } = await supabase
    .from('relations')
    .insert({
      project_id: input.projectId,
      source_article_id: input.sourceArticleId,
      target_article_id: input.targetArticleId,
      label: input.label.trim(),
      description: input.description?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteRelation(relationId: string): Promise<void> {
  const { error } = await supabase.from('relations').delete().eq('id', relationId)
  if (error) throw error
}
