"use client"

import { useEffect, useState, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { Loader2, LayoutGrid, List } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BookDetailsModal } from "@/components/book-details-modal"
import LibraryBookCard from "@/components/library-book-card"
import type { BookWithUserData } from "@/types"

interface BookListPageProps {
  type: "favorites" | "reading-list"
  title: string
  emptyMessage: string
  fetchCommand: string
}

export default function BookListPage({ type, title, emptyMessage, fetchCommand }: BookListPageProps) {
  const [books, setBooks] = useState<BookWithUserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedBook, setSelectedBook] = useState<BookWithUserData | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(`${type}-view-mode`) as "grid" | "list"
    if (saved) setViewMode(saved)
  }, [type])

  const changeViewMode = (mode: "grid" | "list") => {
    if (mode) {
      setViewMode(mode)
      localStorage.setItem(`${type}-view-mode`, mode)
    }
  }

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result: BookWithUserData[] = await invoke(fetchCommand)
      setBooks(result)
    } catch (err) {
      setError(`Falha ao carregar ${title.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }, [fetchCommand, title])

  const updateBookInList = useCallback(
    (updatedBook: BookWithUserData) => {
      setBooks((prevBooks) => {
        const shouldShow = type === "favorites" ? updatedBook.is_favorite : updatedBook.is_reading_list

        if (!shouldShow) {
          return prevBooks.filter((book) => book.id !== updatedBook.id)
        }

        const bookIndex = prevBooks.findIndex((book) => book.id === updatedBook.id)
        if (bookIndex >= 0) {
          const newBooks = [...prevBooks]
          newBooks[bookIndex] = updatedBook
          return newBooks
        } else {
          return [...prevBooks, updatedBook]
        }
      })
    },
    [type],
  )

  const removeBookFromList = useCallback((bookId: number) => {
    setBooks((prevBooks) => prevBooks.filter((book) => book.id !== bookId))
  }, [])

  useEffect(() => {
    let unlistenLibraryUpdate: (() => void) | null = null

    const setupListeners = async () => {
      try {
        unlistenLibraryUpdate = await listen("library-updated", (event: any) => {
          const { event_type, book_id, book } = event.payload

          switch (event_type) {
            case "book_added":
              if (
                book &&
                ((type === "favorites" && book.is_favorite) || (type === "reading-list" && book.is_reading_list))
              ) {
                updateBookInList(book)
                toast.success(`Livro "${book.title}" adicionado!`)
              }
              break
            case "book_removed":
              if (book_id) removeBookFromList(book_id)
              break
            case "book_updated":
            case "progress_updated":
            case "favorite_toggled":
            case "reading_list_toggled":
              if (book) updateBookInList(book)
              break
            case "library_refreshed":
              fetchBooks()
              break
          }
        })

        await invoke("start_library_listener")
      } catch (error) {
        console.error("Erro ao configurar listeners:", error)
      }
    }

    setupListeners()
    return () => unlistenLibraryUpdate?.()
  }, [updateBookInList, removeBookFromList, fetchBooks, type])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  const openReader = (book: BookWithUserData) => {
    if (!book.local_file_path) return toast("Livro não disponível")
    // Implement reader logic here
  }

  const handleUpdateLibrary = () => {
    fetchBooks()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" /> Carregando...
      </div>
    )
  }

  if (error) {
    return <div className="text-red-500 text-center p-8">{error}</div>
  }

  if (books.length === 0) {
    return <div className="text-center text-muted-foreground p-8">{emptyMessage}</div>
  }

  return (
    <div className="flex flex-1 flex-col gap-2 p-4 relative">
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            : "flex flex-col gap-4"
        }
      >
        {books.map((book) => (
          <LibraryBookCard
            key={book.id}
            book={book}
            viewMode={viewMode}
            onClick={() => {
              setSelectedBook(book)
              setShowDetails(true)
            }}
          />
        ))}
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={changeViewMode}
          className="bg-background border rounded-lg shadow-lg"
        >
          <ToggleGroupItem value="grid">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <BookDetailsModal
        book={selectedBook}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onOpenReader={openReader}
        onUpdate={handleUpdateLibrary}
      />
    </div>
  )
}
