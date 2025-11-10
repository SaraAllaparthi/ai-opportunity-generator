"use client"
import { Brief } from '@/lib/schema/brief'
import { useMemo, useState, useEffect, useRef } from 'react'

const COLORS = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed']

// Tooltip component matching the design system
const Tooltip = ({ 
  name, 
  value, 
  x, 
  y 
}: { 
  name: string
  value: number
  x: number
  y: number
}) => {
  const formattedValue = new Intl.NumberFormat('en-CH', { 
    style: 'currency', 
    currency: 'CHF', 
    maximumFractionDigits: 0 
  }).format(value)
  
  return (
    <div 
      className="absolute pointer-events-none z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px'
      }}
    >
      <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">{name}</p>
      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{formattedValue}</p>
    </div>
  )
}

// Helper function to create SVG path for donut slice
function createDonutSlice(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  // Calculate all four corner points
  const x1 = centerX + outerRadius * Math.cos((startAngle - 90) * Math.PI / 180)
  const y1 = centerY + outerRadius * Math.sin((startAngle - 90) * Math.PI / 180)
  const x2 = centerX + outerRadius * Math.cos((endAngle - 90) * Math.PI / 180)
  const y2 = centerY + outerRadius * Math.sin((endAngle - 90) * Math.PI / 180)
  const x3 = centerX + innerRadius * Math.cos((endAngle - 90) * Math.PI / 180)
  const y3 = centerY + innerRadius * Math.sin((endAngle - 90) * Math.PI / 180)
  const x4 = centerX + innerRadius * Math.cos((startAngle - 90) * Math.PI / 180)
  const y4 = centerY + innerRadius * Math.sin((startAngle - 90) * Math.PI / 180)
  
  // Determine large arc flag
  const angleDiff = endAngle - startAngle
  const largeArc = Math.abs(angleDiff) > 180 ? 1 : 0
  
  // Build path: start at outer start -> outer arc -> line to inner -> inner arc back -> close
  return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  }
}

export default function RoiDonut({ data }: { data: Brief }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Normalize numeric values
  const normalizeNum = (v: any): number => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
    
    if (typeof v === 'string') {
      const cleaned = v
        .replace(/[A-Za-z€$£₣]|CHF/gi, '')
        .replace(/[\u202F\u00A0\s]/g, '')
        .replace(/[''`,]/g, '')
        .trim()
      const n = Number(cleaned)
      return Number.isFinite(n) && n >= 0 ? n : 0
    }
    return 0
  }
  
  // Prepare data - must be done before early returns
  const items = (data?.use_cases || []).map(u => ({ 
    name: u.title || 'Untitled', 
    value: normalizeNum(
      (u as any).est_annual_benefit ??
      (u as any).annual_benefit ??
      (u as any).benefit ??
      0
    )
  }))
  
  const validItems = items.filter(item => item.value > 0)
  const total = validItems.reduce((sum, item) => sum + item.value, 0)

  // Calculate pie chart segments - must be called before any early returns
  const chartData = useMemo(() => {
    if (validItems.length === 0) return []
    let currentAngle = 0
    return validItems.map((item, index) => {
      const percentage = item.value / total
      const angle = percentage * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle
      
      return {
        ...item,
        percentage,
        startAngle,
        endAngle,
        color: COLORS[index % COLORS.length]
      }
    })
  }, [validItems, total])
  
  if (!data?.use_cases || data.use_cases.length === 0) {
    return (
      <div className="h-48 w-full flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">No use cases data available</div>
      </div>
    )
  }
  
  if (validItems.length === 0) {
    return (
      <div className="h-48 w-full flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">No ROI data available</div>
      </div>
    )
  }

  const width = 400
  const height = 200
  const centerX = width / 2
  const centerY = height / 2
  const outerRadius = 80
  const innerRadius = 50

  if (!mounted) {
    return (
      <div className="h-48 w-full flex items-center justify-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart…</div>
      </div>
    )
  }

  const handleMouseMove = (e: React.MouseEvent<SVGPathElement>, index: number) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
    setHoveredIndex(index)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
    setTooltipPos(null)
  }

  return (
    <div className="h-48 w-full flex items-center justify-center relative">
      <svg 
        ref={svgRef}
        width={width} 
        height={height} 
        className="overflow-visible"
      >
        {chartData.map((segment, index) => {
          const path = createDonutSlice(centerX, centerY, outerRadius, innerRadius, segment.startAngle, segment.endAngle)
          const isHovered = hoveredIndex === index
          
          return (
            <path
              key={index}
              d={path}
              fill={segment.color}
              opacity={isHovered ? 0.8 : 1}
              stroke="white"
              strokeWidth={2}
              onMouseEnter={(e) => handleMouseMove(e, index)}
              onMouseMove={(e) => handleMouseMove(e, index)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            />
          )
        })}
      </svg>
      {hoveredIndex !== null && tooltipPos && (
        <Tooltip
          name={chartData[hoveredIndex].name}
          value={chartData[hoveredIndex].value}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
      )}
    </div>
  )
}
