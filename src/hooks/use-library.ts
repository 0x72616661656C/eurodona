"use client"

import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { BookWithUserData } from "@/types/book"
import { toast } from "sonner"

interface LibraryUpdateEvent {
  event_type: string
  book_id?: number
  book?: BookWithUserData
}

export function useLibrary() {
  const [books, setBooks] = useState<BookWithUserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBooks = async () => {
    setLoading(true)
    try {
      const result: BookWithUserData[] = await invoke("get_library_books_command")
      setBooks(result)
      setError(null)
    } catch (err) {
      setError("Falha ao carregar livros da biblioteca.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | null = null

    const init = async () => {
      await fetchBooks()

      unlisten = await listen<LibraryUpdateEvent>("library-updated", (event) => {
        const { event_type, book_id, book } = event.payload

        switch (event_type) {
          case "book_added":
            if (book) {
              setBooks((prev) => {
                const exists = prev.find((b) => b.id === book.id)
                return exists ? prev.map((b) => (b.id === book.id ? book : b)) : [...prev, book]
              })
              toast.success(`Livro "${book.title}" adicionado!`)
            }
            break
          case "book_removed":
            if (book_id) {
              setBooks((prev) => prev.filter((b) => b.id !== book_id))
              toast.info("Livro removido")
            }
            break
          case "book_updated":
          case "progress_updated":
          case "favorite_toggled":
          case "reading_list_toggled":
            if (book) {
              setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)))
            }
            break
          case "library_refreshed":
            fetchBooks()
            break
        }
      })

      await invoke("start_library_listener")
    }

    init()
    return () => unlisten?.()
  }, [])

  return { books, loading, error }
}
