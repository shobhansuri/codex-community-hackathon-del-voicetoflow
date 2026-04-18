import type { FlowNodeKind } from '../canvas/flowTypes'

type NodeShapeIconProps = {
  className?: string
  kind: FlowNodeKind
}

export function NodeShapeIcon({ className = 'size-12', kind }: NodeShapeIconProps) {
  const commonClass = 'fill-white stroke-current stroke-2'

  return (
    <svg
      aria-hidden="true"
      className={`${className} shrink-0 text-current`}
      viewBox="0 0 64 48"
    >
      {kind === 'start' ? (
        <rect className={commonClass} height="26" rx="13" width="48" x="8" y="11" />
      ) : null}
      {kind === 'process' ? (
        <rect className={commonClass} height="28" rx="4" width="46" x="9" y="10" />
      ) : null}
      {kind === 'decision' ? (
        <path className={commonClass} d="M32 5 58 24 32 43 6 24Z" />
      ) : null}
      {kind === 'message' ? (
        <path className={commonClass} d="M10 9h44v24H34l-8 7v-7H10Z" />
      ) : null}
      {kind === 'note' ? (
        <>
          <path
            className="fill-yellow-300 stroke-current stroke-2"
            d="M12 7h35l9 9v25H12Z"
          />
          <path className="fill-yellow-200 stroke-current stroke-2" d="M47 7v10h9" />
          <path className="stroke-current stroke-2" d="M20 22h24M20 30h18" fill="none" />
        </>
      ) : null}
      {kind === 'task' ? (
        <>
          <rect className={commonClass} height="30" rx="4" width="40" x="12" y="9" />
          <path className="stroke-current stroke-2" d="M22 24h5l4-6" fill="none" />
          <path className="stroke-current stroke-2" d="M35 20h8M35 28h8" fill="none" />
        </>
      ) : null}
      {kind === 'wait' ? (
        <>
          <path className={commonClass} d="M17 7h30v9c0 5-4 8-9 8 5 0 9 4 9 8v9H17v-9c0-4 4-8 9-8-5 0-9-3-9-8Z" />
          <path className="stroke-current stroke-2" d="M21 12h22M21 36h22" fill="none" />
        </>
      ) : null}
      {kind === 'end' ? (
        <rect className={commonClass} height="26" rx="13" width="48" x="8" y="11" />
      ) : null}
    </svg>
  )
}
