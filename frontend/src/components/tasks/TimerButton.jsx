import { Pause, Play, Square } from 'lucide-react'
import { Button, Tip } from '../ui'
import { useTimer } from '../../hooks/useTimer'
import { fmtDuration } from '../../utils/format'

/** Start / pause / stop timer for a task. Stop writes the elapsed hours to the task. */
export function TimerButton({ taskId, compact }) {
  const { running, elapsed, start, pause, stop } = useTimer(taskId)
  return (
    <span className="inline-flex items-center gap-1">
      {(running || elapsed > 0) && (
        <span className={`text-xs tabular-nums ${running ? 'font-semibold text-primary' : 'text-muted'}`} aria-live="off">
          {fmtDuration(elapsed)}
        </span>
      )}
      {running ? (
        <>
          <Tip label="Pause timer">
            <Button size="icon" variant="ghost" className={compact ? 'h-7 w-7' : ''} onClick={pause} aria-label="Pause timer"><Pause size={14} /></Button>
          </Tip>
          <Tip label="Stop and save hours">
            <Button size="icon" variant="ghost" className={compact ? 'h-7 w-7' : ''} onClick={stop} aria-label="Stop timer"><Square size={14} /></Button>
          </Tip>
        </>
      ) : (
        <Tip label="Start timer">
          <Button size="icon" variant="ghost" className={compact ? 'h-7 w-7' : ''} onClick={start} aria-label="Start timer"><Play size={14} /></Button>
        </Tip>
      )}
    </span>
  )
}
