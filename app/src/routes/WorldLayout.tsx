import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FileText, Network } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function WorldLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const segment = location.pathname.split('/')[3] ?? 'articles' // 'articles' | 'graph'
  const tab = segment === 'graph' ? 'graph' : 'articles'

  function handleChange(value: string) {
    navigate(`/worlds/${projectId}/${value}`)
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="articles">
            <FileText className="h-4 w-4" />
            Статьи
          </TabsTrigger>
          <TabsTrigger value="graph">
            <Network className="h-4 w-4" />
            Граф связей
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Outlet />
    </div>
  )
}
