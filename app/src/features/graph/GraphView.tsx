import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import type { Article, Category, Relation } from '@/lib/database.types'

interface GraphNode {
  id: string
  title: string
  color: string
  category: string
  isPinned: boolean
}

interface GraphLink {
  source: string
  target: string
  label: string
}

interface GraphViewProps {
  projectId: string
  articles: Article[]
  relations: Relation[]
  categories: Category[]
  visibleCategoryIds: Set<string | 'none'>
  focusNodeId?: string | null
  onSelectNode?: (article: Article | null) => void
}

export function GraphView({
  projectId,
  articles,
  relations,
  categories,
  visibleCategoryIds,
  focusNodeId,
  onSelectNode,
}: GraphViewProps) {
  const navigate = useNavigate()
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ width: Math.floor(r.width), height: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const data = useMemo(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]))
    const visible = new Set<string>()
    const nodes: GraphNode[] = articles
      .filter((a) => {
        const key = a.category_id ?? 'none'
        return visibleCategoryIds.has(key)
      })
      .map((a) => {
        const cat = a.category_id ? categoryById.get(a.category_id) : null
        visible.add(a.id)
        return {
          id: a.id,
          title: a.title,
          color: cat?.color ?? '#64748B',
          category: cat?.name ?? 'без категории',
          isPinned: a.is_pinned,
        }
      })
    const links: GraphLink[] = relations
      .filter((r) => visible.has(r.source_article_id) && visible.has(r.target_article_id))
      .map((r) => ({
        source: r.source_article_id,
        target: r.target_article_id,
        label: r.label,
      }))
    return { nodes, links }
  }, [articles, relations, categories, visibleCategoryIds])

  // Focus on a specific node
  useEffect(() => {
    if (!focusNodeId || !fgRef.current) return
    const node = data.nodes.find((n) => n.id === focusNodeId)
    if (!node) return
    const fg = fgRef.current
    setTimeout(() => {
      type Positioned = GraphNode & { x?: number; y?: number }
      const pos = node as Positioned
      if (pos.x !== undefined && pos.y !== undefined) {
        fg.centerAt(pos.x, pos.y, 800)
        fg.zoom(2.5, 800)
      }
    }, 200)
  }, [focusNodeId, data.nodes])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-220px)] min-h-[480px] rounded-lg border border-border bg-bg-surface/30 overflow-hidden"
    >
      <ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={6}
        nodeLabel={(n) => (n as GraphNode).title}
        linkLabel={(l) => (l as GraphLink).label}
        linkColor={() => 'rgba(148,163,184,0.35)'}
        linkWidth={1}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleColor={() => '#3B82F6'}
        cooldownTicks={120}
        onNodeClick={(node) => {
          const n = node as GraphNode
          const article = articles.find((a) => a.id === n.id) ?? null
          onSelectNode?.(article)
        }}
        onNodeRightClick={(node) => {
          const n = node as GraphNode
          navigate(`/worlds/${projectId}/articles/${n.id}`)
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNode & { x?: number; y?: number }
          if (n.x === undefined || n.y === undefined) return
          const radius = n.isPinned ? 7 : 5

          // Glow
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 3)
          grd.addColorStop(0, n.color + 'AA')
          grd.addColorStop(1, n.color + '00')
          ctx.fillStyle = grd
          ctx.beginPath()
          ctx.arc(n.x, n.y, radius * 3, 0, Math.PI * 2)
          ctx.fill()

          // Node
          ctx.fillStyle = n.color
          ctx.beginPath()
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#0B0F1A'
          ctx.lineWidth = 1.5
          ctx.stroke()

          // Label (hide at small zoom for clarity)
          if (globalScale > 1.2) {
            const fontSize = 10 / globalScale + 2
            ctx.font = `${fontSize}px 'Space Grotesk', sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillStyle = '#F1F5F9'
            ctx.fillText(n.title, n.x, n.y + radius + 2)
          }
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GraphNode & { x?: number; y?: number }
          if (n.x === undefined || n.y === undefined) return
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(n.x, n.y, 8, 0, Math.PI * 2)
          ctx.fill()
        }}
      />
    </div>
  )
}
