import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { marked } from 'marked'
import { JSDOM } from 'jsdom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const FOOTNOTE_REF_REGEX = /\[\^(\d+)\]/g // [^1]
const FOOTNOTE_CONTENT_REGEX = /\[(\d+)\]:([^\[]*?)\[\/(\d+)\]/g // [1]: content [/1]

// Read the markdown file
const bookContent = readFileSync(join(rootDir, 'book.md'), 'utf-8')

// Extract footnotes
const footnoteMap = new Map()
let defMatch

while ((defMatch = FOOTNOTE_CONTENT_REGEX.exec(bookContent)) !== null) {
  const footnoteNumber = defMatch[1]
  const footnoteId = `fn${footnoteNumber}`
  const footnoteContent = defMatch[2].trim()
  const footnoteHtml = marked.parse(footnoteContent)
  footnoteMap.set(footnoteId, { id: footnoteId, content: footnoteHtml })
}

// Replace footnote references with placeholders
let processedContent = bookContent
const footnoteRefs = []

processedContent = processedContent.replace(FOOTNOTE_REF_REGEX, (_match, number) => {
  const footnoteId = `fn${number}`
  const placeholder = footnoteId
  footnoteRefs.push({ placeholder, id: footnoteId, number })
  return placeholder
})

// Remove footnote definitions from content
processedContent = processedContent.replace(FOOTNOTE_CONTENT_REGEX, '')

// Configure marked to add IDs to headings
marked.setOptions({
  headerIds: true,
  mangle: false
})

// Parse markdown to HTML
const html = marked.parse(processedContent)

// Parse HTML with JSDOM
const dom = new JSDOM(html)
const doc = dom.window.document
const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')

// Build navigation tree and ensure all headings have IDs
const tree = []
const idCounts = {}

headings.forEach((heading) => {
  const level = parseInt(heading.tagName.charAt(1), 10)
  const text = heading.textContent?.trim() || ''
  
  // Generate ID from text if not present
  let id = heading.id
  if (!id) {
    id = text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }
  
  // Ensure unique IDs
  if (idCounts[id]) {
    idCounts[id]++
    id = `${id}-${idCounts[id]}`
  } else {
    idCounts[id] = 1
  }
  
  // Set the ID on the heading element
  heading.id = id

  tree.push({
    level,
    text,
    id
  })
})

// Replace footnote placeholders with clickable spans
// We have to reverse so we don't greedily match the 1 footnote when we should match 10
footnoteRefs.reverse().forEach(({ placeholder, id, number }) => {
  // Find all text nodes and replace placeholders
  const walker = doc.createTreeWalker(doc.body, dom.window.NodeFilter.SHOW_TEXT, null)
  
  const textNodes = []
  let node = null
  while ((node = walker.nextNode())) {
    if (node.textContent?.includes(placeholder)) {
      textNodes.push(node)
    }
  }
 
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || ''
    if (text.includes(placeholder)) {
      const parts = text.split(placeholder)
      const parent = textNode.parentElement
      
      if (parent && parts.length === 2) {
        // Create text node for part before placeholder
        const beforeText = doc.createTextNode(parts[0])
        
        // Create footnote reference span
        const span = doc.createElement('span')
        span.className = 'footnote-ref'
        span.setAttribute('data-footnote-id', id)
        span.textContent = number
        span.setAttribute('role', 'button')
        span.setAttribute('tabindex', '0')
        span.setAttribute('aria-label', `Footnote ${number}`)
        
        // Create text node for part after placeholder
        const afterText = doc.createTextNode(parts[1])
        
        // Replace the original text node
        parent.replaceChild(beforeText, textNode)
        parent.insertBefore(span, beforeText.nextSibling)
        if (afterText.textContent) {
          parent.insertBefore(afterText, span.nextSibling)
        }
      }
    }
  })
})

// Add anchors to paragraphs
const paragraphs = doc.querySelectorAll('p')
let paragraphIndex = 0

paragraphs.forEach((paragraph) => {
  // Skip empty paragraphs
  if (!paragraph.textContent || paragraph.textContent.trim().length === 0) {
    return
  }

  paragraphIndex++
  const paragraphId = `p${paragraphIndex}`
  paragraph.id = paragraphId
  paragraph.className = 'paragraph-with-anchor'

  // Create anchor link
  const anchor = doc.createElement('a')
  anchor.href = `#${paragraphId}`
  anchor.className = 'paragraph-anchor'
  anchor.setAttribute('aria-label', 'Share this paragraph')
  anchor.innerHTML = '🔗'
  anchor.setAttribute('title', 'Copy link to this paragraph')

  // Insert anchor at the beginning of the paragraph
  paragraph.insertBefore(anchor, paragraph.firstChild)
})

// Convert footnotes Map to plain object for JSON
const footnotesObj = {}
footnoteMap.forEach((value, key) => {
  footnotesObj[key] = value
})

// Create output directory if it doesn't exist
const outputDir = join(rootDir, 'src', 'generated')
mkdirSync(outputDir, { recursive: true })

// Write output files
writeFileSync(join(outputDir, 'book.html'), doc.body.innerHTML, 'utf-8')
writeFileSync(
  join(outputDir, 'book-metadata.json'),
  JSON.stringify({ contentTree: tree, footnotes: footnotesObj }, null, 2),
  'utf-8'
)

console.log('✓ Book converted to HTML')
console.log(`✓ Navigation tree: ${tree.length} headings`)
console.log(`✓ Footnotes: ${footnoteMap.size} footnotes`)
