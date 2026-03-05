import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type {
  MentionItem,
  SmartTextboxClassNames,
  SmartTextboxStyles,
} from './types'

type DebugWindow = Window & {
  __FUDE_DEBUG_FORCE_TOOLTIP_OPEN__?: boolean
}

// ---------------------------------------------------------------------------
// Default icons (inline SVGs)
// ---------------------------------------------------------------------------

const DEFAULT_FILE_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const DEFAULT_DELETE_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ChipContentProps = {
  item: MentionItem
  classNames?: SmartTextboxClassNames
  styles?: SmartTextboxStyles
  defaultTagIcon?: ReactNode
  defaultTagDeleteIcon?: ReactNode
  highlighted?: boolean
  onDelete: (id: string) => void
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const chipWrapperBaseStyles: CSSProperties = {
  display: 'inline-block',
  position: 'relative',
}

const chipWrapperMetricStyles: CSSProperties = {
  verticalAlign: 'text-bottom',
  lineHeight: 1,
}

const chipInnerLayoutStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
}

const chipInnerMetricStyles: CSSProperties = {
  verticalAlign: 'text-bottom',
  lineHeight: 1.1,
}

const chipInnerVisualStyles: CSSProperties = {
  backgroundColor: '#1C1C1C',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2E2E2E',
  borderRadius: 6,
  padding: '0 8px',
  color: '#ccc',
  fontSize: '0.92em',
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  cursor: 'default',
}

const chipInnerHoverStyles: CSSProperties = {
  backgroundColor: '#252525',
  borderColor: '#3A3A3A',
}

const highlightedStyles: CSSProperties = {
  boxShadow: '0 0 0 2px #5B9EFF',
}

const iconSlotStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  lineHeight: 0,
}

const tooltipStyles: CSSProperties = {
  position: 'fixed',
  padding: '4px 8px',
  backgroundColor: '#1C1C1C',
  border: '1px solid #2E2E2E',
  borderRadius: 4,
  color: '#ccc',
  fontSize: 12,
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 10,
}

function isTooltipDebugForcedOpen(): boolean {
  if (typeof window === 'undefined') return false
  return (window as DebugWindow).__FUDE_DEBUG_FORCE_TOOLTIP_OPEN__ === true
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChipContent({
  item,
  classNames,
  styles,
  defaultTagIcon,
  defaultTagDeleteIcon,
  highlighted,
  onDelete,
}: ChipContentProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const [isHovered, setHovered] = useState(false)
  const isTooltipVisible =
    Boolean(item.tooltip) && (isHovered || isTooltipDebugForcedOpen())
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  function updateTooltipPosition(): void {
    const root = rootRef.current
    if (!root) return

    const rect = root.getBoundingClientRect()
    const margin = 6
    const minViewportPadding = 8
    const nextLeft = Math.min(
      Math.max(rect.left + rect.width / 2, minViewportPadding),
      window.innerWidth - minViewportPadding
    )
    setTooltipPosition({
      top: rect.top - margin,
      left: nextLeft,
    })
  }

  useEffect(() => {
    if (!isTooltipVisible || typeof window === 'undefined') {
      setTooltipPosition(null)
      return
    }

    updateTooltipPosition()

    const handleReposition = () => {
      updateTooltipPosition()
    }

    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isTooltipVisible])

  const icon = item.icon ?? defaultTagIcon ?? DEFAULT_FILE_ICON
  const deleteIcon =
    item.deleteIcon ?? defaultTagDeleteIcon ?? DEFAULT_DELETE_ICON

  const hasTagClassOverride = Boolean(classNames?.tag)
  const hasTagWrapperClassOverride = Boolean(classNames?.tagWrapper)
  const mergedInnerStyles: CSSProperties = {
    ...chipInnerLayoutStyles,
    ...(!hasTagClassOverride ? chipInnerMetricStyles : undefined),
    ...(!hasTagClassOverride ? chipInnerVisualStyles : undefined),
    ...(!hasTagClassOverride && isHovered ? chipInnerHoverStyles : undefined),
    ...(highlighted ? highlightedStyles : undefined),
    ...styles?.tag,
  }
  const mergedWrapperStyles: CSSProperties = {
    ...chipWrapperBaseStyles,
    ...(!hasTagWrapperClassOverride ? chipWrapperMetricStyles : undefined),
    ...styles?.tagWrapper,
  }

  return (
    <span
      ref={rootRef}
      style={mergedWrapperStyles}
      className={classNames?.tagWrapper as string}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={mergedInnerStyles} className={classNames?.tag}>
        {/* Icon slot — shows delete icon on hover, normal icon otherwise */}
        <span
          style={iconSlotStyles}
          className={
            isHovered ? classNames?.tagDeleteIcon : classNames?.tagIcon
          }
        >
          {isHovered ? (
            <span
              role="button"
              aria-label="Delete mention"
              style={{ ...iconSlotStyles, cursor: 'pointer' }}
              onMouseDown={(e) => {
                // Prevent editor from losing focus
                e.preventDefault()
                onDelete(item.id)
              }}
            >
              {deleteIcon}
            </span>
          ) : (
            icon
          )}
        </span>

        {/* Label */}
        <span>{item.label}</span>
      </span>

      {/* Tooltip */}
      {isTooltipVisible &&
        tooltipPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            style={{
              ...tooltipStyles,
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transform: 'translate(-50%, -100%)',
              ...styles?.tooltip,
            }}
            className={classNames?.tooltip}
          >
            {item.tooltip}
          </span>,
          document.body
        )}
    </span>
  )
}
