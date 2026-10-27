import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUI } from '../store/useUI'
import { useStore } from '../store/useStore'
import { shiftAnchor, todayISO, isValidISO } from '../utils/date'
import { toast } from 'sonner'

const typing = (e) => {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

export const SHORTCUTS = [
  ['N', 'New task'], ['Ctrl/⌘ K', 'Command palette'], ['T', 'Jump to today'], ['← / →', 'Previous / next period'],
  ['1 – 5', 'Day / Week / Month / Board / Table'], ['E', 'Export'], ['P', 'Projects'], ['G', 'Team projects'], ['Ctrl/⌘ Z', 'Undo'], ['Ctrl/⌘ Shift Z', 'Redo'], ['?', 'Shortcut sheet'],
]
const VIEW_KEYS = { 1: 'day', 2: 'week', 3: 'month', 4: 'board', 5: 'table' }

/** Global keyboard shortcuts. Mount once in the app shell. */
export function useHotkeys() {
  const navigate = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUI.getState().setPalette(!useUI.getState().paletteOpen)
        return
      }
      if (mod && e.key.toLowerCase() === 'z' && !typing(e)) {
        e.preventDefault()
        const st = useStore.getState()
        const ok = e.shiftKey ? st.redo() : st.undo()
        if (ok) toast(e.shiftKey ? 'Redone' : 'Undone')
        return
      }
      if (mod || e.altKey || typing(e) || document.querySelector('[role="dialog"]')) return
      const sp = new URLSearchParams(loc.search)
      const onLog = loc.pathname.startsWith('/log/')
      const view = loc.pathname.split('/')[2] || 'day'
      const anchor = isValidISO(sp.get('d')) ? sp.get('d') : todayISO()
      const go = (v, d) => navigate(`/log/${v}${d ? `?d=${d}` : ''}`)
      const k = e.key
      if (k === 'n' || k === 'N') { e.preventDefault(); useUI.getState().openTaskModal() }
      else if (k === 't' || k === 'T') { if (onLog) navigate({ search: '' }); else go('day') }
      else if (k === '?') useUI.getState().setHelp(true)
      else if (k === 'e' || k === 'E') navigate('/reports')
      else if (k === 'p' || k === 'P') navigate('/projects')
      else if (k === 'g' || k === 'G') navigate('/team')
      else if (VIEW_KEYS[k]) go(VIEW_KEYS[k], sp.get('d'))
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && onLog) {
        const unit = { day: 'day', week: 'week', month: 'month', board: 'week', table: 'month' }[view]
        sp.set('d', shiftAnchor(sp.get('u') || unit, anchor, k === 'ArrowRight' ? 1 : -1))
        navigate({ search: sp.toString() }, { replace: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, loc])
}
