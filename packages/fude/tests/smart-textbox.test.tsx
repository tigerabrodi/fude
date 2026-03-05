// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MENTION_ID_ATTR } from '../src/serializer'
import { SmartTextbox } from '../src/smart-textbox'
import type { MentionItem, Segment, SmartTextboxProps } from '../src/types'

type MentionFetcher = (query: string) => Promise<Array<MentionItem>>

function createItem(id: string, name: string): MentionItem {
  return { id, searchValue: name, label: name }
}

function setCursorAt(node: Node, offset: number): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function replaceEditorText(editor: Element, value: string): Text {
  editor.textContent = ''
  const textNode = document.createTextNode(value)
  editor.appendChild(textNode)
  setCursorAt(textNode, value.length)
  return textNode
}

function updateTextNodeValue(node: Text, value: string): void {
  node.textContent = value
  setCursorAt(node, value.length)
}

async function flushAsyncUpdates(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function MentionTestHarness({
  onFetchMentions,
  onChangeSpy,
}: {
  onFetchMentions?: SmartTextboxProps['onFetchMentions']
  onChangeSpy?: (segments: Array<Segment>) => void
}) {
  const [value, setValue] = useState<Array<Segment>>([])
  return (
    <SmartTextbox
      value={value}
      onChange={(segments) => {
        setValue(segments)
        onChangeSpy?.(segments)
      }}
      onFetchMentions={onFetchMentions}
      multiline
    />
  )
}

afterEach(() => {
  cleanup()
})

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
// @ mention dropdown
// ---------------------------------------------------------------------------

describe('@ mention dropdown', () => {
  it('opens dropdown and fetches mentions when @ is typed', async () => {
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([createItem('1', 'alpha.ts')])

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    expect(onFetchMentions).toHaveBeenCalledWith('')
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()
    expect(document.body.textContent).toContain('alpha.ts')
  })

  it('ignores stale mention responses and keeps latest query results', async () => {
    const slow = createDeferred<Array<MentionItem>>()
    const fast = createDeferred<Array<MentionItem>>()
    const onFetchMentions = vi.fn((query: string) => {
      if (query === '') return Promise.resolve([])
      if (query === 'a') return slow.promise
      if (query === 'ab') return fast.promise
      return Promise.resolve([])
    })

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} />
    )

    const editor = container.querySelector('[role="textbox"]')!

    const queryNode = replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    updateTextNodeValue(queryNode, '@a')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    updateTextNodeValue(queryNode, '@ab')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    expect(onFetchMentions.mock.calls.map((call) => call[0])).toEqual([
      '',
      'a',
      'ab',
    ])

    fast.resolve([createItem('2', 'fresh-result')])
    await flushAsyncUpdates()
    expect(document.body.textContent).toContain('fresh-result')

    slow.resolve([createItem('3', 'stale-result')])
    await flushAsyncUpdates()
    expect(document.body.textContent).toContain('fresh-result')
    expect(document.body.textContent).not.toContain('stale-result')
  })

  it('supports arrow navigation + Enter insertion for active mention', async () => {
    const onChange = vi.fn()
    const first = createItem('1', 'alpha.ts')
    const second = createItem('2', 'beta.ts')
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([first, second])

    const { container } = render(
      <MentionTestHarness
        onFetchMentions={onFetchMentions}
        onChangeSpy={onChange}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'ArrowDown' })
    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    expect(lastCall).toEqual([{ type: 'mention', item: second }])
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('inserts the active mention on Tab', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'alpha.ts')
    const onFetchMentions = vi.fn<MentionFetcher>().mockResolvedValue([item])

    const { container } = render(
      <MentionTestHarness
        onFetchMentions={onFetchMentions}
        onChangeSpy={onChange}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'Tab' })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    expect(lastCall).toEqual([{ type: 'mention', item }])
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('closes dropdown on Escape and keeps typed @query text', async () => {
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([createItem('1', 'alpha.ts')])

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const queryNode = replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    updateTextNodeValue(queryNode, '@a')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'Escape' })

    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
    expect(editor.textContent).toBe('@a')
  })

  it('inserts mention on dropdown mouse selection', async () => {
    const onChange = vi.fn()
    const first = createItem('1', 'alpha.ts')
    const second = createItem('2', 'beta.ts')
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([first, second])

    const { container } = render(
      <MentionTestHarness
        onFetchMentions={onFetchMentions}
        onChangeSpy={onChange}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    const options = document.body.querySelectorAll('[role="option"]')
    expect(options.length).toBeGreaterThan(1)
    fireEvent.mouseEnter(options[1])
    fireEvent.mouseDown(options[1])

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    expect(lastCall).toEqual([{ type: 'mention', item: second }])
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('closes dropdown on blur and outside click', async () => {
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([createItem('1', 'alpha.ts')])

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const queryNode = replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()

    fireEvent.blur(editor)
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()

    updateTextNodeValue(queryNode, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    fireEvent.pointerDown(outside)
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
    outside.remove()
  })

  it('does not open mention mode when onFetchMentions is missing', async () => {
    const { container } = render(
      <SmartTextbox value={[]} onChange={() => {}} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
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

  it('does not leave trailing newlines after chip deletion', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} />
    )

    await act(() => Promise.resolve())

    // Simulate browser inserting a <br> artifact (as happens during backspacing)
    const editor = container.querySelector('[role="textbox"]')!
    editor.appendChild(document.createElement('br'))

    const chip = container.querySelector(`[${MENTION_ID_ATTR}]`)!
    const chipContent = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(chipContent)

    const deleteButton = chip.querySelector('[role="button"]')!
    fireEvent.mouseDown(deleteButton)

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    // No segment should end with a newline
    for (const seg of lastCall) {
      if (seg.type === 'text') {
        expect(seg.value).not.toMatch(/\n+$/)
      }
    }
  })

  it('normalizes DOM after chip deletion (no double spaces)', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
      { type: 'text', value: ' and make it work' },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} />
    )

    await act(() => Promise.resolve())

    const editor = container.querySelector('[role="textbox"]')!
    const textNodesBefore = Array.from(editor.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE
    ).length

    const chip = container.querySelector(`[${MENTION_ID_ATTR}]`)!
    const chipContent = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(chipContent)

    const deleteButton = chip.querySelector('[role="button"]')!
    fireEvent.mouseDown(deleteButton)

    // After deletion + normalize(), adjacent text nodes should be merged
    const textNodesAfter = Array.from(editor.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE
    ).length
    // Should have fewer or equal text nodes than before (merged)
    expect(textNodesAfter).toBeLessThanOrEqual(textNodesBefore)
  })

  it('collapses boundary double spaces when chip is hover-deleted', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
      { type: 'text', value: ' and make it work' },
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

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>

    expect(lastCall).toEqual([
      { type: 'text', value: 'lets fix and make it work' },
    ])
  })

  it('prevents first backspace from leaking newline/space from chip spacer', () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)!
    const spacer = chip.nextSibling as Text
    spacer.textContent = '\n'
    setCursorAt(spacer, 1)

    const event = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    })
    const isPrevented = !editor.dispatchEvent(event)

    expect(isPrevented).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
    expect(chip.getAttribute('data-highlighted')).toBe('true')
    expect((editor as HTMLElement).style.caretColor).toBe('transparent')
  })

  it('deletes highlighted chip on second backspace without trailing newline', () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)!
    const spacer = chip.nextSibling as Text
    spacer.textContent = '\n'
    setCursorAt(spacer, 1)

    editor.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      })
    )

    editor.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      })
    )

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>

    expect(lastCall).toEqual([{ type: 'text', value: 'lets fix ' }])
    expect((editor as HTMLElement).style.caretColor).not.toBe('transparent')
    for (const seg of lastCall) {
      if (seg.type === 'text') {
        expect(seg.value).not.toMatch(/\n+$/)
      }
    }
  })

  it('positions cursor at end of preceding text after chip deletion', () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)!
    const spacer = chip.nextSibling as Text
    spacer.textContent = '\n'
    setCursorAt(spacer, 1)

    // First backspace: highlight
    editor.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      })
    )

    // Second backspace: delete
    editor.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      })
    )

    const sel = document.getSelection()
    expect(sel).not.toBeNull()
    expect(sel!.rangeCount).toBeGreaterThan(0)

    const range = sel!.getRangeAt(0)
    // Cursor should be in the remaining text node "lets fix "
    expect(range.startContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(range.startContainer.textContent).toBe('lets fix ')
    expect(range.startOffset).toBe('lets fix '.length)
  })

  it('removes trailing <br> artifacts adjacent to chip on deletion', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} />
    )

    await act(() => Promise.resolve())

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)!

    // Simulate browser <br> artifact after the chip's spacer
    const br = document.createElement('br')
    chip.parentNode!.insertBefore(br, chip.nextSibling?.nextSibling || null)

    const chipContent = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(chipContent)

    const deleteButton = chip.querySelector('[role="button"]')!
    fireEvent.mouseDown(deleteButton)

    // The <br> should have been cleaned up
    expect(editor.querySelector('br')).toBeNull()

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    for (const seg of lastCall) {
      if (seg.type === 'text') {
        expect(seg.value).not.toMatch(/\n+$/)
      }
    }
  })

  it('removes whitespace placeholder nodes after chip on hover delete', async () => {
    const onChange = vi.fn()
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
    ]

    const { container } = render(
      <SmartTextbox value={value} onChange={onChange} />
    )

    await act(() => Promise.resolve())

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)!

    // Simulate browser inserting an unmarked whitespace text node after chip.
    chip.after(document.createTextNode(' '))

    const chipContent = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(chipContent)
    const deleteButton = chip.querySelector('[role="button"]')!
    fireEvent.mouseDown(deleteButton)

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>

    expect(lastCall).toEqual([{ type: 'text', value: 'lets fix ' }])
  })
})
