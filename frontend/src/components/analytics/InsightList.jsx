import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import { Card } from '../ui'

const ICON = { good: [CheckCircle2, 'text-st-completed'], bad: [AlertTriangle, 'text-st-blocked'], neutral: [Lightbulb, 'text-primary'] }

/** Rule-based insights; each may link to the filtered list behind it via onOpen(filter). */
export function InsightList({ items, onOpen }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold">Insights</h3>
      <ul className="space-y-1.5">
        {items.map((i) => {
          const [Icon, cls] = ICON[i.tone] || ICON.neutral
          return (
            <li key={i.id} className="flex items-start gap-2 text-sm">
              <Icon size={16} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
              <span>{i.text}</span>
              {i.filter && onOpen && <button type="button" onClick={() => onOpen(i.filter)} className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline">View</button>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
