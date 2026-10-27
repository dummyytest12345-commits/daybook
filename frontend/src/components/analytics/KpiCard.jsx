import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { Card } from '../ui'
import { cn } from '../../utils/format'

const TONE = { good: 'text-st-completed', bad: 'text-st-blocked', neutral: 'text-muted' }

/** KPI tile: value, sparkline, delta vs previous period coloured good/bad (with arrow, not colour alone). */
export function KpiCard({ label, value, unit, delta, format = (v) => v, spark, sparkKey }) {
  const Arrow = !delta || delta.direction === 'flat' ? Minus : delta.direction === 'up' ? ArrowUp : ArrowDown
  return (
    <Card className="p-3.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold leading-none">{value}{unit && <span className="ml-0.5 text-sm font-medium text-muted">{unit}</span>}</p>
        {spark && spark.length > 1 && (
          <div className="h-8 w-16" aria-hidden>
            <ResponsiveContainer><LineChart data={spark}><Line type="monotone" dataKey={sparkKey} stroke="#2a78d6" strokeWidth={1.75} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
          </div>
        )}
      </div>
      {delta && (
        <p className={cn('mt-2 inline-flex items-center gap-1 text-xs font-medium', TONE[delta.tone])}>
          <Arrow size={12} aria-hidden />
          <span>{delta.direction === 'flat' ? 'no change' : `${format(Math.abs(delta.delta))}`}</span>
          <span className="font-normal text-muted">vs prev</span>
          <span className="sr-only">{delta.tone === 'good' ? 'improvement' : delta.tone === 'bad' ? 'worse' : ''}</span>
        </p>
      )}
    </Card>
  )
}
