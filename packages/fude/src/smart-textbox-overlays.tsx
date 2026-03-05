import type {
  CSSProperties,
  MouseEvent,
  MutableRefObject,
  ReactElement,
  ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { MentionRect } from './smart-textbox-utils'
import type {
  MentionItem,
  SmartTextboxClassNames,
  SmartTextboxStyles,
} from './types'

type MentionDropdownPortalProps = {
  isOpen: boolean
  mentionQuery: string
  mentionItems: Array<MentionItem>
  mentionActiveIndex: number
  mentionAnchorRect: MentionRect | null
  mentionDropdownPosition: {
    top: number
    left: number
  }
  mentionDropdownRef: MutableRefObject<HTMLDivElement | null>
  classNames?: SmartTextboxClassNames
  styles?: SmartTextboxStyles
  defaultTagIcon?: ReactNode
  onMentionMouseEnter: (index: number) => void
  onMentionMouseDown: (
    item: MentionItem,
    event: MouseEvent<HTMLDivElement>
  ) => void
}

export function MentionDropdownPortal({
  isOpen,
  mentionQuery,
  mentionItems,
  mentionActiveIndex,
  mentionAnchorRect,
  mentionDropdownPosition,
  mentionDropdownRef,
  classNames,
  styles,
  defaultTagIcon,
  onMentionMouseEnter,
  onMentionMouseDown,
}: MentionDropdownPortalProps): ReturnType<typeof createPortal> | null {
  if (!isOpen || !mentionAnchorRect || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      ref={mentionDropdownRef}
      role="listbox"
      data-mention-query={mentionQuery}
      className={classNames?.dropdown}
      style={{
        position: 'fixed',
        top: mentionDropdownPosition.top,
        left: mentionDropdownPosition.left,
        minWidth: 220,
        maxWidth: 320,
        maxHeight: 220,
        overflowY: 'auto',
        border: '1px solid #2E2E2E',
        borderRadius: 8,
        backgroundColor: '#1C1C1C',
        color: '#E5E5E5',
        padding: 4,
        zIndex: 1000,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        ...styles?.dropdown,
      }}
    >
      {mentionItems.length === 0 && (
        <div
          style={{
            padding: '8px 10px',
            opacity: 0.7,
            fontSize: 13,
          }}
        >
          {mentionQuery.length > 0
            ? `No mentions for "${mentionQuery}"`
            : 'No mentions'}
        </div>
      )}

      {mentionItems.map((item, index) => {
        const isActive = index === mentionActiveIndex
        const icon = item.icon ?? defaultTagIcon

        return (
          <div
            key={`${item.id}-${index}`}
            role="option"
            aria-selected={isActive}
            data-mention-option-index={index}
            className={classNames?.dropdownItem}
            onMouseEnter={() => onMentionMouseEnter(index)}
            onMouseDown={(event) => onMentionMouseDown(item, event)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 6,
              padding: '8px 10px',
              cursor: 'pointer',
              backgroundColor: isActive ? '#2A2A2A' : 'transparent',
              ...styles?.dropdownItem,
            }}
          >
            {icon && (
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                {icon}
              </span>
            )}
            <span>{item.label}</span>
          </div>
        )
      })}
    </div>,
    document.body
  )
}

type GhostTextOverlayProps = {
  isVisible: boolean
  text: string
  anchor: {
    top: number
    left: number
    height: number
  } | null
  typography: CSSProperties
  classNames?: SmartTextboxClassNames
  styles?: SmartTextboxStyles
}

export function GhostTextOverlay({
  isVisible,
  text,
  anchor,
  typography,
  classNames,
  styles,
}: GhostTextOverlayProps): ReactElement | null {
  if (!isVisible || !anchor) return null

  return (
    <div
      aria-hidden
      className={classNames?.ghostText}
      style={{
        position: 'absolute',
        top: anchor.top,
        left: anchor.left,
        minHeight: anchor.height,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'pre',
        opacity: 0.35,
        color: '#6E6E6E',
        ...typography,
        ...styles?.ghostText,
      }}
    >
      {text}
    </div>
  )
}
