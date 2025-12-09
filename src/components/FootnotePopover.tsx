import { useEffect, useRef } from 'react'
import './FootnotePopover.css'

interface FootnotePopoverProps {
  content: string
  position: { x: number; y: number }
  onClose: () => void
  theme: 'light' | 'dark'
}

function FootnotePopover({ content, position, onClose, theme }: FootnotePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    if (popoverRef.current) {
      // Adjust position to keep popover in viewport
      const rect = popoverRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y

      // Adjust horizontal position if popover goes off right edge
      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10
      }

      // Adjust vertical position if popover goes off bottom edge
      if (position.y + rect.height > viewportHeight) {
        adjustedY = position.y - rect.height - 20
      }

      // Ensure popover doesn't go off left or top edge
      if (adjustedX < 10) adjustedX = 10
      if (adjustedY < 10) adjustedY = 10

      popoverRef.current.style.left = `${adjustedX}px`
      popoverRef.current.style.top = `${adjustedY}px`
    }
  }, [position])

  return (
    <div
      ref={popoverRef}
      className={`footnote-popover ${theme === 'dark' ? 'footnote-popover-dark' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div className="footnote-popover-content" dangerouslySetInnerHTML={{ __html: content }} />
      <button
        className="footnote-popover-close"
        onClick={onClose}
        aria-label="Close footnote"
      >
        ×
      </button>
    </div>
  )
}

export default FootnotePopover
