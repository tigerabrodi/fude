// @vitest-environment happy-dom

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChipContent } from '../src/chip-content'
import type { MentionItem } from '../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createItem(
  id: string,
  label: string,
  opts?: Partial<MentionItem>
): MentionItem {
  return { id, searchValue: label, label, ...opts }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ChipContent', () => {
  it('renders the label', () => {
    const item = createItem('1', 'file.ts')
    const { getByText } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    expect(getByText('file.ts')).toBeTruthy()
  })

  it('renders with default file icon when no icon provided', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    // Should render an SVG icon
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('uses stable default inline metrics for mixed text/chip lines', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    const wrapper = container.firstElementChild as HTMLElement
    const inner = wrapper.querySelector('span') as HTMLElement

    expect(wrapper.style.display).toBe('inline-block')
    expect(wrapper.style.verticalAlign).toBe('text-bottom')
    expect(inner.style.whiteSpace).toBe('nowrap')
    expect(inner.style.verticalAlign).toBe('text-bottom')
  })

  it('renders custom icon from item', () => {
    const item = createItem('1', 'file.ts', {
      icon: <span data-testid="custom-icon">*</span>,
    })
    const { getByTestId } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    expect(getByTestId('custom-icon')).toBeTruthy()
  })

  it('renders defaultTagIcon when item has no icon', () => {
    const item = createItem('1', 'file.ts')
    const { getByTestId } = render(
      <ChipContent
        item={item}
        defaultTagIcon={<span data-testid="default-icon">D</span>}
        onDelete={() => {}}
      />
    )

    expect(getByTestId('default-icon')).toBeTruthy()
  })

  it('item icon overrides defaultTagIcon', () => {
    const item = createItem('1', 'file.ts', {
      icon: <span data-testid="item-icon">I</span>,
    })
    const { container } = render(
      <ChipContent
        item={item}
        defaultTagIcon={<span data-testid="fallback-icon">D</span>}
        onDelete={() => {}}
      />
    )

    // Item icon should render, not the default
    expect(container.querySelector('[data-testid="item-icon"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fallback-icon"]')).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Hover behavior
  // ---------------------------------------------------------------------------

  it('shows delete icon on hover', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    // Find the outer wrapper (display: contents span)
    const wrapper = container.firstElementChild as HTMLElement

    // Before hover: should have icon (not the delete button)
    expect(container.querySelector('[role="button"]')).toBeNull()

    // Hover
    fireEvent.mouseEnter(wrapper)

    // After hover: delete button should appear
    const deleteButton = container.querySelector('[role="button"]')
    expect(deleteButton).not.toBeNull()
    expect(deleteButton!.getAttribute('aria-label')).toBe('Delete mention')
  })

  it('restores normal icon on mouse leave', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    const wrapper = container.firstElementChild as HTMLElement

    fireEvent.mouseEnter(wrapper)
    expect(container.querySelector('[role="button"]')).not.toBeNull()

    fireEvent.mouseLeave(wrapper)
    expect(container.querySelector('[role="button"]')).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------------

  it('shows tooltip on hover when item has tooltip', () => {
    const item = createItem('1', 'file.ts', { tooltip: 'src/file.ts' })
    const { container, getByText } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    const wrapper = container.firstElementChild as HTMLElement
    fireEvent.mouseEnter(wrapper)

    expect(getByText('src/file.ts')).toBeTruthy()
  })

  it('does not show tooltip when item has no tooltip', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} onDelete={() => {}} />
    )

    const wrapper = container.firstElementChild as HTMLElement
    fireEvent.mouseEnter(wrapper)

    // No tooltip span should exist (only the inner chip span and icon/label)
    // The tooltip would be a sibling of the inner chip span
    const spans = container.querySelectorAll('span')
    // Check none has tooltip-like positioning
    const tooltipSpan = Array.from(spans).find(
      (s) => s.style.position === 'absolute'
    )
    expect(tooltipSpan).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // Delete action
  // ---------------------------------------------------------------------------

  it('calls onDelete when delete icon is clicked', () => {
    const onDelete = vi.fn()
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} onDelete={onDelete} />
    )

    const wrapper = container.firstElementChild as HTMLElement
    fireEvent.mouseEnter(wrapper)

    const deleteButton = container.querySelector('[role="button"]')!
    fireEvent.mouseDown(deleteButton)

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  // ---------------------------------------------------------------------------
  // Highlighted state
  // ---------------------------------------------------------------------------

  it('applies highlight styles when highlighted prop is true', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} highlighted onDelete={() => {}} />
    )

    // The inner chip span (with background) should have boxShadow
    const innerSpan = container.querySelector('span > span') as HTMLElement
    expect(innerSpan.style.boxShadow).toContain('5B9EFF')
  })

  it('does not apply highlight styles when highlighted is false', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent item={item} highlighted={false} onDelete={() => {}} />
    )

    const innerSpan = container.querySelector('span > span') as HTMLElement
    expect(innerSpan.style.boxShadow).toBe('')
  })

  it('does not force default visual inline styles when classNames.tag is provided', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent
        item={item}
        classNames={{ tag: 'rounded-md p-1 border' }}
        onDelete={() => {}}
      />
    )

    const innerSpan = container.querySelector('span > span') as HTMLElement
    expect(innerSpan.style.padding).toBe('')
    expect(innerSpan.style.backgroundColor).toBe('')
  })

  it('does not force wrapper metric inline styles when classNames.tagWrapper is provided', () => {
    const item = createItem('1', 'file.ts')
    const { container } = render(
      <ChipContent
        item={item}
        classNames={{ tagWrapper: 'align-middle my-0.5' }}
        onDelete={() => {}}
      />
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.display).toBe('inline-block')
    expect(wrapper.style.position).toBe('relative')
    expect(wrapper.style.verticalAlign).toBe('')
    expect(wrapper.style.lineHeight).toBe('')
  })
})
