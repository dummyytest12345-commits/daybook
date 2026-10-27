import { PROJECT_COLORS, PROJECT_ICONS } from '../components/icons'
import { newId } from '../utils/id'
import { suggestKey } from '../selectors/projects'

const nowISO = () => new Date().toISOString()

export function makeProject(data, existing = []) {
  const now = nowISO()
  const taken = existing.map((p) => p.key)
  const key = data.key && !taken.includes(data.key.toUpperCase()) ? data.key.toUpperCase() : suggestKey(data.name, taken)
  return {
    id: newId(),
    name: data.name.trim(),
    key,
    description: data.description || undefined,
    color: data.color || PROJECT_COLORS[existing.length % PROJECT_COLORS.length],
    icon: data.icon || PROJECT_ICONS[existing.length % PROJECT_ICONS.length],
    status: data.status || 'active',
    favorite: false,
    startDate: data.startDate || undefined,
    targetDate: data.targetDate || undefined,
    wipLimits: {},
    nextNumber: 1,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

/**
 * Put a task into a project (or take it out with null). Project tasks get the next KEY-number of
 * the target project; moving to another project renumbers, keeping the original free-form ticketNo.
 * Pure: returns { task, projects } without mutating the inputs.
 */
export function assignProject(projects, task, projectId) {
  const target = projectId ? projects.find((p) => p.id === projectId && !p.deletedAt) : null
  if (!target) {
    if (!task.projectId && task.number == null) return { task, projects }
    return { task: { ...task, projectId: undefined, number: undefined, updatedAt: nowISO() }, projects }
  }
  if (task.projectId === target.id && task.number != null) return { task, projects }
  return {
    task: { ...task, projectId: target.id, number: target.nextNumber, updatedAt: nowISO() },
    projects: projects.map((p) => (p.id === target.id ? { ...p, nextNumber: p.nextNumber + 1, updatedAt: nowISO() } : p)),
  }
}

/** Find a project by name or key (case-insensitive), or create one. Returns { projects, project, created }. */
export function ensureProject(projects, name) {
  const n = name.trim().toLowerCase()
  const found = projects.find((p) => !p.deletedAt && (p.name.toLowerCase() === n || p.key.toLowerCase() === n))
  if (found) return { projects, project: found, created: false }
  const project = makeProject({ name: name.trim().slice(0, 60) }, projects)
  return { projects: [...projects, project], project, created: true }
}
