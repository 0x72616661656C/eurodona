"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import type { BookWithUserData, PageState } from "@/types"

const initialPageState: PageState = {
  searchTerm: "",
  searchResults: [],
  selectedLanguage: "todos",
  selectedExtension: "todos",
  sortBy: "relevancia",
  viewMode: "grid",
  scrollPosition: 0,
  displayCount: 20,
  downloadStatus: {},
  bookStates: {},
}

export const useLibrary = () => {
  const [books, setBooks] = useState<BookWithUserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBooks = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | null = null

    const init = async () => {
      await fetchBooks()

      unlisten = await listen("library-updated", (event: any) => {
        const { event_type, book_id, book } = event.payload

        setBooks((prev) => {
          switch (event_type) {
            case "book_added":
              if (!book) return prev
              const exists = prev.find((b) => b.id === book.id)
              toast.success(`Livro "${book.title}" adicionado!`)
              return exists ? prev.map((b) => (b.id === book.id ? book : b)) : [...prev, book]

            case "book_removed":
              if (!book_id) return prev
              toast.info("Livro removido")
              return prev.filter((b) => b.id !== book_id)

            case "book_updated":
            case "progress_updated":
            case "favorite_toggled":
            case "reading_list_toggled":
              return book ? prev.map((b) => (b.id === book.id ? book : b)) : prev

            case "library_refreshed":
              fetchBooks()
              return prev

            default:
              return prev
          }
        })
      })

      await invoke("start_library_listener")
    }

    init()
    return () => unlisten?.()
  }, [fetchBooks])

  return { books, loading, error }
}

export const usePageState = (pageType: string) => {
  const location = useLocation()
  const isActive = location.pathname.includes(pageType)
  const [state, setState] = useState<PageState>(initialPageState)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${pageType}-state`)
      if (saved) {
        const parsedState = JSON.parse(saved)
        setState((prev) => ({ ...prev, ...parsedState, downloadStatus: {}, scrollPosition: 0 }))
      }
    } catch (error) {
      console.error("Erro ao carregar estado:", error)
    }
  }, [pageType])

  useEffect(() => {
    try {
      const stateToSave = { ...state, downloadStatus: {}, scrollPosition: 0 }
      localStorage.setItem(`${pageType}-state`, JSON.stringify(stateToSave))
    } catch (error) {
      console.error("Erro ao salvar estado:", error)
    }
  }, [state, pageType])

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const handleScroll = () => {
      if (!isActive) return

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)

      scrollTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, scrollPosition: container.scrollTop }))
      }, 150)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })

    if (state.scrollPosition > 0) {
      setTimeout(() => (container.scrollTop = state.scrollPosition), 50)
    }

    return () => {
      container.removeEventListener("scroll", handleScroll)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [isActive, state.scrollPosition])

  const updateState = useCallback((updates: Partial<PageState> | ((prev: PageState) => Partial<PageState>)) => {
    setState((prev) => ({
      ...prev,
      ...(typeof updates === "function" ? updates(prev) : updates),
    }))
  }, [])

  return { containerRef, pageState: state, updatePageState: updateState }
}
