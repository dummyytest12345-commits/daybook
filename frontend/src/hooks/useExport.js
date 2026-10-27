import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAllTasks, useCtx } from './useData'
import { filterTasks } from '../selectors/filter'
import { inRange } from '../selectors/common'
import { exportCsv } from '../services/exporters/csv'
import { fileStem } from '../services/exporters/dataset'
import { toMarkdown } from '../services/exporters/markdown'
import { download } from '../utils/format'
import { presetRange } from '../utils/date'

export const TEMPLATES = {
  daily: { label: 'Daily report', preset: 'today', pdf: 'daily' },
  weekly: { label: 'Weekly report', preset: 'thisWeek', pdf: 'weekly' },
  monthly: { label: 'Monthly report', preset: 'thisMonth', pdf: 'monthly' },
  manager: { label: 'Manager summary', preset: 'thisMonth', pdf: 'manager' },
  custom: { label: 'Custom', preset: 'custom', pdf: 'daily' },
}
export const FORMATS = [
  ['xlsx', 'Excel (.xlsx)'], ['pdf', 'PDF'], ['csv', 'CSV'], ['md', 'Markdown (copy)'], ['txt', 'Plain text (copy)'], ['print', 'Print'],
]

/** Build the dataset for a range + filters, and generate/download in the chosen format. */
export function useExport({ range, filters, layout = 'daily', template = 'weekly', charts = false }) {
  const all = useAllTasks()
  const ctx = useCtx()
  const [busy, setBusy] = useState(false)
  const tasks = useMemo(() => filterTasks(inRange(all, range), filters, ctx), [all, range, filters, ctx])
  const full = useMemo(() => ({ ...ctx, allTasks: all }), [ctx, all])

  const generate = async (format) => {
    setBusy(true)
    try {
      const stem = fileStem(range)
      if (format === 'csv') download(exportCsv(tasks, range, ctx, { layout }), `${stem}.csv`)
      else if (format === 'xlsx') {
        const { exportXlsx } = await import('../services/exporters/xlsx')
        download(await exportXlsx(tasks, range, full), `${stem}.xlsx`)
      } else if (format === 'pdf') {
        const { exportPdf, nodesToImages } = await import('../services/exporters/pdf')
        const images = charts ? await nodesToImages([...document.querySelectorAll('#report-charts [data-chart-export]')]) : []
        download(await exportPdf(tasks, range, full, { title: TEMPLATES[template]?.label || 'Work Log', chartImages: images, template: TEMPLATES[template]?.pdf }), `${stem}.pdf`)
      } else if (format === 'md' || format === 'txt') {
        await navigator.clipboard.writeText(toMarkdown(tasks, range, ctx, { plain: format === 'txt' }))
        toast.success('Copied to clipboard')
        return
      } else if (format === 'print') {
        window.print()
        return
      }
      toast.success('Export ready')
    } catch (e) {
      toast.error(`Export failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }
  return { tasks, ctx, generate, busy }
}

export { presetRange }
