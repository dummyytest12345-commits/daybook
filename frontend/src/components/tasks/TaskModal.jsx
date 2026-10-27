import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button, Field, Input, Modal, Select, Textarea } from '../ui'
import { taskFormSchema } from '../../schemas/task'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { isWeekend, todayISO } from '../../utils/date'
import { actions } from '../../hooks/useActions'

const numOrUndef = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v))
const blank = (date) => ({ title: '', date, projectId: '', dueDate: '', status: 'pending', progress: undefined, hours: undefined, estimateHours: undefined, module: '', ticketNo: '', tagsText: '', priority: '', notes: '' })

/** Create / edit a task. "Save and add another" keeps the modal open with date/module retained. */
export function TaskModal() {
  const { open, task, defaults } = useUI((s) => s.taskModal)
  const close = useUI((s) => s.closeTaskModal)
  const settings = useStore((s) => s.settings)
  const projects = useStore((s) => s.projects)
  const editing = !!task

  const { register, handleSubmit, reset, watch, setFocus, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: blank(todayISO()),
  })

  useEffect(() => {
    if (!open) return
    if (task) {
      reset({ ...blank(task.date), ...task, projectId: task.projectId && projects.some((p) => p.id === task.projectId && !p.deletedAt) ? task.projectId : '', dueDate: task.dueDate || '', hours: task.hours, progress: task.progress, module: task.module || '', ticketNo: task.ticketNo || '', tagsText: (task.tags || []).join(', '), priority: task.priority || '', notes: task.notes || '' })
    } else {
      reset({ ...blank(defaults?.date || todayISO()), ...defaults, tagsText: (defaults?.tags || []).join(', ') })
    }
    setTimeout(() => setFocus('title'), 50)
  }, [open, task, defaults, reset, setFocus, projects])

  const date = watch('date')

  const save = (again) =>
    handleSubmit((v) => {
      const { tagsText, ...rest } = v
      const data = {
        ...rest,
        module: rest.module || undefined,
        ticketNo: rest.ticketNo?.trim() || undefined,
        priority: rest.priority || undefined,
        notes: rest.notes?.trim() || undefined,
        projectId: rest.projectId || undefined,
        dueDate: rest.dueDate || undefined,
        tags: tagsText ? tagsText.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean) : undefined,
      }
      const st = useStore.getState()
      if (editing) {
        st.updateTask(task.id, data, `Edited “${data.title}”`)
        toast.success('Task updated')
        close()
      } else {
        st.addTask(data)
        toast.success('Task added')
        if (again) {
          reset({ ...blank(data.date), module: data.module || '', projectId: data.projectId || '' })
          setTimeout(() => setFocus('title'), 30)
        } else close()
      }
    })

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} title={editing ? 'Edit task' : 'New task'} description="Fields marked required must be filled">
      <form onSubmit={save(false)} className="space-y-3">
        <Field label="Title *" error={errors.title?.message}>
          <Input {...register('title')} placeholder="What did you work on?" aria-invalid={!!errors.title} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date *" error={errors.date?.message}>
            <Input type="date" {...register('date')} />
          </Field>
          <Field label="Status">
            <Select {...register('status')}>
              {settings.statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        {date && isWeekend(date) && (
          <p className="rounded-input bg-st-progress/10 px-3 py-2 text-xs text-st-progress" role="status">
            This date is a weekend. You can still log work, it will be flagged as non-working-day work.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project" hint="Optional">
            <Select {...register('projectId')}>
              <option value="">No project</option>
              {projects.filter((p) => !p.deletedAt && (!p.archivedAt || p.id === task?.projectId)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.key})</option>)}
            </Select>
          </Field>
          <Field label="Due date" error={errors.dueDate?.message}><Input type="date" {...register('dueDate')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Progress %" error={errors.progress?.message}>
            <Input type="number" step="5" min="0" max="100" {...register('progress', { setValueAs: numOrUndef })} />
          </Field>
          <Field label="Hours" error={errors.hours?.message}>
            <Input type="number" step="0.25" min="0" max="24" {...register('hours', { setValueAs: numOrUndef })} />
          </Field>
          <Field label="Estimate (h)" error={errors.estimateHours?.message}>
            <Input type="number" step="0.25" min="0" {...register('estimateHours', { setValueAs: numOrUndef })} />
          </Field>
          <Field label="Priority">
            <Select {...register('priority')}>
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Module">
            <Input list="module-list" {...register('module')} placeholder="e.g. Profile" />
            <datalist id="module-list">{settings.modules.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="Ticket">
            <Input {...register('ticketNo')} placeholder="e.g. 73 or FE-122" />
          </Field>
        </div>
        <Field label="Tags" hint="Comma separated">
          <Input {...register('tagsText')} placeholder="design, review" />
        </Field>
        <Field label="Notes">
          <Textarea {...register('notes')} rows={3} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {editing ? (
            <Button variant="ghost" className="text-st-blocked" onClick={() => { actions.remove(task.id); close() }}>Delete</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button onClick={close}>Cancel</Button>
            {!editing && <Button onClick={save(true)} disabled={isSubmitting}>Save and add another</Button>}
            <Button variant="primary" type="submit" disabled={isSubmitting}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
