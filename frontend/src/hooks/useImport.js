import { useReducer } from 'react'
import { toast } from 'sonner'
import { parseCsv } from '../services/importers/csv'
import { parseLegacyText } from '../services/importers/legacyText'
import { autoMap, rowsToTasks } from '../services/importers/normalise'
import { useStore } from '../store/useStore'
import { taskHash } from '../utils/hash'
import { todayISO } from '../utils/date'

const init = { projectId: '', step: 'file', source: null, headers: [], rows: [], mapping: {}, tasks: [], errors: [], mode: 'skip', busy: false, fileName: '', error: null }

function reducer(s, a) {
  switch (a.type) {
    case 'patch': return { ...s, ...a.patch }
    case 'reset': return init
    default: return s
  }
}

/** Import wizard state: pick -> parse -> map -> validate/preview -> commit. */
export function useImport() {
  const [s, dispatch] = useReducer(reducer, init)
  const patch = (p) => dispatch({ type: 'patch', patch: p })
  const settings = useStore((st) => st.settings)

  const pickFile = async (file) => {
    patch({ busy: true, error: null, fileName: file.name })
    try {
      const name = file.name.toLowerCase()
      if (name.endsWith('.json')) {
        const data = JSON.parse(await file.text())
        patch({ busy: false, step: 'json', source: 'json', json: data })
        return
      }
      const parsed = name.endsWith('.xlsx') ? await (await import('../services/importers/xlsx')).parseXlsx(file) : await parseCsv(file)
      if (!parsed.rows.length) throw new Error('No data rows found in this file')
      patch({ busy: false, step: 'map', source: 'table', headers: parsed.headers, rows: parsed.rows, mapping: autoMap(parsed.headers) })
    } catch (e) {
      patch({ busy: false, error: e.message || 'Could not read file' })
    }
  }

  const parseLegacy = (text, date) => {
    const { tasks, errors } = parseLegacyText(text, { date: date || todayISO() })
    if (!tasks.length && !errors.length) return patch({ error: 'Paste some text first' })
    patch({ source: 'legacy', tasks, errors, step: 'preview', error: null })
  }

  const setMapping = (field, header) => patch({ mapping: { ...s.mapping, [field]: header || undefined } })

  const validate = () => {
    if (!s.mapping.date || !s.mapping.title) return patch({ error: 'Map at least the Date and Task columns' })
    const { tasks, errors } = rowsToTasks(s.rows, s.mapping, { dateFormat: settings.dateFormat })
    patch({ tasks, errors, step: 'preview', error: null })
  }

  const existing = () => new Set(useStore.getState().tasks.filter((t) => !t.deletedAt).map(taskHash))
  const duplicates = s.step === 'preview' ? s.tasks.filter((t) => existing().has(taskHash(t))).length : 0

  const commit = () => {
    useStore.getState().importTasks(s.tasks, s.mode, { projectId: s.projectId || undefined })
    toast.success(`Imported ${s.tasks.length} tasks`)
    patch({ step: 'done' })
  }

  return { ...s, duplicates, pickFile, parseLegacy, setMapping, validate, commit, setMode: (mode) => patch({ mode }), setProject: (projectId) => patch({ projectId }), back: (step) => patch({ step }), reset: () => dispatch({ type: 'reset' }) }
}
