export type Theme = 'light' | 'dark'

export interface Footnote {
  id: string
  content: string
}

export interface ContentTreeNode {
  level: number
  text: string
  id: string
}
