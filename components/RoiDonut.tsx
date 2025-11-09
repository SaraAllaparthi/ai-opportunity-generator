"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState, useRef } from 'react'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]
  const value = typeof data.value === 'number' ? new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(data.value) : data.value
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg">
      <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">{data.name}</p>
      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{value}</p>
    </div>
  )
}

export default function RoiDonut({ data }: { data: Brief }) {
  // Dynamically import recharts to avoid SSR issues
  const [R, setR] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFirstMount, setIsFirstMount] = useState(true)
  
  useEffect(() => { 
    setMounted(true)
    ;(async () => {
      const recharts = await import('recharts')
      setR(recharts)
    })() 
  }, [])

  // Measure container size and only render when we have valid dimensions
  useEffect(() => {
    if (!mounted) return
    
    let timeout: NodeJS.Timeout | null = null
    let resizeObserver: ResizeObserver | null = null
    
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height })
          console.log('[RoiDonut] Container measured:', rect.width, 'x', rect.height)
        } else {
          console.log('[RoiDonut] Container has zero size:', rect.width, 'x', rect.height)
        }
      } else {
        console.log('[RoiDonut] Container ref not set yet')
      }
    }
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      measure()
      // Also measure after a short delay
      timeout = setTimeout(measure, 200)
      
      // Set up resize observer if ref is available
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(containerRef.current)
      }
    })
    
    return () => {
      if (timeout) clearTimeout(timeout)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [mounted])

  // Mark first mount as complete after initial render
  useEffect(() => {
    if (containerSize && isFirstMount) {
      setIsFirstMount(false)
    }
  }, [containerSize, isFirstMount])

  // Normalize numeric values - handle currency strings, Swiss formatting, etc.
  const normalizeNum = (v: any): number => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
    
    if (typeof v === 'string') {
      // Strip currency symbols: CHF, €, $, £, ₣
      // Strip spaces: regular, thin spaces (\u202F), non-breaking spaces (\u00A0)
      // Strip thousand separators: apostrophes ('), commas (,), backticks (`)
      const cleaned = v
        .replace(/[A-Za-z€$£₣]|CHF/gi, '')
        .replace(/[\u202F\u00A0\s]/g, '') // thin/nb spaces + regular spaces
        .replace(/[''`,]/g, '')          // apostrophes & commas
        .trim()
      const n = Number(cleaned)
      return Number.isFinite(n) && n >= 0 ? n : 0
    }
    return 0
  }
  
  if (!data?.use_cases || data.use_cases.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="h-48 w-full" 
        style={{ width: '100%', height: '192px', minHeight: '192px' }}
      >
        <div className="text-sm text-gray-500 dark:text-gray-400">No use cases data available</div>
      </div>
    )
  }
  
  // Be tolerant to schema variants - check multiple possible field names
  const items = data.use_cases.map(u => ({ 
    name: u.title || 'Untitled', 
    value: normalizeNum(
      (u as any).est_annual_benefit ??
      (u as any).annual_benefit ??
      (u as any).benefit ??
      0
    )
  }))
  
  const COLORS = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed']
  
  // Filter out items with zero or invalid values
  const validItems = items.filter(item => item.value > 0)
  
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('[RoiDonut] Debug:', {
      useCasesCount: data.use_cases.length,
      rawValues: data.use_cases.map(u => ({ title: u.title, est_annual_benefit: u.est_annual_benefit })),
      normalizedItems: items,
      validItemsCount: validItems.length,
      validItems
    })
  }
  
  if (validItems.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="h-48 w-full" 
        style={{ width: '100%', height: '192px', minHeight: '192px' }}
      >
        <div className="flex flex-col items-center justify-center gap-2 h-full">
          <div className="text-sm text-gray-500 dark:text-gray-400">No ROI data available</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Tip: values like "CHF 100'000" must be numeric after parsing
          </div>
        </div>
      </div>
    )
  }

  // Debug: Log when recharts loads and check DOM
  useEffect(() => {
    if (R && validItems.length > 0) {
      console.log('[RoiDonut] Recharts loaded:', !!R.ResponsiveContainer, !!R.PieChart)
      console.log('[RoiDonut] Valid items for chart:', validItems)
      // Check DOM after a brief delay to see if SVG renders
      setTimeout(() => {
        const container = document.getElementById('roi-donut-container')
        const svg = container?.querySelector('svg')
        const wrapper = container?.querySelector('.recharts-wrapper')
        console.log('[RoiDonut] DOM check:', {
          container: !!container,
          containerDimensions: container ? container.getBoundingClientRect() : null,
          svg: !!svg,
          svgDimensions: svg ? svg.getBoundingClientRect() : null,
          rechartsWrapper: !!wrapper,
          wrapperDimensions: wrapper ? wrapper.getBoundingClientRect() : null
        })
      }, 500)
    }
  }, [R, validItems])

  if (!mounted || !R) {
    return (
      <div 
        ref={containerRef}
        className="h-48 w-full" 
        style={{ width: '100%', height: '192px', minHeight: '192px' }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart…</div>
        </div>
      </div>
    )
  }

  if (!R?.PieChart || !R?.Pie) {
    return (
      <div 
        ref={containerRef}
        className="h-48 w-full" 
        style={{ width: '100%', height: '192px', minHeight: '192px' }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart components…</div>
        </div>
      </div>
    )
  }

  // Prepare chart data - ensure all values are numbers
  const chartData = validItems.map(item => ({
    name: String(item.name || ''),
    value: Number(item.value) || 0
  })).filter(item => item.value > 0)

  if (chartData.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="h-48 w-full" 
        style={{ width: '100%', height: '192px', minHeight: '192px' }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-gray-500 dark:text-gray-400">No valid data to display</div>
        </div>
      </div>
    )
  }

  // Validate and ensure all values are positive numbers - strict validation
  const chartDataValidated = chartData.map(item => {
    let numValue: number
    if (typeof item.value === 'number' && Number.isFinite(item.value)) {
      numValue = item.value
    } else {
      numValue = Number(item.value)
    }
    
    // Ensure it's a valid positive number
    if (!Number.isFinite(numValue) || numValue <= 0 || isNaN(numValue)) {
      console.warn('[RoiDonut] Invalid value detected:', item.value, 'for item:', item.name)
      return null
    }
    
    return {
      name: String(item.name || ''),
      value: numValue
    }
  }).filter((item): item is { name: string; value: number } => item !== null && item.value > 0)

  if (chartDataValidated.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="h-48 w-full" 
        style={{ width: '100%', height: '192px', minHeight: '192px' }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-gray-500 dark:text-gray-400">No valid data to display</div>
        </div>
      </div>
    )
  }

  console.log('[RoiDonut] Final chart data:', JSON.stringify(chartDataValidated, null, 2))
  console.log('[RoiDonut] Data validation:', chartDataValidated.map(d => ({ name: d.name, value: d.value, type: typeof d.value, isNaN: isNaN(d.value) })))
  console.log('[RoiDonut] Container size:', containerSize)
  console.log('[RoiDonut] Ready to render:', { mounted, hasR: !!R, hasPieChart: !!R?.PieChart, hasContainerSize: !!containerSize })

  // Always render the container so ref gets set, then conditionally render chart
  const hasValidSize = containerSize && containerSize.width > 0 && containerSize.height > 0
  
  // Use fixed dimensions since we know the container is 474x192
  // Use explicit numbers for center to avoid any calculation issues
  return (
    <div 
      ref={containerRef}
      className="h-48 w-full flex items-center justify-center" 
      id="roi-donut-container"
      style={{ width: '100%', height: '192px', minHeight: '192px' }}
    >
      {!hasValidSize ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">Measuring container…</div>
        </div>
      ) : (
        <R.PieChart width={474} height={192} key={chartDataValidated.map(d => d.value).join('-')}>
          <R.Pie 
            data={chartDataValidated} 
            dataKey="value" 
            nameKey="name" 
            innerRadius={40} 
            outerRadius={70} 
            paddingAngle={2}
            isAnimationActive={!isFirstMount}
          >
            {chartDataValidated.map((item, i) => (
              <R.Cell key={`cell-${i}-${item.name}`} fill={COLORS[i % COLORS.length]} />
            ))}
          </R.Pie>
          <R.Tooltip content={<CustomTooltip />} />
        </R.PieChart>
      )}
    </div>
  )
}


