import type { SectionKey, SectionTabPart } from "../types.ts"

export function getTerminalTextWidth(element: any, text: string): number {
  if (typeof element?.strWidth === "function") {
    return element.strWidth(text)
  }
  return Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 0xff ? 2 : 1), 0)
}

export function getElementContentPosition(element: any, data: any): { x: number; y: number } | null {
  if (!data || typeof data.x !== "number" || typeof data.y !== "number") {
    return null
  }

  const coords = element?.lpos || element?._getCoords?.()
  if (!coords) {
    return null
  }

  const x = data.x - coords.xi - (element.ileft || 0)
  const y = data.y - coords.yi - (element.itop || 0)
  return x >= 0 && y >= 0 ? { x, y } : null
}

export function getClickedSectionFromTabs(
  element: any,
  data: any,
  parts: SectionTabPart[],
  gap: string,
  line = 0,
): SectionKey | null {
  const position = getElementContentPosition(element, data)
  if (!position || position.y !== line) {
    return null
  }

  let start = 0
  const gapWidth = getTerminalTextWidth(element, gap)
  for (const part of parts) {
    const width = getTerminalTextWidth(element, part.text)
    if (position.x >= start && position.x < start + width) {
      return part.section
    }
    start += width + gapWidth
  }
  return null
}

export function getListIndexAtMouse(list: any, data: any): number | null {
  if (!data || typeof data.x !== "number" || typeof data.y !== "number") {
    return null
  }

  for (let index = 0; index < list.items.length; index += 1) {
    const item = list.items[index]
    const itemCoords = item?.lpos || item?._getCoords?.()
    if (
      itemCoords
      && data.x >= itemCoords.xi
      && data.x < itemCoords.xl
      && data.y >= itemCoords.yi
      && data.y < itemCoords.yl
    ) {
      return index
    }
  }

  const coords = list.lpos || list._getCoords?.()
  if (!coords || data.x < coords.xi || data.x >= coords.xl || data.y < coords.yi || data.y >= coords.yl) {
    return null
  }

  const row = Math.floor(data.y - coords.yi - (list.itop || 0) + (list.childBase || 0))
  return row >= 0 && row < list.items.length ? row : null
}
