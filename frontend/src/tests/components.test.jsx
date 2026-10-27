import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { QuickAdd } from '../components/tasks/QuickAdd'
import { useStore } from '../store/useStore'
import { defaultSettings } from '../schemas/settings'
import { openRepository } from '../services/repository'

const reset = () => {
  localStorage.clear()
  openRepository('test-user')
  useStore.setState({ userId: 'test-user', tasks: [], dayLogs: {}, settings: defaultSettings(), undoStack: [], redoStack: [], activity: [] })
}

beforeEach(reset)

describe('QuickAdd', () => {
  it('parses the line and creates a task on submit', async () => {
    const user = userEvent.setup()
    render(<QuickAdd date="2026-09-07" />)
    await user.type(screen.getByLabelText('Quick add task'), 'Fix bug 2h #consent !high')
    expect(screen.getByText(/#Consent/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add/i }))
    const [t] = useStore.getState().tasks
    expect(t).toMatchObject({ title: 'Fix bug 2h', module: 'Consent', priority: 'high', date: '2026-09-07' })
  })

  it('disables Add until there is a title', () => {
    render(<QuickAdd date="2026-09-07" />)
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })
})

describe('store', () => {
  it('soft-deletes and supports undo/redo', () => {
    const st = useStore.getState()
    const t = st.addTask({ title: 'A', date: '2026-09-07' })
    st.removeTask(t.id)
    expect(useStore.getState().tasks[0].deletedAt).toBeTruthy()
    useStore.getState().undo()
    expect(useStore.getState().tasks[0].deletedAt).toBeNull()
    useStore.getState().redo()
    expect(useStore.getState().tasks[0].deletedAt).toBeTruthy()
  })

  it('sets completedAt when status becomes completed', () => {
    const t = useStore.getState().addTask({ title: 'A', date: '2026-09-07' })
    useStore.getState().updateTask(t.id, { status: 'completed' })
    expect(useStore.getState().tasks[0].completedAt).toBeTruthy()
  })

  it('import skips duplicates and rename module updates history', () => {
    const st = useStore.getState()
    const t = st.addTask({ title: 'Same', date: '2026-09-07', module: 'Old' })
    st.importTasks([{ ...t, id: 'other' }], 'skip')
    expect(useStore.getState().tasks).toHaveLength(1)
    useStore.getState().renameModule('Old', 'New')
    expect(useStore.getState().tasks[0].module).toBe('New')
  })

  it('carry over continues the task on the next day as a thread', () => {
    const t = useStore.getState().addTask({ title: 'A', date: '2026-09-07' })
    useStore.getState().carryOver([t.id], '2026-09-08')
    const rows = useStore.getState().tasks
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.date === '2026-09-08')).toMatchObject({ carriedFrom: '2026-09-07', threadId: t.id })
    expect(rows.find((r) => r.id === t.id).threadId).toBe(t.id)
  })

  it('timer stop writes hours', () => {
    const t = useStore.getState().addTask({ title: 'A', date: '2026-09-07' })
    useStore.getState().startTimer(t.id)
    useStore.setState((s) => ({ tasks: s.tasks.map((x) => ({ ...x, timerStartedAt: new Date(Date.now() - 3600000).toISOString() })) }))
    useStore.getState().stopTimer(t.id)
    expect(useStore.getState().tasks[0].hours).toBeCloseTo(1, 1)
  })
})
