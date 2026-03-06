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

type ViewportMock = {
  dispatch: (type: 'resize' | 'scroll') => void
  restore: () => void
  set: (
    next: Partial<{
      width: number
      height: number
      offsetTop: number
      offsetLeft: number
    }>
  ) => void
}

function makeRect({
  top,
  left,
  width,
  height,
}: {
  top: number
  left: number
  width: number
  height: number
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

function mockRangeRect(rect: {
  top: number
  left: number
  width: number
  height: number
}): () => void {
  const original = Range.prototype.getBoundingClientRect.bind(Range.prototype)
  Range.prototype.getBoundingClientRect = () => makeRect(rect)
  return () => {
    Range.prototype.getBoundingClientRect = original
  }
}

function mockElementRect(
  element: Element,
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
): () => void {
  const original = element.getBoundingClientRect.bind(element)
  element.getBoundingClientRect = () => makeRect(rect)
  return () => {
    element.getBoundingClientRect = original
  }
}

function mockVisualViewport(initial: {
  width: number
  height: number
  offsetTop?: number
  offsetLeft?: number
}): ViewportMock {
  const listeners = new Map<string, Set<EventListener>>()
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const visualViewport = {
    width: initial.width,
    height: initial.height,
    offsetTop: initial.offsetTop ?? 0,
    offsetLeft: initial.offsetLeft ?? 0,
    addEventListener(type: string, listener: EventListener) {
      const entries = listeners.get(type) ?? new Set<EventListener>()
      entries.add(listener)
      listeners.set(type, entries)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  } as unknown as VisualViewport

  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  })

  return {
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) {
        listener(new Event(type))
      }
    },
    restore() {
      if (original) {
        Object.defineProperty(window, 'visualViewport', original)
      } else {
        Reflect.deleteProperty(window, 'visualViewport')
      }
    },
    set(next) {
      Object.assign(visualViewport as object, next)
    },
  }
}

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

  it('inserts mention on dropdown pointer selection', async () => {
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
    fireEvent.pointerDown(options[1])

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

  it('anchors the dropdown below the caret and caps height to visible viewport space', async () => {
    const restoreRangeRect = mockRangeRect({
      top: 120,
      left: 100,
      width: 12,
      height: 20,
    })
    const viewport = mockVisualViewport({ width: 390, height: 420 })

    try {
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

      const listbox = document.body.querySelector(
        '[role="listbox"]'
      ) as HTMLElement
      expect(listbox).not.toBeNull()

      const restoreListboxRect = mockElementRect(listbox, {
        top: 0,
        left: 0,
        width: 280,
        height: 300,
      })

      try {
        fireEvent(window, new Event('resize'))
        await flushAsyncUpdates()

        expect(listbox.dataset.mentionPlacement).toBe('below')
        expect(listbox.style.top).toBe('144px')
        expect(listbox.style.left).toBe('102px')
        expect(listbox.style.maxHeight).toBe('268px')
      } finally {
        restoreListboxRect()
      }
    } finally {
      viewport.restore()
      restoreRangeRect()
    }
  })

  it('flips the dropdown above the caret when below-space is not usable', async () => {
    const restoreRangeRect = mockRangeRect({
      top: 230,
      left: 100,
      width: 12,
      height: 20,
    })
    const viewport = mockVisualViewport({ width: 390, height: 300 })

    try {
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

      const listbox = document.body.querySelector(
        '[role="listbox"]'
      ) as HTMLElement
      expect(listbox).not.toBeNull()

      const restoreListboxRect = mockElementRect(listbox, {
        top: 0,
        left: 0,
        width: 280,
        height: 180,
      })

      try {
        fireEvent(window, new Event('resize'))
        await flushAsyncUpdates()

        expect(listbox.dataset.mentionPlacement).toBe('above')
        expect(listbox.style.top).toBe('46px')
        expect(listbox.style.left).toBe('102px')
        expect(listbox.style.maxHeight).toBe('218px')
      } finally {
        restoreListboxRect()
      }
    } finally {
      viewport.restore()
      restoreRangeRect()
    }
  })

  it('falls back to a tray when both anchored directions are too cramped', async () => {
    const restoreRangeRect = mockRangeRect({
      top: 80,
      left: 100,
      width: 12,
      height: 20,
    })
    const viewport = mockVisualViewport({ width: 390, height: 200 })

    try {
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

      const listbox = document.body.querySelector(
        '[role="listbox"]'
      ) as HTMLElement
      expect(listbox).not.toBeNull()

      const restoreListboxRect = mockElementRect(listbox, {
        top: 0,
        left: 0,
        width: 280,
        height: 320,
      })

      try {
        fireEvent(window, new Event('resize'))
        await flushAsyncUpdates()

        expect(listbox.dataset.mentionPlacement).toBe('tray')
        expect(listbox.style.top).toBe('8px')
        expect(listbox.style.left).toBe('8px')
        expect(listbox.style.width).toBe('374px')
        expect(listbox.style.maxHeight).toBe('184px')
      } finally {
        restoreListboxRect()
      }
    } finally {
      viewport.restore()
      restoreRangeRect()
    }
  })

  it('reflows the dropdown when the visible viewport shrinks', async () => {
    const restoreRangeRect = mockRangeRect({
      top: 120,
      left: 100,
      width: 12,
      height: 20,
    })
    const viewport = mockVisualViewport({ width: 390, height: 420 })

    try {
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

      const listbox = document.body.querySelector(
        '[role="listbox"]'
      ) as HTMLElement
      expect(listbox).not.toBeNull()

      const restoreListboxRect = mockElementRect(listbox, {
        top: 0,
        left: 0,
        width: 280,
        height: 320,
      })

      try {
        fireEvent(window, new Event('resize'))
        await flushAsyncUpdates()
        expect(listbox.dataset.mentionPlacement).toBe('below')

        viewport.set({ height: 210 })
        viewport.dispatch('resize')
        await flushAsyncUpdates()

        const top = Number.parseFloat(listbox.style.top)
        const maxHeight = Number.parseFloat(listbox.style.maxHeight)
        expect(listbox.dataset.mentionPlacement).toBe('tray')
        expect(top + maxHeight).toBeLessThanOrEqual(202)
      } finally {
        restoreListboxRect()
      }
    } finally {
      viewport.restore()
      restoreRangeRect()
    }
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

  it('applies dropdown class/style API surface while open', async () => {
    const onFetchMentions = vi
      .fn<MentionFetcher>()
      .mockResolvedValue([createItem('1', 'alpha.ts')])

    render(
      <MentionTestHarness
        onFetchMentions={onFetchMentions}
        classNames={{
          dropdown: 'mention-dropdown',
          dropdownItem: 'mention-item',
        }}
        styles={{
          dropdown: { borderColor: 'rgb(10, 20, 30)' },
          dropdownItem: { opacity: 0.6 },
        }}
      />
    )

    const editor = document.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '@')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    const listbox = document.body.querySelector(
      '.mention-dropdown'
    ) as HTMLElement
    expect(listbox).not.toBeNull()
    expect(listbox.style.borderColor).toBe('rgb(10, 20, 30)')

    const option = document.body.querySelector('.mention-item') as HTMLElement
    expect(option).not.toBeNull()
    expect(option.style.opacity).toBe('0.6')
  })
})
