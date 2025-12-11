import type { ContentTreeNode } from '../types/types'
import './NavigationMenu.css'

interface NavigationMenuProps {
  isOpen: boolean
  onClose: () => void
  contentTree: ContentTreeNode[]
  onNavigate: (id: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

function NavigationMenu({ isOpen, onClose, contentTree, onNavigate, theme, onToggleTheme }: NavigationMenuProps) {
  if (!isOpen) return null

  const handleItemClick = (id: string): void => {
    onNavigate(id)
  }

  const renderTreeItem = (item: ContentTreeNode, index: number): JSX.Element => {
    const indent = (item.level - 1) * 20
    return (
      <div
        key={`${item.id}-${index}`}
        className="nav-item"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => handleItemClick(item.id)}
      >
        <span className={`nav-item-text nav-level-${item.level}`}>
          {item.text}
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="nav-overlay" onClick={onClose}></div>
      <nav className={`nav-menu ${isOpen ? 'nav-menu-open' : ''}`}>
        <div className="nav-header">
          <h2>Deliverance Star</h2>
          <div className="nav-header-actions">
            <button
              className="theme-toggle"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="nav-close-button" onClick={onClose} aria-label="Close menu">
              ×
            </button>
          </div>
        </div>
        <div className="nav-content">
          {contentTree.length === 0 ? (
            <div className="nav-empty">Loading...</div>
          ) : (
            contentTree.map((item, index) => renderTreeItem(item, index))
          )}
        </div>
      </nav>
    </>
  )
}

export default NavigationMenu
