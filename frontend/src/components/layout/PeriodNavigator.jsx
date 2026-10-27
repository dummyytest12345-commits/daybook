import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui'

/** Prev / today / next with the period label. */
export function PeriodNavigator({ period }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Period navigation">
      <Button size="icon" onClick={period.prev} aria-label="Previous period"><ChevronLeft size={16} /></Button>
      <Button onClick={period.today} disabled={period.isToday} aria-label="Jump to today">Today</Button>
      <Button size="icon" onClick={period.next} aria-label="Next period"><ChevronRight size={16} /></Button>
      <h2 className="ml-2 min-w-40 text-base font-semibold" aria-live="polite">{period.label}</h2>
    </div>
  )
}
