import type { Book, DownloadProgress } from "@/types/book" // Assumindo que Book e DownloadProgress já existem aqui

// Tipos para integração com o backend
export interface BookWithUserData {
  id: number
  title: string
  authors: string[]
  publisher: string
  year: string
  language: string
  extension: string
  size: string
  edition_link: string
  cover_url?: string
  file_path?: string
  is_favorite: boolean
  is_reading_list: boolean
  reading_progress: number
}

// Estado individual de cada livro
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
