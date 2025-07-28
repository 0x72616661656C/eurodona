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

export interface BookWithUserData extends Book {
  id: number
  book?: Book
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

export interface BookState {
  isInLibrary: boolean
  isFavorite: boolean
  inReadingList: boolean
  libraryId?: number
}

export interface BookCardProps {
  book: Book
  currentDownload?: DownloadProgress
  bookState: BookState
  handleDownload: (book: Book) => Promise<void>
  handleToggleFavorite: (book: Book) => Promise<void>
  handleToggleReadingList: (book: Book) => Promise<void>
  handleCancelDownload: (bookId: string) => Promise<void>
  viewMode: "grid" | "list"
}

export interface PageState {
  searchTerm: string
  searchResults: Book[]
  selectedLanguage: string
  selectedExtension: string
  sortBy: string
  viewMode: "grid" | "list"
  scrollPosition: number
  displayCount: number
  downloadStatus: Record<string, DownloadProgress | undefined>
  bookStates: Record<string, BookState>
}

// Novos tipos para configurações
export interface AppSettings {
  // Download settings
  download_path?: string | null
  max_concurrent_downloads: number
  auto_open_after_download: boolean
  download_notifications: boolean

  // UI settings
  theme: string
  default_view_mode: string
  books_per_page: number
  compact_mode: boolean

  // Reading settings
  auto_bookmark: boolean
  reading_timer: boolean
  show_reading_progress: boolean
  default_font_size: number
  reading_background: string

  // Library settings
  auto_backup: boolean
  backup_frequency: string
  auto_cleanup: boolean
  cache_size_mb: number

  // Privacy settings
  analytics_enabled: boolean
  crash_reports: boolean

  // Advanced settings
  debug_mode: boolean
  experimental_features: boolean
}

export interface SettingsUpdateEvent {
  event_type: string
  setting_key?: string
  setting_value?: any
  settings?: AppSettings
}
