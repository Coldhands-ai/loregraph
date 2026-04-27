import { Badge } from '@/components/ui/badge'
import type { Category } from '@/lib/database.types'

export function CategoryBadge({ category }: { category?: Category | null }) {
  if (!category) {
    return <Badge color="#64748B">без категории</Badge>
  }
  return <Badge color={category.color}>{category.name}</Badge>
}
