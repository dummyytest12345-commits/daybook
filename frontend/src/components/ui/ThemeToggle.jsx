import { Monitor, Moon, Sun } from 'lucide-react'
import { Button, Menu, Tip } from '.'
import { useTheme } from '../../store/useTheme'
import { cn } from '../../utils/format'

/** Light / Dark / System picker. Works on every page, including signed-out ones. */
export function ThemeToggle({ className, variant = 'ghost' }) {
  const pref = useTheme((s) => s.pref)
  const resolved = useTheme((s) => s.resolved)
  const setPref = useTheme((s) => s.setPref)
  const Icon = resolved === 'dark' ? Moon : Sun
  const item = (value, label, I) => ({
    label: `${label}${pref === value ? '  ✓' : ''}`,
    icon: <I size={14} />,
    onSelect: () => setPref(value),
  })
  return (
    <Menu
      trigger={
        <span className="inline-flex">
          <Tip label="Theme">
            <Button variant={variant} size="icon" className={cn(className)} aria-label={`Theme: ${pref}. Change theme`}>
              <Icon size={16} />
            </Button>
          </Tip>
        </span>
      }
      items={[item('light', 'Light', Sun), item('dark', 'Dark', Moon), item('system', 'System', Monitor)]}
    />
  )
}
