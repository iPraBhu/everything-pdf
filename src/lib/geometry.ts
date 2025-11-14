/**
 * Point in 2D space
 */
export interface Point {
  x: number
  y: number
}

/**
 * Rectangle with position and dimensions
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Transform matrix for 2D transformations
 */
export interface Transform {
  a: number // scale x
  b: number // skew x
  c: number // skew y
  d: number // scale y
  e: number // translate x
  f: number // translate y
}

/**
 * Page dimensions and boxes
 */
export interface PageGeometry {
  mediaBox: Rect
  cropBox?: Rect
  trimBox?: Rect
  bleedBox?: Rect
  artBox?: Rect
  rotation: number
}

/**
 * Calculate the distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * Check if two rectangles intersect
 */
export function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  )
}

/**
 * Calculate the intersection of two rectangles
 */
export function rectIntersection(rect1: Rect, rect2: Rect): Rect | null {
  if (!rectsIntersect(rect1, rect2)) return null
  
  const x = Math.max(rect1.x, rect2.x)
  const y = Math.max(rect1.y, rect2.y)
  const width = Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - x
  const height = Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - y
  
  return { x, y, width, height }
}

/**
 * Calculate the union of two rectangles
 */
export function rectUnion(rect1: Rect, rect2: Rect): Rect {
  const x = Math.min(rect1.x, rect2.x)
  const y = Math.min(rect1.y, rect2.y)
  const width = Math.max(rect1.x + rect1.width, rect2.x + rect2.width) - x
  const height = Math.max(rect1.y + rect1.height, rect2.y + rect2.height) - y
  
  return { x, y, width, height }
}

/**
 * Scale a rectangle by a factor
 */
export function scaleRect(rect: Rect, scale: number): Rect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale
  }
}

/**
 * Rotate a point around the origin
 */
export function rotatePoint(point: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  }
}

/**
 * Rotate a rectangle around its center
 */
export function rotateRect(rect: Rect, angle: number): Rect {
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  }
  
  // Get the four corners
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ]
  
  // Rotate each corner around the center
  const rotatedCorners = corners.map(corner => {
    const relative = { x: corner.x - center.x, y: corner.y - center.y }
    const rotated = rotatePoint(relative, angle)
    return { x: rotated.x + center.x, y: rotated.y + center.y }
  })
  
  // Find the bounding box of rotated corners
  const minX = Math.min(...rotatedCorners.map(c => c.x))
  const minY = Math.min(...rotatedCorners.map(c => c.y))
  const maxX = Math.max(...rotatedCorners.map(c => c.x))
  const maxY = Math.max(...rotatedCorners.map(c => c.y))
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Apply transform matrix to a point
 */
export function transformPoint(point: Point, transform: Transform): Point {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f
  }
}

/**
 * Create identity transform matrix
 */
export function identityTransform(): Transform {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

/**
 * Create translation transform matrix
 */
export function translateTransform(dx: number, dy: number): Transform {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy }
}

/**
 * Create scale transform matrix
 */
export function scaleTransform(sx: number, sy: number = sx): Transform {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
}

/**
 * Create rotation transform matrix
 */
export function rotateTransform(angle: number): Transform {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

/**
 * Multiply two transform matrices
 */
export function multiplyTransforms(t1: Transform, t2: Transform): Transform {
  return {
    a: t1.a * t2.a + t1.b * t2.c,
    b: t1.a * t2.b + t1.b * t2.d,
    c: t1.c * t2.a + t1.d * t2.c,
    d: t1.c * t2.b + t1.d * t2.d,
    e: t1.e * t2.a + t1.f * t2.c + t2.e,
    f: t1.e * t2.b + t1.f * t2.d + t2.f
  }
}

/**
 * Calculate fit-to-box scaling
 */
export function calculateFitScale(
  contentSize: { width: number; height: number },
  containerSize: { width: number; height: number },
  mode: 'fit' | 'fill' | 'stretch' = 'fit'
): { scale: number; offset: Point } {
  const scaleX = containerSize.width / contentSize.width
  const scaleY = containerSize.height / contentSize.height
  
  let scale: number
  
  switch (mode) {
    case 'fit':
      scale = Math.min(scaleX, scaleY)
      break
    case 'fill':
      scale = Math.max(scaleX, scaleY)
      break
    case 'stretch':
      // For stretch mode, we'd need to return separate x/y scales
      scale = Math.min(scaleX, scaleY)
      break
    default:
      scale = Math.min(scaleX, scaleY)
  }
  
  const scaledWidth = contentSize.width * scale
  const scaledHeight = contentSize.height * scale
  
  const offset: Point = {
    x: (containerSize.width - scaledWidth) / 2,
    y: (containerSize.height - scaledHeight) / 2
  }
  
  return { scale, offset }
}

/**
 * Calculate N-up layout positions
 */
export function calculateNUpLayout(
  pageCount: number,
  cols: number,
  rows: number,
  pageSize: { width: number; height: number },
  spacing: number = 0,
  margin: number = 0
): Array<{ x: number; y: number; width: number; height: number }> {
  const positions: Array<{ x: number; y: number; width: number; height: number }> = []
  
  const cellWidth = pageSize.width / cols
  const cellHeight = pageSize.height / rows
  const contentWidth = cellWidth - spacing
  const contentHeight = cellHeight - spacing
  
  for (let i = 0; i < pageCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols) % rows
    
    const x = margin + col * cellWidth + spacing / 2
    const y = margin + row * cellHeight + spacing / 2
    
    positions.push({
      x,
      y,
      width: contentWidth,
      height: contentHeight
    })
  }
  
  return positions
}

/**
 * Calculate poster/tile positions for splitting large pages
 */
export function calculatePosterTiles(
  pageSize: { width: number; height: number },
  tileSize: { width: number; height: number },
  overlap: number = 0
): Array<{ x: number; y: number; width: number; height: number }> {
  const tiles: Array<{ x: number; y: number; width: number; height: number }> = []
  
  const effectiveTileWidth = tileSize.width - overlap
  const effectiveTileHeight = tileSize.height - overlap
  
  const cols = Math.ceil(pageSize.width / effectiveTileWidth)
  const rows = Math.ceil(pageSize.height / effectiveTileHeight)
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * effectiveTileWidth
      const y = row * effectiveTileHeight
      
      const width = Math.min(tileSize.width, pageSize.width - x)
      const height = Math.min(tileSize.height, pageSize.height - y)
      
      tiles.push({ x, y, width, height })
    }
  }
  
  return tiles
}