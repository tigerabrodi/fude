// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MENTION_ID_ATTR } from '../src/serializer'
import { SmartTextbox } from '../src/smart-textbox'
import type { Segment } from '../src/types'
import { createItem, setCursorAt } from './helpers/smart-textbox-test-utils'

afterEach(() => {
  cleanup()
})

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

  it('forwards chip styling/class API and updates on prop rerender', async () => {
    const item = {
      ...createItem('1', 'file.ts'),
      tooltip: 'src/file.ts',
    }
    const value: Array<Segment> = [{ type: 'mention', item }]

    const { container, rerender } = render(
      <SmartTextbox
        value={value}
        onChange={() => {}}
        classNames={{
          tag: 'chip-tag-a',
          tagIcon: 'chip-icon-a',
          tagDeleteIcon: 'chip-delete-a',
          tooltip: 'chip-tooltip-a',
        }}
        styles={{
          tag: { backgroundColor: 'rgb(1, 2, 3)' },
          tooltip: { opacity: 0.7 },
        }}
      />
    )

    await act(() => Promise.resolve())

    const chip = container.querySelector(`[${MENTION_ID_ATTR}]`)!
    const tagWrapper = chip.querySelector('.chip-tag-a') as HTMLElement
    expect(tagWrapper).not.toBeNull()

    const inner = tagWrapper.querySelector('span') as HTMLElement
    expect(inner.style.backgroundColor).toBe('rgb(1, 2, 3)')

    const iconSlotBeforeHover = chip.querySelector('.chip-icon-a')
    expect(iconSlotBeforeHover).not.toBeNull()

    fireEvent.mouseEnter(tagWrapper)
    const deleteSlot = chip.querySelector('.chip-delete-a')
    expect(deleteSlot).not.toBeNull()
    const tooltip = chip.querySelector('.chip-tooltip-a') as HTMLElement
    expect(tooltip).not.toBeNull()
    expect(tooltip.style.opacity).toBe('0.7')

    rerender(
      <SmartTextbox
        value={value}
        onChange={() => {}}
        classNames={{
          tag: 'chip-tag-b',
          tagIcon: 'chip-icon-b',
          tagDeleteIcon: 'chip-delete-b',
          tooltip: 'chip-tooltip-b',
        }}
        styles={{
          tag: { backgroundColor: 'rgb(9, 8, 7)' },
          tooltip: { opacity: 0.5 },
        }}
      />
    )

    await act(() => Promise.resolve())

    const updatedChip = container.querySelector(`[${MENTION_ID_ATTR}]`)!
    const updatedTagWrapper = updatedChip.querySelector(
      '.chip-tag-b'
    ) as HTMLElement
    expect(updatedTagWrapper).not.toBeNull()
    expect(updatedChip.querySelector('.chip-tag-a')).toBeNull()
    const updatedInner = updatedTagWrapper.querySelector('span') as HTMLElement
    expect(updatedInner.style.backgroundColor).toBe('rgb(9, 8, 7)')
  })

  it('passes default tag icons from SmartTextbox to chip roots', async () => {
    const item = createItem('1', 'file.ts')
    const value: Array<Segment> = [{ type: 'mention', item }]

    const { container } = render(
      <SmartTextbox
        value={value}
        onChange={() => {}}
        defaultTagIcon={<span data-testid="default-chip-icon">D</span>}
        defaultTagDeleteIcon={<span data-testid="default-chip-delete">X</span>}
      />
    )

    await act(() => Promise.resolve())

    const chip = container.querySelector(`[${MENTION_ID_ATTR}]`)!
    expect(
      chip.querySelector('[data-testid="default-chip-icon"]')
    ).not.toBeNull()

    const tagWrapper = chip.firstElementChild as HTMLElement
    fireEvent.mouseEnter(tagWrapper)
    expect(
      chip.querySelector('[data-testid="default-chip-delete"]')
    ).not.toBeNull()
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
