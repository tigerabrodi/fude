// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MENTION_ID_ATTR } from '../src/serializer'
import type { Segment } from '../src/types'
import {
  type MentionFetcher,
  type SuggestionFetcher,
  GhostTestHarness,
  advanceFakeTime,
  createDeferred,
  createItem,
  flushAsyncUpdates,
  replaceEditorText,
  setCursorAt,
  updateTextNodeValue,
} from './helpers/smart-textbox-test-utils'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Ghost suggestions
// ---------------------------------------------------------------------------

describe('ghost suggestions', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces suggestions and uses default trailingLength=300', async () => {
    vi.useFakeTimers()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' completion'])

    const { container } = render(
      <GhostTestHarness onFetchSuggestions={onFetchSuggestions} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'a'.repeat(400))
    fireEvent.input(editor)

    await advanceFakeTime(299)
    expect(onFetchSuggestions).not.toHaveBeenCalled()

    await advanceFakeTime(1)
    expect(onFetchSuggestions).toHaveBeenCalledTimes(1)
    const trailing = onFetchSuggestions.mock.calls[0]?.[0] ?? ''
    expect(trailing.length).toBe(300)
  })

  it('uses mention searchValue in suggestion trailing context', async () => {
    vi.useFakeTimers()
    const item = createItem('1', 'file.ts')
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' completion'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        initialValue={[
          { type: 'text', value: 'fix ' },
          { type: 'mention', item },
          { type: 'text', value: ' now' },
        ]}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const range = document.createRange()
    range.setStart(editor, editor.childNodes.length)
    range.collapse(true)
    const selection = document.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    fireEvent.input(editor)
    await advanceFakeTime(300)
    expect(onFetchSuggestions).toHaveBeenCalledWith('fix file.ts now')
  })

  it('shows ghost only when caret is at visual end', async () => {
    vi.useFakeTimers()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' end'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const textNode = replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)
    expect(container.querySelector('.ghost-text')).not.toBeNull()

    setCursorAt(textNode, 2)
    fireEvent.input(editor)
    expect(container.querySelector('.ghost-text')).toBeNull()

    await advanceFakeTime(300)
    expect(onFetchSuggestions).toHaveBeenCalledTimes(1)
  })

  it('treats trailing chip sentinel as visual end for ghost fetch', async () => {
    vi.useFakeTimers()
    const item = createItem('1', 'file.ts')
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' completion'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        initialValue={[{ type: 'mention', item }]}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)
    expect(chip).not.toBeNull()
    const spacer = chip?.nextSibling as Text
    setCursorAt(spacer, spacer.textContent?.length ?? 0)

    fireEvent.input(editor)
    await advanceFakeTime(300)
    expect(onFetchSuggestions).toHaveBeenCalledWith('file.ts')
  })

  it('accepts active ghost suggestion with Tab', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        onChangeSpy={onChange}
        multiline={false}
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)
    expect(container.querySelector('.ghost-text')?.textContent).toBe(' world')

    fireEvent.keyDown(editor, { key: 'Tab' })

    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ]?.[0] as Array<Segment>
    expect(lastCall).toEqual([{ type: 'text', value: 'hello world' }])
  })

  it('accepts the visible ghost suggestion on pointerdown without blurring the editor', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        onChangeSpy={onChange}
        multiline={false}
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]') as HTMLElement
    editor.focus()
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)

    const hitbox = container.querySelector(
      '[data-ghost-text-hitbox]'
    ) as HTMLElement
    expect(hitbox).not.toBeNull()

    fireEvent.pointerDown(hitbox)

    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ]?.[0] as Array<Segment>
    expect(lastCall).toEqual([{ type: 'text', value: 'hello world' }])
    expect(document.activeElement).toBe(editor)
    expect(container.querySelector('[data-ghost-text-hitbox]')).toBeNull()
  })

  it('cycles ghost suggestions with Shift+Tab', async () => {
    vi.useFakeTimers()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' one', ' two'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)

    expect(container.querySelector('.ghost-text')?.textContent).toBe(' one')
    fireEvent.keyDown(editor, { key: 'Tab', shiftKey: true })
    expect(container.querySelector('.ghost-text')?.textContent).toBe(' two')
  })

  it('dismisses ghost on Escape without mutating current value', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        onChangeSpy={onChange}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)
    const callsBeforeEscape = onChange.mock.calls.length

    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(container.querySelector('.ghost-text')).toBeNull()
    expect(onChange.mock.calls.length).toBe(callsBeforeEscape)
  })

  it('single-line Enter submits as-is when ghost is visible', async () => {
    vi.useFakeTimers()
    const onSubmit = vi.fn()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        onSubmitSpy={onSubmit}
        multiline={false}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)

    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith([{ type: 'text', value: 'hello' }])
  })

  it('suppresses ghost while mention dropdown is open', async () => {
    vi.useFakeTimers()
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([createItem('1', 'alpha.ts')])
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' completion'])

    const { container } = render(
      <GhostTestHarness
        onFetchMentions={onFetchMentions}
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()
    await advanceFakeTime(300)

    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()
    expect(container.querySelector('.ghost-text')).toBeNull()
    expect(onFetchSuggestions).not.toHaveBeenCalled()
  })

  it('ignores stale suggestion responses', async () => {
    vi.useFakeTimers()
    const slow = createDeferred<Array<string>>()
    const fast = createDeferred<Array<string>>()
    const onFetchSuggestions = vi.fn((trailing: string) => {
      if (trailing.endsWith('a')) return slow.promise
      if (trailing.endsWith('ab')) return fast.promise
      return Promise.resolve([])
    })

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
        autocompleteDelay={0}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const node = replaceEditorText(editor, 'a')
    fireEvent.input(editor)
    await advanceFakeTime(0)

    updateTextNodeValue(node, 'ab')
    fireEvent.input(editor)
    await advanceFakeTime(0)

    fast.resolve([' fast'])
    await flushAsyncUpdates()
    expect(container.querySelector('.ghost-text')?.textContent).toBe(' fast')

    slow.resolve([' slow'])
    await flushAsyncUpdates()
    expect(container.querySelector('.ghost-text')?.textContent).toBe(' fast')
  })

  it('clears visible ghost immediately on input before next debounce cycle', async () => {
    vi.useFakeTimers()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const node = replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)
    expect(container.querySelector('.ghost-text')).not.toBeNull()

    updateTextNodeValue(node, 'hello!')
    fireEvent.input(editor)
    expect(container.querySelector('.ghost-text')).toBeNull()
  })

  it('renders ghost overlay outside the editable DOM and applies ghost styling surface', async () => {
    vi.useFakeTimers()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text' }}
        styles={{ ghostText: { color: 'rgb(1, 2, 3)' } }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)

    const ghost = container.querySelector('.ghost-text') as HTMLElement
    expect(ghost).not.toBeNull()
    expect(ghost.style.position).toBe('absolute')
    expect(ghost.style.color).toBe('rgb(1, 2, 3)')
    expect(editor.contains(ghost)).toBe(false)
  })

  it('does not force inline ghost color/opacity when classNames.ghostText is provided', async () => {
    vi.useFakeTimers()
    const onFetchSuggestions = vi
      .fn<SuggestionFetcher>()
      .mockResolvedValue([' world'])

    const { container } = render(
      <GhostTestHarness
        onFetchSuggestions={onFetchSuggestions}
        multiline
        classNames={{ ghostText: 'ghost-text text-[#FAFAFA]' }}
      />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')
    fireEvent.input(editor)
    await advanceFakeTime(300)

    const ghost = container.querySelector('.ghost-text') as HTMLElement
    expect(ghost).not.toBeNull()
    expect(ghost.style.color).toBe('')
    expect(ghost.style.opacity).toBe('')
  })

  it('uses execCommand insertText first when accepting ghost suggestion', async () => {
    vi.useFakeTimers()
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'execCommand'
    )
    const execCommandSpy = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandSpy,
    })

    try {
      const onFetchSuggestions = vi
        .fn<SuggestionFetcher>()
        .mockResolvedValue([' world'])

      const { container } = render(
        <GhostTestHarness
          onFetchSuggestions={onFetchSuggestions}
          multiline
          classNames={{ ghostText: 'ghost-text' }}
        />
      )

      const editor = container.querySelector('[role="textbox"]')!
      replaceEditorText(editor, 'hello')
      fireEvent.input(editor)
      await advanceFakeTime(300)
      expect(container.querySelector('.ghost-text')?.textContent).toBe(' world')

      fireEvent.keyDown(editor, { key: 'Tab' })
      expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, ' world')
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, 'execCommand', originalDescriptor)
      } else {
        Reflect.deleteProperty(document, 'execCommand')
      }
    }
  })

  it('falls back to range insertion when execCommand returns false', async () => {
    vi.useFakeTimers()
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'execCommand'
    )
    const execCommandSpy = vi.fn(() => false)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandSpy,
    })

    try {
      const onChange = vi.fn()
      const onFetchSuggestions = vi
        .fn<SuggestionFetcher>()
        .mockResolvedValue([' world'])

      const { container } = render(
        <GhostTestHarness
          onFetchSuggestions={onFetchSuggestions}
          onChangeSpy={onChange}
          multiline
          classNames={{ ghostText: 'ghost-text' }}
        />
      )

      const editor = container.querySelector('[role="textbox"]')!
      replaceEditorText(editor, 'hello')
      fireEvent.input(editor)
      await advanceFakeTime(300)
      expect(container.querySelector('.ghost-text')?.textContent).toBe(' world')

      fireEvent.keyDown(editor, { key: 'Tab' })
      const lastCall = onChange.mock.calls[
        onChange.mock.calls.length - 1
      ]?.[0] as Array<Segment>
      expect(lastCall).toEqual([{ type: 'text', value: 'hello world' }])
      expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, ' world')
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, 'execCommand', originalDescriptor)
      } else {
        Reflect.deleteProperty(document, 'execCommand')
      }
    }
  })
})
