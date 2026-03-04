// @vitest-environment happy-dom

import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MENTION_ID_ATTR } from '../src/serializer'
import { SmartTextbox } from '../src/smart-textbox'
import type { MentionItem, Segment } from '../src/types'

function createItem(id: string, name: string): MentionItem {
  return { id, searchValue: name, label: name }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('rendering', () => {
  it('renders a contentEditable div with role="textbox"', () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} />
    )

    const editor = container.querySelector('[role="textbox"]')
    expect(editor).not.toBeNull()
    expect(editor!.getAttribute('contenteditable')).toBe('true')
  })

  it('sets aria-multiline when multiline is true', () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')
    expect(editor!.getAttribute('aria-multiline')).toBe('true')
  })

  it('does not set aria-multiline when multiline is false', () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} />
    )

    const editor = container.querySelector('[role="textbox"]')
    expect(editor!.hasAttribute('aria-multiline')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

describe('placeholder', () => {
  it('shows placeholder when value is empty', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        placeholder="Type something..."
      />
    )

    const placeholder = container.querySelector('[aria-hidden]')
    expect(placeholder).not.toBeNull()
    expect(placeholder!.textContent).toBe('Type something...')
  })

  it('shows placeholder when value is a single empty text segment', () => {
    const { container } = render(
      <SmartTextbox
        value={[{ type: 'text', value: '' }]}
        onChange={() => {}}
        placeholder="Type something..."
      />
    )

    const placeholder = container.querySelector('[aria-hidden]')
    expect(placeholder).not.toBeNull()
  })

  it('shows placeholder when value is whitespace-only (e.g. newline)', () => {
    const { container } = render(
      <SmartTextbox
        value={[{ type: 'text', value: '\n' }]}
        onChange={() => {}}
        placeholder="Type something..."
      />
    )

    const placeholder = container.querySelector('[aria-hidden]')
    expect(placeholder).not.toBeNull()
  })

  it('hides placeholder when value has content', () => {
    const { container } = render(
      <SmartTextbox
        value={[{ type: 'text', value: 'hello' }]}
        onChange={() => {}}
        placeholder="Type something..."
      />
    )

    const placeholder = container.querySelector('[aria-hidden]')
    expect(placeholder).toBeNull()
  })

  it('renders custom placeholder text', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        placeholder="Ask a question..."
      />
    )

    const placeholder = container.querySelector('[aria-hidden]')
    expect(placeholder!.textContent).toBe('Ask a question...')
  })
})

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

describe('styling', () => {
  it('applies className to root wrapper', () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} className="my-root" />
    )

    expect(container.firstElementChild!.classList.contains('my-root')).toBe(
      true
    )
  })

  it('applies style to root wrapper', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        style={{ border: '1px solid red' }}
      />
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.style.border).toBe('1px solid red')
  })

  it('applies classNames.root to root wrapper', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        classNames={{ root: 'custom-root' }}
      />
    )

    expect(container.firstElementChild!.classList.contains('custom-root')).toBe(
      true
    )
  })

  it('applies classNames.input to editor', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        classNames={{ input: 'custom-input' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')
    expect(editor!.classList.contains('custom-input')).toBe(true)
  })

  it('applies styles.root to root wrapper', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        styles={{ root: { backgroundColor: 'blue' } }}
      />
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.style.backgroundColor).toBe('blue')
  })

  it('applies styles.input to editor', () => {
    const { container } = render(
      <SmartTextbox
        value={[]}
        onChange={() => {}}
        styles={{ input: { color: 'red' } }}
      />
    )

    const editor = container.querySelector('[role="textbox"]') as HTMLElement
    expect(editor.style.color).toBe('red')
  })

  it('sets white-space: nowrap for single-line mode', () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} />
    )

    const editor = container.querySelector('[role="textbox"]') as HTMLElement
    expect(editor.style.whiteSpace).toBe('nowrap')
  })

  it('sets white-space: pre-wrap for multiline mode', () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} multiline />
    )

    const editor = container.querySelector('[role="textbox"]') as HTMLElement
    expect(editor.style.whiteSpace).toBe('pre-wrap')
  })
})

// ---------------------------------------------------------------------------
// Sync guard (DOM identity preserved when value hasn't changed)
// ---------------------------------------------------------------------------

describe('sync guard', () => {
  it('preserves DOM nodes when re-rendered with same-content value', () => {
    const value: Array<Segment> = [{ type: 'text', value: 'hello' }]

    const { container, rerender } = render(
      <SmartTextbox value={value} onChange={() => {}} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const textNode = editor.childNodes[0]

    // Re-render with a new array reference but same content
    rerender(
      <SmartTextbox
        value={[{ type: 'text', value: 'hello' }]}
        onChange={() => {}}
      />
    )

    // The text node should be the exact same JS object (not rebuilt)
    expect(editor.childNodes[0]).toBe(textNode)
  })

  it('replaces DOM nodes when value changes', () => {
    const { container, rerender } = render(
      <SmartTextbox
        value={[{ type: 'text', value: 'hello' }]}
        onChange={() => {}}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const textNode = editor.childNodes[0]

    rerender(
      <SmartTextbox
        value={[{ type: 'text', value: 'world' }]}
        onChange={() => {}}
      />
    )

    // DOM was rebuilt — different text node
    expect(editor.childNodes[0]).not.toBe(textNode)
    expect(editor.childNodes[0].textContent).toBe('world')
  })
})

// ---------------------------------------------------------------------------
// onChange
// ---------------------------------------------------------------------------

describe('onChange', () => {
  it('calls onChange with serialized segments on input', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SmartTextbox value={[]} onChange={onChange} />
    )

    const editor = container.querySelector('[role="textbox"]')!

    // Simulate user typing by directly mutating the DOM, then dispatching input
    editor.appendChild(document.createTextNode('hello'))
    fireEvent.input(editor)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([{ type: 'text', value: 'hello' }])
  })
})

// ---------------------------------------------------------------------------
// onSubmit
// ---------------------------------------------------------------------------

describe('onSubmit', () => {
  it('calls onSubmit on Enter in single-line mode', () => {
    const onSubmit = vi.fn()
    const value: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const { container } = render(
      <SmartTextbox value={value} onChange={() => {}} onSubmit={onSubmit} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    const isPrevented = !editor.dispatchEvent(event)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith([{ type: 'text', value: 'hello' }])
    expect(isPrevented).toBe(true)
  })

  it('does not call onSubmit on plain Enter in multiline mode', () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <SmartTextbox
        value={[{ type: 'text', value: 'hello' }]}
        onChange={() => {}}
        onSubmit={onSubmit}
        multiline
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit on Cmd+Enter in multiline mode', () => {
    const onSubmit = vi.fn()
    const value: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const { container } = render(
      <SmartTextbox
        value={value}
        onChange={() => {}}
        onSubmit={onSubmit}
        multiline
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    const isPrevented = !editor.dispatchEvent(event)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(isPrevented).toBe(true)
  })

  it('calls onSubmit on Ctrl+Enter in multiline mode', () => {
    const onSubmit = vi.fn()
    const value: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const { container } = render(
      <SmartTextbox
        value={value}
        onChange={() => {}}
        onSubmit={onSubmit}
        multiline
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    editor.dispatchEvent(event)

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not call onSubmit when onSubmit is not provided', () => {
    const { container } = render(
      <SmartTextbox
        value={[{ type: 'text', value: 'hello' }]}
        onChange={() => {}}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    // Should not throw
    fireEvent.keyDown(editor, { key: 'Enter' })
  })
})

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe('cleanup', () => {
  it('clears the mention store on unmount', () => {
    // We can't directly access storeRef, but we can verify indirectly:
    // render with a mention, unmount, re-render with same mention —
    // the store should have been cleared so the mention is re-registered fresh.
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [{ type: 'mention', item }]

    const { unmount } = render(
      <SmartTextbox value={value} onChange={() => {}} />
    )

    // Unmount clears the store
    unmount()

    // Re-rendering should work fine (store re-populated from value)
    const { container } = render(
      <SmartTextbox value={value} onChange={() => {}} />
    )
    const editor = container.querySelector('[role="textbox"]')!
    expect(editor.childNodes.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Chip rendering
// ---------------------------------------------------------------------------

describe('chip rendering', () => {
  it('renders a chip span for mention segments', () => {
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={() => {}} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)
    expect(chip).not.toBeNull()
    expect(chip!.getAttribute(MENTION_ID_ATTR)).toBe('1')
  })

  it('renders chip label text inside chip span', async () => {
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [{ type: 'mention', item }]

    const { container } = render(
      <SmartTextbox value={value} onChange={() => {}} />
    )

    // ChipContent renders via createRoot — need to flush
    await act(() => Promise.resolve())

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)!
    expect(chip.textContent).toContain('file.ts')
  })

  it('renders delete button on chip hover', async () => {
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [{ type: 'mention', item }]

    const { container } = render(
      <SmartTextbox value={value} onChange={() => {}} />
    )

    await act(() => Promise.resolve())

    const chip = container.querySelector(`[${MENTION_ID_ATTR}]`)!

    // The ChipContent has a wrapper span with display: contents
    // Find the wrapper that has the mouseEnter handler
    const chipContent = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(chipContent)

    const deleteButton = chip.querySelector('[role="button"]')
    expect(deleteButton).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Chip deletion via click
// ---------------------------------------------------------------------------

describe('chip deletion', () => {
  it('removes chip and calls onChange when delete icon is clicked', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'fix ' },
      { type: 'mention', item },
      { type: 'text', value: ' please' },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} />
    )

    await act(() => Promise.resolve())

    const chip = container.querySelector(`[${MENTION_ID_ATTR}]`)!
    const chipContent = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(chipContent)

    const deleteButton = chip.querySelector('[role="button"]')!
    fireEvent.mouseDown(deleteButton)

    // onChange should have been called with segments minus the mention
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    // Should only have text segments remaining
    const hasMention = lastCall.some((s) => s.type === 'mention')
    expect(hasMention).toBe(false)
  })
})
