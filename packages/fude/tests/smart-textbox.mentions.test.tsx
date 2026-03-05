// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHIP_SENTINEL, MENTION_ID_ATTR } from '../src/serializer'
import { SmartTextbox } from '../src/smart-textbox'
import type { MentionItem, Segment } from '../src/types'
import {
  type MentionFetcher,
  MentionTestHarness,
  createDeferred,
  createItem,
  flushAsyncUpdates,
  flushTimeoutTick,
  replaceEditorText,
  setCursorAt,
  updateTextNodeValue,
} from './helpers/smart-textbox-test-utils'

afterEach(() => {
  cleanup()
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
    expect(lastCall).toEqual([
      { type: 'mention', item: second },
      { type: 'text', value: ' ' },
    ])
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
    expect(lastCall).toEqual([
      { type: 'mention', item },
      { type: 'text', value: ' ' },
    ])
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('scrolls active mention option into view during keyboard navigation', async () => {
    const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView'
    )
    const scrollIntoViewSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    })

    try {
      const onFetchMentions = vi
        .fn<MentionFetcher>()
        .mockResolvedValue([
          createItem('1', 'alpha.ts'),
          createItem('2', 'beta.ts'),
          createItem('3', 'gamma.ts'),
        ])

      const { container } = render(
        <MentionTestHarness onFetchMentions={onFetchMentions} />
      )

      const editor = container.querySelector('[role="textbox"]')!
      replaceEditorText(editor, '@')
      fireEvent.input(editor)
      await flushAsyncUpdates()

      const callsAfterOpen = scrollIntoViewSpy.mock.calls.length
      fireEvent.keyDown(editor, { key: 'ArrowDown' })
      await flushAsyncUpdates()

      expect(scrollIntoViewSpy.mock.calls.length).toBeGreaterThan(
        callsAfterOpen
      )
      const lastCallArgs =
        scrollIntoViewSpy.mock.calls[scrollIntoViewSpy.mock.calls.length - 1] ??
        []
      expect(lastCallArgs[0]).toEqual({ block: 'nearest' })
    } finally {
      if (originalScrollIntoViewDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollIntoView',
          originalScrollIntoViewDescriptor
        )
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown })
          .scrollIntoView
      }
    }
  })

  it('keeps single-line caret visible at the right edge after mention insertion', async () => {
    const item = createItem('1', 'alpha.ts')
    const onFetchMentions = vi.fn<MentionFetcher>().mockResolvedValue([item])

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} multiline={false} />
    )

    const editor = container.querySelector('[role="textbox"]') as HTMLElement
    Object.defineProperty(editor, 'clientWidth', {
      configurable: true,
      value: 100,
    })
    let mockScrollWidth = 100
    Object.defineProperty(editor, 'scrollWidth', {
      configurable: true,
      get: () => mockScrollWidth,
    })
    editor.scrollLeft = 0

    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'Enter' })
    mockScrollWidth = 320
    await flushTimeoutTick()
    expect(editor.scrollLeft).toBe(320)
  })

  it('auto-grows multiline height after mention insertion when chip layout expands later', async () => {
    const item = createItem('1', 'alpha.ts')
    const onFetchMentions = vi.fn<MentionFetcher>().mockResolvedValue([item])

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} multiline />
    )

    const editor = container.querySelector('[role="textbox"]') as HTMLElement
    let mockScrollHeight = 120
    Object.defineProperty(editor, 'scrollHeight', {
      configurable: true,
      get: () => mockScrollHeight,
    })

    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(editor.style.height).toBe('120px')

    mockScrollHeight = 200
    await flushTimeoutTick()
    expect(editor.style.height).toBe('200px')
  })

  it('keeps a structural sentinel after auto-inserted trailing space in single-line mode', async () => {
    const item = createItem('1', 'alpha.ts')
    const onFetchMentions = vi.fn<MentionFetcher>().mockResolvedValue([item])

    const { container } = render(
      <MentionTestHarness onFetchMentions={onFetchMentions} multiline={false} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'Enter' })
    await flushAsyncUpdates()

    const chip = editor.querySelector(`[${MENTION_ID_ATTR}]`)
    expect(chip).not.toBeNull()
    const spacer = chip?.nextSibling
    expect(spacer?.nodeType).toBe(Node.TEXT_NODE)
    expect(spacer?.textContent).toBe(CHIP_SENTINEL + ' ' + CHIP_SENTINEL)
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
    expect(lastCall).toEqual([
      { type: 'mention', item: second },
      { type: 'text', value: ' ' },
    ])
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('does not inject an extra space when text after mention already starts with whitespace', async () => {
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
    const queryNode = replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    queryNode.textContent = '@a hello'
    setCursorAt(queryNode, 2)
    fireEvent.input(editor)
    await flushAsyncUpdates()

    fireEvent.keyDown(editor, { key: 'Enter' })

    const lastCall = onChange.mock.calls[
      onChange.mock.calls.length - 1
    ][0] as Array<Segment>
    expect(lastCall).toEqual([
      { type: 'mention', item },
      { type: 'text', value: ' hello' },
    ])
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
