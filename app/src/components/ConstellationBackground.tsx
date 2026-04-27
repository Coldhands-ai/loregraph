import { useMemo } from 'react'

interface Node {
  cx: number
  cy: number
  r: number
  delay: number
}

interface ConstellationBackgroundProps {
  nodeCount?: number
  className?: string
}

/**
 * Декоративный «звёздно-графовый» фон для авторизации и пустых состояний.
 * Узлы и линии генерируются один раз с детерминированным сидом.
 */
export function ConstellationBackground({
  nodeCount = 14,
  className,
}: ConstellationBackgroundProps) {
  const { nodes, links } = useMemo(() => buildGraph(nodeCount), [nodeCount])

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="100" y2="100">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <g opacity="0.55">
        {links.map((link, i) => (
          <line
            key={i}
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            stroke="url(#bg-grad)"
            strokeWidth="0.15"
            opacity="0.5"
          />
        ))}
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.cx}
            cy={n.cy}
            r={n.r}
            fill="url(#bg-grad)"
            className="animate-pulse-glow"
            style={{ animationDelay: `${n.delay}s`, transformOrigin: `${n.cx}px ${n.cy}px` }}
          />
        ))}
      </g>
    </svg>
  )
}

// Mulberry32 — детерминированный PRNG, без деп.
function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildGraph(count: number) {
  const rand = mulberry32(42)
  const nodes: Node[] = Array.from({ length: count }, () => ({
    cx: 6 + rand() * 88,
    cy: 6 + rand() * 88,
    r: 0.4 + rand() * 0.7,
    delay: rand() * 4,
  }))
  const links: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].cx - nodes[j].cx
      const dy = nodes[i].cy - nodes[j].cy
      if (Math.hypot(dx, dy) < 28) {
        links.push({ x1: nodes[i].cx, y1: nodes[i].cy, x2: nodes[j].cx, y2: nodes[j].cy })
      }
    }
  }
  return { nodes, links }
}
