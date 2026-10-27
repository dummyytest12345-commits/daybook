import { create } from 'zustand'

/** Transient UI state: modals, palette, drawer. */
export const useUI = create((set) => ({
  taskModal: { open: false, task: null, defaults: null },
  openTaskModal: (task = null, defaults = null) => set({ taskModal: { open: true, task, defaults } }),
  closeTaskModal: () => set((s) => ({ taskModal: { ...s.taskModal, open: false } })),
  paletteOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  helpOpen: false,
  setHelp: (helpOpen) => set({ helpOpen }),
  projectModal: { open: false, project: null },
  openProjectModal: (project = null) => set({ projectModal: { open: true, project } }),
  closeProjectModal: () => set((s) => ({ projectModal: { ...s.projectModal, open: false } })),
  /** ids of tasks being moved to another project (null = closed) */
  moveDialog: null,
  openMoveDialog: (ids) => set({ moveDialog: ids }),
  /** task row whose "when was this finished?" dialog is open */
  finishDialog: null,
  openFinishDialog: (finishDialog) => set({ finishDialog }),
  drawerTaskId: null,
  openDrawer: (drawerTaskId) => set({ drawerTaskId }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  selection: [],
  setSelection: (selection) => set({ selection }),
  toggleSelected: (id) =>
    set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
  clearSelection: () => set({ selection: [] }),
}))
