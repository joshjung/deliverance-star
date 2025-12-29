import { useState, useEffect, useRef } from 'react'
import NavigationMenu from './components/NavigationMenu'
import FootnotePopover from './components/FootnotePopover'
import bookHtml from './generated/book.html?raw'
import bookMetadata from './generated/book-metadata.json'
import type { ContentTreeNode, Theme, Footnote } from './types/types'
import './App.css'

const THEME_KEY = 'bookTheme';

export default function App() {
  const [contentTree, setContentTree] = useState<ContentTreeNode[]>([])
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('bookTheme') as Theme | null
    return savedTheme || 'light'
  })
  const [footnotes, setFootnotes] = useState<Map<string, Footnote>>(new Map())
  const [activeFootnote, setActiveFootnote] = useState<{ id: string; position: { x: number; y: number } } | null>(null)
  const [readingProgress, setReadingProgress] = useState<number>(0)
  const [controlsVisible, setControlsVisible] = useState<boolean>(true)
  const [showCopyToast, setShowCopyToast] = useState<boolean>(false)
  const [showLocationSavedToast, setShowLocationSavedToast] = useState<boolean>(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRestoredScroll = useRef<boolean>(false)
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locationSavedToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasShownLocationSavedToast = useRef<boolean>(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = (): void => {
    setTheme((prevTheme: Theme) => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  // Load pre-rendered HTML and metadata
  useEffect(() => {
    // Convert footnotes from plain object to Map
    const footnoteMap = new Map<string, Footnote>()
    Object.entries(bookMetadata.footnotes).forEach(([key, value]) => {
      footnoteMap.set(key, value as Footnote)
    })

    setFootnotes(footnoteMap)
    setContentTree(bookMetadata.contentTree as ContentTreeNode[])

    // Set the pre-rendered HTML content
    if (contentRef.current) {
      contentRef.current.innerHTML = bookHtml
    }

    // Restore scroll position after content is rendered
    if (!hasRestoredScroll.current) {
      // Check if there's a hash in the URL (paragraph anchor)
      const hash = window.location.hash
      if (hash) {
        // Wait for DOM to be ready
        setTimeout(() => {
          const element = document.querySelector(hash)
          if (element && element.classList.contains('paragraph-with-anchor')) {
            element.classList.add('paragraph-highlighted')
            const offset = 20
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
            const offsetPosition = elementPosition - offset
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            })
          }
          hasRestoredScroll.current = true
        }, 150)
      } else {
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
    }
  }, [])

  // Auto-hide controls logic
  useEffect(() => {
    const AUTO_HIDE_DELAY = 3000 // 3 seconds

    const isMobile = (): boolean => window.innerWidth <= 768

    const showControls = (): void => {
      // Don't auto-hide if menu is open
      if (isMenuOpen) return
      
      setControlsVisible(true)
      
      // Clear existing timeout
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current)
      }
      
      // Set new timeout to hide
      autoHideTimeoutRef.current = setTimeout(() => {
        // Don't hide if menu is open
        if (!isMenuOpen) {
          setControlsVisible(false)
        }
      }, AUTO_HIDE_DELAY)
    }

    const handleMouseMove = (): void => {
      if (!isMobile()) {
        showControls()
      }
    }

    const handleScrollOrTouch = (): void => {
      if (isMobile()) {
        showControls()
      }
    }

    // Initial show and timeout
    showControls()

    // Desktop: show on mouse movement
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    // Mobile: show on scroll or touch
    window.addEventListener('scroll', handleScrollOrTouch, { passive: true })
    window.addEventListener('touchstart', handleScrollOrTouch, { passive: true })

    return () => {
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScrollOrTouch)
      window.removeEventListener('touchstart', handleScrollOrTouch)
    }
  }, [isMenuOpen])

  // Handle hash changes (browser back/forward) and highlight paragraphs
  useEffect(() => {
    const updateHighlight = (): void => {
      // Remove highlight from all paragraphs
      const allParagraphs = document.querySelectorAll('p.paragraph-with-anchor')
      allParagraphs.forEach((p) => {
        p.classList.remove('paragraph-highlighted')
      })

      // Add highlight to the paragraph matching the hash
      const hash = window.location.hash
      if (hash) {
        const element = document.querySelector(hash)
        if (element && element.classList.contains('paragraph-with-anchor')) {
          element.classList.add('paragraph-highlighted')
          
          // Scroll to the element
          const offset = 20
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
          const offsetPosition = elementPosition - offset
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        }
      }
    }

    // Initial highlight check
    updateHighlight()

    // Handle hash changes
    window.addEventListener('hashchange', updateHighlight)
    
    return () => {
      window.removeEventListener('hashchange', updateHighlight)
    }
  }, [])

  // Save scroll position and calculate reading progress
  useEffect(() => {
    const calculateProgress = (): number => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return 0
      return Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100))
    }

    const handleScroll = (): void => {
      // Update reading progress immediately for smooth updates
      setReadingProgress(calculateProgress())

      // Check if there's a highlighted paragraph and if it's still visible
      const hash = window.location.hash
      if (hash) {
        const highlightedElement = document.querySelector(hash)
        if (highlightedElement && highlightedElement.classList.contains('paragraph-with-anchor')) {
          const rect = highlightedElement.getBoundingClientRect()
          const isVisible = rect.top < window.innerHeight && rect.bottom > 0
          
          // If the highlighted paragraph is off-screen, clear the selection
          if (!isVisible) {
            // Remove highlight from all paragraphs
            const allParagraphs = document.querySelectorAll('p.paragraph-with-anchor')
            allParagraphs.forEach((p) => {
              p.classList.remove('paragraph-highlighted')
            })
            
            // Remove hash from URL without page reload
            const newUrl = `${window.location.pathname}${window.location.search}`
            window.history.replaceState({}, '', newUrl)
          }
        }
      }

      // Debounce scroll position saving
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        const position = window.scrollY || document.documentElement.scrollTop
        localStorage.setItem('bookScrollPosition', position.toString())
        // Show toast notification only the first time on this page load
        if (!hasShownLocationSavedToast.current) {
          setShowLocationSavedToast(true)
          hasShownLocationSavedToast.current = true
          // Clear existing timeout
          if (locationSavedToastTimeoutRef.current) {
            clearTimeout(locationSavedToastTimeoutRef.current)
          }
          // Hide toast after 5 seconds
          locationSavedToastTimeoutRef.current = setTimeout(() => {
            setShowLocationSavedToast(false)
          }, 5000)
        }
      }, 250)
    }

    // Calculate initial progress
    setReadingProgress(calculateProgress())

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (locationSavedToastTimeoutRef.current) {
        clearTimeout(locationSavedToastTimeoutRef.current)
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
    // Show controls when menu closes
    setControlsVisible(true)
  }

  // Handle footnote clicks and paragraph clicks
  useEffect(() => {
    const handleFootnoteInteraction = (event: MouseEvent | TouchEvent): void => {
      const target = event.target as HTMLElement
      if (target.classList.contains('footnote-ref')) {
        event.preventDefault()
        event.stopPropagation()
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

    const handleFootnoteClick = (event: MouseEvent): void => {
      handleFootnoteInteraction(event)
    }

    const handleFootnoteTouch = (event: TouchEvent): void => {
      handleFootnoteInteraction(event)
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

    const handleParagraphClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement
      // Don't update URL if clicking on anchor link or footnote
      if (target.classList.contains('paragraph-anchor') || target.classList.contains('footnote-ref')) {
        return
      }

      // Find the paragraph element
      const paragraph = target.closest('p.paragraph-with-anchor') as HTMLElement
      if (paragraph && paragraph.id) {
        // Remove highlight from all paragraphs
        const allParagraphs = document.querySelectorAll('p.paragraph-with-anchor')
        allParagraphs.forEach((p) => {
          p.classList.remove('paragraph-highlighted')
        })
        
        // Add highlight to clicked paragraph
        paragraph.classList.add('paragraph-highlighted')
        
        // Update URL without page reload
        const newUrl = `${window.location.pathname}${window.location.search}#${paragraph.id}`
        window.history.pushState({}, '', newUrl)
      }
    }

    const handleAnchorClick = async (event: MouseEvent): Promise<void> => {
      const target = event.target as HTMLElement
      if (target.classList.contains('paragraph-anchor')) {
        event.preventDefault()
        const href = target.getAttribute('href')
        if (href) {
          // Remove highlight from all paragraphs
          const allParagraphs = document.querySelectorAll('p.paragraph-with-anchor')
          allParagraphs.forEach((p) => {
            p.classList.remove('paragraph-highlighted')
          })
          
          // Build full URL
          const fullUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${href}`
          
          // Update URL
          window.history.pushState({}, '', href)
          
          // Copy to clipboard
          try {
            await navigator.clipboard.writeText(fullUrl)
            // Show toast notification
            setShowCopyToast(true)
            // Clear existing timeout
            if (copyToastTimeoutRef.current) {
              clearTimeout(copyToastTimeoutRef.current)
            }
            // Hide toast after 2 seconds
            copyToastTimeoutRef.current = setTimeout(() => {
              setShowCopyToast(false)
            }, 2000)
          } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea')
            textArea.value = fullUrl
            textArea.style.position = 'fixed'
            textArea.style.opacity = '0'
            document.body.appendChild(textArea)
            textArea.select()
            try {
              document.execCommand('copy')
              setShowCopyToast(true)
              if (copyToastTimeoutRef.current) {
                clearTimeout(copyToastTimeoutRef.current)
              }
              copyToastTimeoutRef.current = setTimeout(() => {
                setShowCopyToast(false)
              }, 2000)
            } catch (fallbackErr) {
              console.error('Failed to copy URL:', fallbackErr)
            }
            document.body.removeChild(textArea)
          }
          
          // Scroll to paragraph and add highlight
          const id = href.substring(1)
          const element = document.getElementById(id)
          if (element && element.classList.contains('paragraph-with-anchor')) {
            element.classList.add('paragraph-highlighted')
            const offset = 20
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
            const offsetPosition = elementPosition - offset
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            })
          }
        }
      }
    }

    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener('click', handleFootnoteClick)
      contentElement.addEventListener('touchstart', handleFootnoteTouch, { passive: false })
      contentElement.addEventListener('click', handleParagraphClick)
      contentElement.addEventListener('click', handleAnchorClick)
      contentElement.addEventListener('keydown', handleFootnoteKeyPress)
    }

    return () => {
      if (contentElement) {
        contentElement.removeEventListener('click', handleFootnoteClick)
        contentElement.removeEventListener('touchstart', handleFootnoteTouch)
        contentElement.removeEventListener('click', handleParagraphClick)
        contentElement.removeEventListener('click', handleAnchorClick)
        contentElement.removeEventListener('keydown', handleFootnoteKeyPress)
      }
      if (copyToastTimeoutRef.current) {
        clearTimeout(copyToastTimeoutRef.current)
      }
    }
  }, [footnotes])

  return (
    <div className="app">
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => {
          setIsMenuOpen(false)
          // Show controls when menu closes
          setControlsVisible(true)
        }}
        contentTree={contentTree}
        onNavigate={handleNavigation}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className={`top-left-controls ${isMenuOpen ? 'top-left-controls-hidden' : !controlsVisible ? 'top-left-controls-auto-hidden' : ''}`}>
        <div className="reading-progress">
          {Math.round(readingProgress)}%
        </div>
        <button
          className="hamburger-menu-button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <div className={`book-content ${activeFootnote ? 'book-content-dimmed' : ''}`} ref={contentRef}></div>
      {activeFootnote && footnotes.has(activeFootnote.id) && (
        <FootnotePopover
          content={footnotes.get(activeFootnote.id)!.content}
          onClose={() => setActiveFootnote(null)}
          theme={theme}
        />
      )}
      {showCopyToast && (
        <div className="copy-toast">
          The location in the book has been copied to the clipboard
        </div>
      )}
      {showLocationSavedToast && (
        <div className="location-saved-toast">
          Book location is saved automatically as you scroll. You can safely leave the page and come back later.
        </div>
      )}
    </div>
  )
}
