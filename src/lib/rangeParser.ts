/**
 * Parse page range strings like "1-3,5,7-10,15-"
 * Returns array of page numbers (1-indexed)
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr.trim()) return []
  
  const pages = new Set<number>()
  const parts = rangeStr.split(',').map(part => part.trim())
  
  for (const part of parts) {
    if (!part) continue
    
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(s => s.trim())
      
      let startNum = start ? parseInt(start, 10) : 1
      let endNum = end ? parseInt(end, 10) : totalPages
      
      // Validate start number
      if (isNaN(startNum) || startNum < 1) startNum = 1
      if (startNum > totalPages) startNum = totalPages
      
      // Validate end number
      if (isNaN(endNum) || endNum < 1) endNum = 1
      if (endNum > totalPages) endNum = totalPages
      
      // Ensure start <= end
      if (startNum > endNum) {
        [startNum, endNum] = [endNum, startNum]
      }
      
      // Add range to set
      for (let i = startNum; i <= endNum; i++) {
        pages.add(i)
      }
    } else {
      // Single page number
      const pageNum = parseInt(part, 10)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pages.add(pageNum)
      }
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b)
}

/**
 * Format page numbers back to range string
 */
export function formatPageRange(pages: number[]): string {
  if (pages.length === 0) return ''
  
  const sorted = [...pages].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      // End of current range
      if (start === end) {
        ranges.push(start.toString())
      } else if (end === start + 1) {
        ranges.push(`${start},${end}`)
      } else {
        ranges.push(`${start}-${end}`)
      }
      
      start = sorted[i]
      end = sorted[i]
    }
  }
  
  // Handle final range
  if (start === end) {
    ranges.push(start.toString())
  } else if (end === start + 1) {
    ranges.push(`${start},${end}`)
  } else {
    ranges.push(`${start}-${end}`)
  }
  
  return ranges.join(',')
}

/**
 * Validate page range string
 */
export function validatePageRange(rangeStr: string, totalPages: number): {
  isValid: boolean
  error?: string
  pages?: number[]
} {
  try {
    const pages = parsePageRange(rangeStr, totalPages)
    return {
      isValid: true,
      pages
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid page range'
    }
  }
}

/**
 * Get suggested page ranges
 */
export function getSuggestedRanges(totalPages: number): Array<{
  label: string
  value: string
}> {
  const suggestions = [
    { label: 'All pages', value: `1-${totalPages}` },
    { label: 'First page', value: '1' },
    { label: 'Last page', value: totalPages.toString() }
  ]
  
  if (totalPages > 2) {
    suggestions.push({ label: 'First half', value: `1-${Math.ceil(totalPages / 2)}` })
    suggestions.push({ label: 'Second half', value: `${Math.ceil(totalPages / 2) + 1}-${totalPages}` })
  }
  
  if (totalPages > 10) {
    suggestions.push({ label: 'First 10', value: '1-10' })
    suggestions.push({ label: 'Last 10', value: `${totalPages - 9}-${totalPages}` })
  }
  
  if (totalPages % 2 === 0 && totalPages > 2) {
    suggestions.push({ label: 'Odd pages', value: generateOddPages(totalPages) })
    suggestions.push({ label: 'Even pages', value: generateEvenPages(totalPages) })
  }
  
  return suggestions
}

function generateOddPages(totalPages: number): string {
  const oddPages = []
  for (let i = 1; i <= totalPages; i += 2) {
    oddPages.push(i)
  }
  return formatPageRange(oddPages)
}

function generateEvenPages(totalPages: number): string {
  const evenPages = []
  for (let i = 2; i <= totalPages; i += 2) {
    evenPages.push(i)
  }
  return formatPageRange(evenPages)
}