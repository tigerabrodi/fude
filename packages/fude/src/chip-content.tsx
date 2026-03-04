import { useState, type CSSProperties, type ReactNode } from 'react'
import type {
  MentionItem,
  SmartTextboxClassNames,
  SmartTextboxStyles,
} from './types'

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

const chipStyles: CSSProperties = {
  display: 'contents',
}

const chipInnerStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  backgroundColor: '#1C1C1C',
  border: '1px solid #2E2E2E',
  borderRadius: 5,
  padding: '2px 8px',
  color: '#ccc',
  fontSize: 13,
  fontFamily: 'monospace',
  cursor: 'default',
  verticalAlign: 'middle',
  lineHeight: 1.4,
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
}

const tooltipStyles: CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: 6,
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
  const [isHovered, setHovered] = useState(false)

  const icon = item.icon ?? defaultTagIcon ?? DEFAULT_FILE_ICON
  const deleteIcon =
    item.deleteIcon ?? defaultTagDeleteIcon ?? DEFAULT_DELETE_ICON

  const mergedInnerStyles: CSSProperties = {
    ...chipInnerStyles,
    ...(isHovered ? chipInnerHoverStyles : undefined),
    ...(highlighted ? highlightedStyles : undefined),
    ...styles?.tag,
  }

  return (
    <span
      style={chipStyles}
      className={classNames?.tag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={mergedInnerStyles}>
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
      {item.tooltip && isHovered && (
        <span
          style={{ ...tooltipStyles, ...styles?.tooltip }}
          className={classNames?.tooltip}
        >
          {item.tooltip}
        </span>
      )}
    </span>
  )
}
