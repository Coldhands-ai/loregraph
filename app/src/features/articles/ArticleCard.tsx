import { Link } from 'react-router-dom'
import { Pin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryBadge } from './CategoryBadge'
import { formatRelativeTime } from '@/lib/utils'
import type { Article, Category } from '@/lib/database.types'

interface ArticleCardProps {
  article: Article
  category?: Category
  to: string
}

export function ArticleCard({ article, category, to }: ArticleCardProps) {
  return (
    <Card className="group hover:border-brand/50 hover:bg-bg-surface/80 transition-all hover:-translate-y-0.5">
      <Link to={to} className="block">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <CardTitle className="line-clamp-1 flex-1">{article.title}</CardTitle>
            {article.is_pinned && (
              <Pin className="h-3.5 w-3.5 text-brand mt-1 shrink-0" aria-label="Закреплено" />
            )}
          </div>
          {article.summary && (
            <p className="mt-2 text-sm text-text-muted line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <CategoryBadge category={category} />
          <span className="text-xs text-text-dim">{formatRelativeTime(article.updated_at)}</span>
        </CardContent>
      </Link>
    </Card>
  )
}
