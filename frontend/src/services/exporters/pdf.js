import { format } from 'date-fns'
import { summarize } from '../../selectors/summarize'
import { fmtHours, fmtPct } from '../../utils/format'
import { buildDailyRows, rangeText } from './dataset'

const STATUS_RGB = {
  completed: [220, 252, 231], in_progress: [254, 243, 199], pending: [226, 232, 240], blocked: [254, 226, 226],
}

/**
 * A4 landscape report: cover block, KPI strip, optional chart images, styled table
 * with repeating headers and page numbers. jsPDF is loaded on demand.
 * @param {{ title?: string, chartImages?: string[], template?: 'daily'|'weekly'|'monthly'|'manager' }} opts
 */
export async function exportPdf(tasks, range, ctx, { title = 'Work Log Report', chartImages = [], template = 'daily' } = {}) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const margin = 36

  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, W, 64, 'F')
  doc.setTextColor(255)
  doc.setFontSize(20).setFont('helvetica', 'bold').text(title, margin, 30)
  doc.setFontSize(10).setFont('helvetica', 'normal')
  doc.text(`${rangeText(range, ctx.settings.dateFormat)}   ·   Generated ${format(new Date(), 'd MMM yyyy, HH:mm')}`, margin, 48)

  const s = summarize(tasks, range, { ...ctx, allTasks: ctx.allTasks || tasks })
  const kpis = [
    ['Tasks', s.total], ['Completed', fmtPct(s.completionRate)], ['Hours', fmtHours(s.hours)],
    ['Utilisation', fmtPct(s.utilisation)], ['Blocked', s.blocked], ['Streak', `${s.streak}d`],
  ]
  const bw = (W - margin * 2) / kpis.length
  kpis.forEach(([k, v], i) => {
    const x = margin + i * bw
    doc.setDrawColor(226, 232, 240).setFillColor(248, 250, 252).roundedRect(x + 2, 78, bw - 4, 46, 6, 6, 'FD')
    doc.setTextColor(100, 116, 139).setFontSize(8).text(String(k).toUpperCase(), x + 10, 93)
    doc.setTextColor(15, 23, 42).setFontSize(16).setFont('helvetica', 'bold').text(String(v), x + 10, 114)
    doc.setFont('helvetica', 'normal')
  })

  let y = 140
  if (chartImages.length && template !== 'manager') {
    const cw = (W - margin * 2 - 12 * (chartImages.length - 1)) / chartImages.length
    chartImages.forEach((img, i) => {
      try {
        doc.addImage(img, 'PNG', margin + i * (cw + 12), y, cw, cw * 0.55)
      } catch {
        /* skip a chart that fails to embed */
      }
    })
    y += cw * 0.55 + 14
  }

  if (template !== 'manager') {
    const rows = buildDailyRows(tasks, range, ctx).filter((r) => r.count > 0 || r.dayType !== 'work')
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 36 },
      head: [['Sr', 'Date', 'Day', 'Tasks', '#', 'Hours', 'Status']],
      body: rows.map((r) => [r.sr, r.dateText, r.day, r.tasksText, r.count, fmtHours(r.hours), r.statusText]),
      styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 65 }, 2: { cellWidth: 70 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 28 }, 5: { cellWidth: 40 }, 6: { cellWidth: 70 } },
      showHead: 'everyPage',
      didParseCell: (d) => {
        if (d.section !== 'body') return
        const r = rows[d.row.index]
        if (r.dayType !== 'work') {
          d.cell.styles.fillColor = [241, 245, 249]
          d.cell.styles.textColor = [100, 116, 139]
          d.cell.styles.fontStyle = 'italic'
        } else if (d.column.index === 6 && STATUS_RGB[r.status]) d.cell.styles.fillColor = STATUS_RGB[r.status]
      },
    })
  } else {
    const highlights = [
      `${s.completed} of ${s.total} tasks completed (${fmtPct(s.completionRate)}).`,
      `${fmtHours(s.hours)} of ${fmtHours(s.capacity)} hours logged (${fmtPct(s.utilisation)} utilisation).`,
      `${s.blocked} blocked, ${s.inProgress} in progress, ${s.pending} pending.`,
      `Average ${s.avgTasksPerDay} tasks per working day; current streak ${s.streak} days.`,
    ]
    doc.setTextColor(15, 23, 42).setFontSize(12).setFont('helvetica', 'bold').text('Highlights', margin, y + 10)
    doc.setFont('helvetica', 'normal').setFontSize(11)
    highlights.forEach((h, i) => doc.text(`•  ${h}`, margin + 6, y + 32 + i * 20))
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(100, 116, 139)
    doc.text(`Page ${i} of ${pages}`, W - margin, H - 16, { align: 'right' })
    doc.text('Daybook', margin, H - 16)
  }
  return doc.output('blob')
}

/** Render DOM nodes to PNG data URLs (for embedding charts). Loaded on demand. */
export async function nodesToImages(nodes) {
  const { toPng } = await import('html-to-image')
  const out = []
  for (const n of nodes) {
    try {
      out.push(await toPng(n, { backgroundColor: '#ffffff', pixelRatio: 2 }))
    } catch {
      /* skip */
    }
  }
  return out
}
