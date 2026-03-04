import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * Manages React roots for chip spans inside the contentEditable editor.
 *
 * Keyed by DOM element (not mention id) — the same mention item can appear
 * multiple times in the editor, and each chip span gets its own root.
 */
export class ChipRootManager {
  private roots = new Map<HTMLElement, Root>()

  /**
   * Mount or re-render React content inside a chip span.
   * Creates a new root if one doesn't exist, otherwise calls render()
   * on the existing root (React bails out if props are equal).
   */
  mount(container: HTMLElement, content: ReactNode): void {
    let root = this.roots.get(container)

    if (!root) {
      root = createRoot(container)
      this.roots.set(container, root)
    }

    root.render(content)
  }

  /** Unmount a single chip root and remove it from the map. */
  unmount(container: HTMLElement): void {
    const root = this.roots.get(container)
    if (root) {
      root.unmount()
      this.roots.delete(container)
    }
  }

  /** Unmount all chip roots. Used on component unmount and before DOM rebuilds. */
  unmountAll(): void {
    for (const root of this.roots.values()) {
      root.unmount()
    }
    this.roots.clear()
  }
}
