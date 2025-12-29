import { useEffect, useRef } from 'react'
import './FootnotePopover.css'

interface FootnotePopoverProps {
  content: string
  onClose: () => void
  theme: 'light' | 'dark'
}

function FootnotePopover({ content, onClose, theme }: FootnotePopoverProps) {
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

  return (
    <>
      <div className="footnote-popover-backdrop" onClick={onClose} />
      <div
        ref={popoverRef}
        className={`footnote-popover ${theme === 'dark' ? 'footnote-popover-dark' : ''}`}
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
    </>
  )
}

export default FootnotePopover
