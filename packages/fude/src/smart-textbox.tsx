import { useEffect, useRef } from 'react'
import { MentionStore } from './mention-store'
import { normalizeSegments } from './normalize-segments'
import { segmentsEqual } from './segments-equal'
import { deserialize, serialize } from './serializer'
import type { SmartTextboxProps } from './types'

/**
 * Check whether a value array represents "empty" content
 * (no segments, or a single empty text segment).
 */
function isEmpty(value: SmartTextboxProps['value']): boolean {
  if (value.length === 0) return true
  if (
    value.length === 1 &&
    value[0].type === 'text' &&
    value[0].value.trim() === ''
  ) {
    return true
  }
  return false
}

export function SmartTextbox({
  value,
  onChange,
  onSubmit,
  placeholder,
  multiline,
  className,
  style,
  classNames,
  styles,
}: SmartTextboxProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(new MentionStore())

  // ---------------------------------------------------------------------------
  // Sync effect — reconcile props.value with the DOM
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const store = storeRef.current

    // Serialize the current DOM state to compare with incoming value
    const currentSegments = normalizeSegments(serialize(editor, store))

    // Guard: if DOM already matches, skip the rebuild to preserve cursor
    if (segmentsEqual(currentSegments, value)) return

    // Different — clear and rebuild
    store.clear()
    editor.textContent = ''
    const fragment = deserialize(value, store)
    editor.appendChild(fragment)

    syncHeight()
  })

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const store = storeRef.current
    return () => {
      store.clear()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Auto-grow (multiline only)
  // ---------------------------------------------------------------------------
  function syncHeight(): void {
    if (!multiline) return
    const editor = editorRef.current
    if (!editor) return

    editor.style.height = 'auto'
    editor.style.height = editor.scrollHeight + 'px'
  }

  // ---------------------------------------------------------------------------
  // Input handler — serialize DOM on every change
  // ---------------------------------------------------------------------------
  function handleInput(): void {
    const editor = editorRef.current
    if (!editor) return

    const segments = normalizeSegments(serialize(editor, storeRef.current))
    onChange(segments)
    syncHeight()
  }

  // ---------------------------------------------------------------------------
  // Key down — submit logic
  // ---------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (!onSubmit) return

    const isEnter = e.key === 'Enter'
    if (!isEnter) return

    if (!multiline) {
      // Single-line: Enter submits
      e.preventDefault()
      const editor = editorRef.current
      if (!editor) return
      const segments = normalizeSegments(serialize(editor, storeRef.current))
      onSubmit(segments)
    } else if (e.metaKey || e.ctrlKey) {
      // Multiline: Cmd/Ctrl+Enter submits
      e.preventDefault()
      const editor = editorRef.current
      if (!editor) return
      const segments = normalizeSegments(serialize(editor, storeRef.current))
      onSubmit(segments)
    }
    // Multiline + plain Enter → let browser insert newline
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const rootClassName = [className, classNames?.root].filter(Boolean).join(' ')
  const inputClassName = classNames?.input || undefined

  const isPlaceholderVisible = isEmpty(value)

  return (
    <div
      className={rootClassName || undefined}
      style={{
        ...style,
        ...styles?.root,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline={multiline || undefined}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          style={{
            outline: 'none',
            whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
            overflowX: multiline ? undefined : 'hidden',
            wordBreak: multiline ? 'break-word' : undefined,
            ...styles?.input,
          }}
        />
        {isPlaceholderVisible && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.5,
              ...styles?.input,
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}
