import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Field, Input, Modal, Select, Textarea } from '../ui'
import { Icon, PROJECT_COLORS, PROJECT_ICONS, ProjectIcon } from '../icons'
import { PROJECT_STATUSES, projectFormSchema } from '../../schemas/project'
import { suggestKey } from '../../selectors/projects'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { cn } from '../../utils/format'

const blank = (n) => ({ name: '', key: '', description: '', color: PROJECT_COLORS[n % PROJECT_COLORS.length], icon: PROJECT_ICONS[n % PROJECT_ICONS.length], status: 'active', startDate: '', targetDate: '' })

/** Create or edit a project: name, key, colour, icon, status, dates. */
export function ProjectModal() {
  const { open, project } = useUI((s) => s.projectModal)
  const close = useUI((s) => s.closeProjectModal)
  const projects = useStore((s) => s.projects)
  const navigate = useNavigate()
  const editing = !!project
  const [keyTouched, setKeyTouched] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, setError, setFocus, formState: { errors } } = useForm({
    resolver: zodResolver(projectFormSchema),
    defaultValues: blank(0),
  })
  const color = watch('color')
  const icon = watch('icon')
  const name = watch('name')

  useEffect(() => {
    if (!open) return
    const live = projects.filter((p) => !p.deletedAt)
    reset(project ? { ...blank(0), ...project, description: project.description || '', startDate: project.startDate || '', targetDate: project.targetDate || '' } : blank(live.length))
    setKeyTouched(!!project)
    setTimeout(() => setFocus('name'), 50)
  }, [open, project, projects, reset, setFocus])

  // suggest a key while typing the name, until the user edits the key themselves
  useEffect(() => {
    if (!open || editing || keyTouched || !name) return
    setValue('key', suggestKey(name, projects.filter((p) => !p.deletedAt).map((p) => p.key)))
  }, [name, open, editing, keyTouched, projects, setValue])

  const onSubmit = handleSubmit((v) => {
    const clash = projects.some((p) => !p.deletedAt && p.key === v.key && p.id !== project?.id)
    if (clash) return setError('key', { message: `The key ${v.key} is already used by another project` })
    const data = { ...v, description: v.description?.trim() || undefined, startDate: v.startDate || undefined, targetDate: v.targetDate || undefined }
    const st = useStore.getState()
    if (editing) {
      st.updateProject(project.id, data, `Edited project “${v.name}”`)
      toast.success('Project updated')
    } else {
      const p = st.addProject(data)
      toast.success(`Project ${p.key} created`)
      navigate(`/projects/${p.id}`)
    }
    close()
  })

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} title={editing ? 'Edit project' : 'New project'} description="Projects are optional. Tasks without a project stay in your personal log.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-start gap-3">
          <ProjectIcon icon={icon} color={color} size={48} />
          <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_120px]">
            <Field label="Name *" error={errors.name?.message}><Input {...register('name')} placeholder="e.g. Website redesign" aria-invalid={!!errors.name} /></Field>
            <Field label="Key *" error={errors.key?.message} hint="Task IDs look like KEY-1">
              <Input {...register('key', { onChange: (e) => { setKeyTouched(true); e.target.value = e.target.value.toUpperCase() } })} maxLength={6} className="font-mono uppercase" aria-invalid={!!errors.key} />
            </Field>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted">Colour</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Project colour">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setValue('color', c)}
                className={cn('size-7 rounded-full ring-offset-2 ring-offset-surface transition', color === c ? 'ring-2 ring-ink' : 'hover:scale-110')} style={{ background: c }} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted">Icon</legend>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12" role="radiogroup" aria-label="Project icon">
            {PROJECT_ICONS.map((i) => (
              <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} onClick={() => setValue('icon', i)}
                className={cn('grid size-9 place-items-center rounded-lg border transition', icon === i ? 'border-transparent text-white' : 'border-line text-muted hover:text-ink')} style={icon === i ? { background: color } : undefined}>
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Status"><Select {...register('status')}>{PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          <Field label="Start date"><Input type="date" {...register('startDate')} /></Field>
          <Field label="Target date" error={errors.targetDate?.message}><Input type="date" {...register('targetDate')} /></Field>
        </div>
        <Field label="Description"><Textarea rows={3} {...register('description')} placeholder="What is this project about?" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit">{editing ? 'Save changes' : 'Create project'}</Button>
        </div>
      </form>
    </Modal>
  )
}
