import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent,
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
    width?: number
    minWidth: number
    maxWidth: number
    maxHeight: number
    placement: 'below' | 'above' | 'tray'
  }
  mentionDropdownRef: MutableRefObject<HTMLDivElement | null>
  classNames?: SmartTextboxClassNames
  styles?: SmartTextboxStyles
  defaultTagIcon?: ReactNode
  onMentionMouseEnter: (index: number) => void
  onMentionPointerDown: (
    item: MentionItem,
    event: PointerEvent<HTMLDivElement>
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
  onMentionPointerDown,
}: MentionDropdownPortalProps): ReturnType<typeof createPortal> | null {
  if (!isOpen || !mentionAnchorRect || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      ref={mentionDropdownRef}
      role="listbox"
      data-mention-query={mentionQuery}
      data-mention-placement={mentionDropdownPosition.placement}
      className={classNames?.dropdown}
      style={{
        position: 'fixed',
        top: mentionDropdownPosition.top,
        left: mentionDropdownPosition.left,
        width: mentionDropdownPosition.width,
        minWidth: mentionDropdownPosition.minWidth,
        maxWidth: mentionDropdownPosition.maxWidth,
        maxHeight: mentionDropdownPosition.maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        border: '1px solid #2E2E2E',
        borderRadius: 8,
        backgroundColor: '#1C1C1C',
        color: '#E5E5E5',
        padding: 4,
        zIndex: 1000,
        boxSizing: 'border-box',
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
            onPointerDown={(event) => onMentionPointerDown(item, event)}
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
  onGhostPointerDown?: (event: PointerEvent<HTMLSpanElement>) => void
}

export function GhostTextOverlay({
  isVisible,
  text,
  anchor,
  typography,
  classNames,
  styles,
  onGhostPointerDown,
}: GhostTextOverlayProps): ReactElement | null {
  if (!isVisible || !anchor) return null
  const hasGhostClassOverride = Boolean(classNames?.ghostText)

  return (
    <div
      aria-hidden={onGhostPointerDown ? undefined : true}
      className={classNames?.ghostText}
      style={{
        position: 'absolute',
        top: anchor.top,
        left: anchor.left,
        minHeight: anchor.height,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'pre',
        opacity: hasGhostClassOverride ? undefined : 0.35,
        color: hasGhostClassOverride ? undefined : '#6E6E6E',
        ...typography,
        ...styles?.ghostText,
      }}
    >
      <span
        data-ghost-text-hitbox
        onPointerDown={onGhostPointerDown}
        style={{
          display: 'inline-block',
          pointerEvents: onGhostPointerDown ? 'auto' : 'none',
          touchAction: onGhostPointerDown ? 'manipulation' : undefined,
        }}
      >
        {text}
      </span>
    </div>
  )
}
