export interface Book {
  title: string
  edition_link: string
  authors: string[]
  publisher: string
  year: string
  language: string
  pages: string
  size: string
  extension: string
  cover_url: string
  mirrors: string[]
  isbns: string[]
}

export interface BookWithUserData {
  title: string
  cover_url: string
  authors: string[]
  extension: string
  publisher: string
  year: string
  language: string
  id: number
  book: Book
  is_reading_list: boolean
  is_favorite: boolean
  reading_progress: number
  local_file_path?: string
}

export interface DownloadProgress {
  book_id: string
  file_name: string
  status: string
  downloaded: number
  total: number
  percentage: number
}

export interface AppSettings {
  download_path?: string | null
  max_concurrent_downloads: number
}

// Tipos melhorados para o leitor de livros
export interface BookContent {
  pages: BookPage[]
  total_pages: number
  chapters?: Chapter[]
  metadata?: BookMetadata
  resources: Record<string, string>
  extraction_info: ExtractionInfo
}

export interface BookPage {
  page_number: number
  content: string
  content_type: "text" | "html" | "image" | "mixed"
  images: PageImage[]
  chapter_title?: string
  word_count?: number
  reading_time_minutes?: number
  page_bounds?: PageBounds
}

export interface PageImage {
  id: string
  data: string // Base64
  mime_type: string
  width?: number
  height?: number
  position?: ImagePosition
}

export interface ImagePosition {
  x: number
  y: number
  width: number
  height: number
}

export interface PageBounds {
  width: number
  height: number
}

export interface Chapter {
  title: string
  page_start: number
  page_end?: number
  content_preview?: string
  level: number // Nível hierárquico do capítulo
}

export interface BookMetadata {
  title: string
  authors: string[]
  description?: string
  publisher?: string
  publication_date?: string
  language?: string
  isbn?: string
  cover_image?: string // Base64 encoded cover
  page_count?: number
  file_size?: number
}

export interface ExtractionInfo {
  format: string
  extraction_method: string
  has_images: boolean
  has_text: boolean
  extraction_quality: "high" | "medium" | "low"
}

export interface SearchResult {
  page_number: number
  context: string
}

// Resposta da busca do Libgen
export interface SearchResponse {
  results: Book[]
  raw_html: string
}

// Tipos para configurações do leitor
export interface ReaderSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  theme: "light" | "dark" | "sepia" | "auto"
  backgroundColor: string
  textColor: string
  margin: number
  columnCount: 1 | 2
  justifyText: boolean
  autoScroll: boolean
  pageTransition: "slide" | "fade" | "none"
}

// Tipos para progresso de leitura melhorado
export interface ReadingProgress {
  currentPage: number
  totalPages: number
  percentage: number
  timeSpent: number // em minutos
  wordsRead: number
  estimatedTimeRemaining: number
  lastReadAt: Date
  bookmarks: Bookmark[]
  notes: ReadingNote[]
  sessionStartTime: Date
  pagesReadInSession: number
}

export interface Bookmark {
  id: string
  page: number
  chapter?: string
  note?: string
  timestamp: Date
  color?: string
}

export interface ReadingNote {
  id: string
  page: number
  content: string
  timestamp: Date
  position?: { x: number; y: number }
}

// Tipos para temas responsivos
export interface ThemeColors {
  backgroundColor: string
  textColor: string
  surfaceColor: string
  borderColor: string
  primaryColor: string
  mutedColor: string
}

export interface ResponsiveTheme {
  light: ThemeColors
  dark: ThemeColors
  sepia: ThemeColors
}
