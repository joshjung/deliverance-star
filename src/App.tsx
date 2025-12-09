import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import NavigationMenu from './components/NavigationMenu'
import FootnotePopover from './components/FootnotePopover'
import bookContent from '../book.md?raw'
import type { ContentTreeNode, Theme, Footnote } from './types/types'
import './App.css'

const THEME_KEY = 'bookTheme';
const FOOTNOTE_REF_REGEX = /\[\^(\d+)\]/g; // [^1]
const FOOTNOTE_CONTENT_REGEX = /\[(\d+)\]:([^\[]*?)\[\/(\d+)\]/g; // [1]: content [/1]

export default function App() {
  const [contentTree, setContentTree] = useState<ContentTreeNode[]>([])
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('bookTheme') as Theme | null
    return savedTheme || 'light'
  })
  const [footnotes, setFootnotes] = useState<Map<string, Footnote>>(new Map())
  const [activeFootnote, setActiveFootnote] = useState<{ id: string; position: { x: number; y: number } } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRestoredScroll = useRef<boolean>(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = (): void => {
    setTheme((prevTheme: Theme) => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  // Parse markdown and extract content tree
  useEffect(() => {
    // First, manually parse footnotes from the raw markdown
    const footnoteMap = new Map<string, Footnote>()
    
    // Extract footnote definitions: [^1]: content
    const footnoteDefPattern = FOOTNOTE_CONTENT_REGEX
    let defMatch
    while ((defMatch = footnoteDefPattern.exec(bookContent)) !== null) {
      const footnoteNumber = defMatch[1]
      const footnoteId = `fn${footnoteNumber}`
      const footnoteContent = defMatch[2].trim()
      const footnoteHtml = marked.parse(footnoteContent) as string
      footnoteMap.set(footnoteId, { id: footnoteId, content: footnoteHtml })
    }
    
    // Replace footnote references [^1] with HTML placeholders before parsing
    let processedContent = bookContent
    const footnoteRefs: Array<{ placeholder: string; id: string; number: string }> = []
    let footnoteRefIndex = 0
    
    processedContent = processedContent.replace(FOOTNOTE_REF_REGEX, (_match, number) => {
      const footnoteId = `fn${number}`
      const placeholder = footnoteId;
      footnoteRefs.push({ placeholder, id: footnoteId, number })
      footnoteRefIndex++
      return placeholder
    })
    
    processedContent = processedContent.replace(FOOTNOTE_CONTENT_REGEX, '')
    
    // Configure marked to add IDs to headings
    marked.setOptions({
      headerIds: true,
      mangle: false
    })

    // Parse markdown to HTML
    const html = marked.parse(processedContent) as string

    // Extract headings to build content tree and ensure all have IDs
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
    
    const tree: ContentTreeNode[] = []
    const idCounts: Record<string, number> = {}
    
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
    footnoteRefs.forEach(({ placeholder, id, number }) => {
      // Find all text nodes and replace placeholders
      const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
      
      const textNodes: Text[] = []
      let node: Node | null = null
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes(placeholder)) {
          textNodes.push(node as Text)
        }
      }
     
      debugger
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

    setFootnotes(footnoteMap)

    // Set the HTML content with all IDs properly set
    if (contentRef.current) {
      contentRef.current.innerHTML = doc.body.innerHTML
    }

    setContentTree(tree)

    // Restore scroll position after content is rendered
    if (!hasRestoredScroll.current) {
      const savedPosition = localStorage.getItem('bookScrollPosition')
      if (savedPosition) {
        // Wait for DOM to be ready
        setTimeout(() => {
          const position = parseInt(savedPosition, 10)
          if (!isNaN(position)) {
            window.scrollTo(0, position)
          }
          hasRestoredScroll.current = true
        }, 150)
      } else {
        hasRestoredScroll.current = true
      }
    }
  }, [])

  // Save scroll position
  useEffect(() => {
    const handleScroll = (): void => {
      // Debounce scroll position saving
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        const position = window.scrollY || document.documentElement.scrollTop
        localStorage.setItem('bookScrollPosition', position.toString())
      }, 250)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const handleNavigation = (id: string): void => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 20 // Small offset from top
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
    setIsMenuOpen(false)
  }

  // Handle footnote clicks
  useEffect(() => {
    const handleFootnoteClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement
      if (target.classList.contains('footnote-ref')) {
        event.preventDefault()
        const footnoteId = target.getAttribute('data-footnote-id')
        if (footnoteId && footnotes.has(footnoteId)) {
          const rect = target.getBoundingClientRect()
          setActiveFootnote({
            id: footnoteId,
            position: {
              x: rect.left + rect.width / 2,
              y: rect.top - 10
            }
          })
        }
      }
    }

    const handleFootnoteKeyPress = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (target.classList.contains('footnote-ref') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        const footnoteId = target.getAttribute('data-footnote-id')
        if (footnoteId && footnotes.has(footnoteId)) {
          const rect = target.getBoundingClientRect()
          setActiveFootnote({
            id: footnoteId,
            position: {
              x: rect.left + rect.width / 2,
              y: rect.top - 10
            }
          })
        }
      }
    }

    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener('click', handleFootnoteClick)
      contentElement.addEventListener('keydown', handleFootnoteKeyPress)
    }

    return () => {
      if (contentElement) {
        contentElement.removeEventListener('click', handleFootnoteClick)
        contentElement.removeEventListener('keydown', handleFootnoteKeyPress)
      }
    }
  }, [footnotes])

  return (
    <div className="app">
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        contentTree={contentTree}
        onNavigate={handleNavigation}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <button
        className={`hamburger-menu-button ${isMenuOpen ? 'hamburger-menu-button-hidden' : ''}`}
        onClick={() => setIsMenuOpen(true)}
        aria-label="Open navigation menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className="book-content" ref={contentRef}></div>
      {activeFootnote && footnotes.has(activeFootnote.id) && (
        <FootnotePopover
          content={footnotes.get(activeFootnote.id)!.content}
          position={activeFootnote.position}
          onClose={() => setActiveFootnote(null)}
          theme={theme}
        />
      )}
    </div>
  )
}
