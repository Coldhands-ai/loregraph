export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_project_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_project_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_project_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      article_tags: {
        Row: { article_id: string; tag_id: string }
        Insert: { article_id: string; tag_id: string }
        Update: { article_id?: string; tag_id?: string }
        Relationships: []
      }
      article_versions: {
        Row: {
          article_id: string
          content: Json
          created_at: string
          id: string
          title: string
          version_number: number
        }
        Insert: {
          article_id: string
          content: Json
          created_at?: string
          id?: string
          title: string
          version_number: number
        }
        Update: {
          article_id?: string
          content?: Json
          created_at?: string
          id?: string
          title?: string
          version_number?: number
        }
        Relationships: []
      }
      articles: {
        Row: {
          category_id: string | null
          content: Json
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          project_id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          project_id: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          project_id?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: { article_id: string; created_at: string; id: string; user_id: string }
        Insert: { article_id: string; created_at?: string; id?: string; user_id: string }
        Update: { article_id?: string; created_at?: string; id?: string; user_id?: string }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_blocked: boolean
          last_sign_in: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_blocked?: boolean
          last_sign_in?: string | null
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_blocked?: boolean
          last_sign_in?: string | null
          role?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      relation_types: {
        Row: {
          color: string | null
          id: string
          is_directional: boolean
          name: string
          project_id: string
        }
        Insert: {
          color?: string | null
          id?: string
          is_directional?: boolean
          name: string
          project_id: string
        }
        Update: {
          color?: string | null
          id?: string
          is_directional?: boolean
          name?: string
          project_id?: string
        }
        Relationships: []
      }
      relations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          project_id: string
          source_article_id: string
          target_article_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          project_id: string
          source_article_id: string
          target_article_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          project_id?: string
          source_article_id?: string
          target_article_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: { created_at: string; id: string; name: string; project_id: string }
        Insert: { created_at?: string; id?: string; name: string; project_id: string }
        Update: { created_at?: string; id?: string; name?: string; project_id?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      owns_project: { Args: { p_project_id: string }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type Project = Tables<'projects'>
export type Category = Tables<'categories'>
export type Article = Tables<'articles'>
export type Relation = Tables<'relations'>
export type Tag = Tables<'tags'>
