"use client"

import type React from "react"

import { useState, useCallback, useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, Filter, Grid3X3, List, AlertCircle, ChevronDown } from "lucide-react"
import BookCard from "@/components/book-card"
import { usePageState } from "@/hooks"
import type { Book, BookState } from "@/types"

export default function DownloadBooksPage() {
  const { containerRef, pageState, updatePageState } = usePageState("download-books")
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    searchTerm,
    searchResults,
    selectedLanguage,
    selectedExtension,
    sortBy,
    viewMode,
    displayCount,
    downloadStatus,
    bookStates,
  } = pageState

  const getBookKey = useCallback((book: Book) => {
    return `${book.title.toLowerCase()}-${book.authors[0]?.toLowerCase() || ""}`
  }, [])

  const getBookState = useCallback(
    (book: Book): BookState => {
      const bookKey = getBookKey(book)
      return (
        bookStates[bookKey] || {
          isInLibrary: false,
          isFavorite: false,
          inReadingList: false,
        }
      )
    },
    [bookStates, getBookKey],
  )

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!searchTerm.trim()) return

      setLoading(true)
      setError(null)
      updatePageState({ searchResults: [], displayCount: 20 })

      try {
        const response: { results: Book[] } = await invoke("search_books", { term: searchTerm })
        updatePageState({ searchResults: response.results })
      } catch (err) {
        setError("Falha ao buscar livros. Tente novamente.")
        toast.error("Erro ao buscar livros")
      } finally {
        setLoading(false)
      }
    },
    [searchTerm, updatePageState],
  )

  const handleDownload = useCallback(
    async (book: Book) => {
      const bookState = getBookState(book)
      if (bookState.isInLibrary) {
        toast.warning("Este livro já está na sua biblioteca!")
        return
      }

      updatePageState((prevState) => ({
        downloadStatus: {
          ...prevState.downloadStatus,
          [book.edition_link]: {
            book_id: book.edition_link,
            file_name: `${book.title}.${book.extension}`,
            status: "pending",
            downloaded: 0,
            total: 0,
            percentage: 0,
          },
        },
      }))

      try {
        await invoke("download_book", { book })
        toast.success("Download iniciado!")
      } catch (err) {
        toast.error(`Erro ao iniciar download: ${err}`)
      }
    },
    [getBookState, updatePageState],
  )

  const handleToggleFavorite = useCallback(
    async (book: Book) => {
      try {
        const bookState = getBookState(book)
        let bookIdToUpdate = bookState.libraryId

        if (!bookState.isInLibrary) {
          bookIdToUpdate = await invoke<number>("add_book_to_library_command", { book })
          toast.success("Livro adicionado à biblioteca e aos favoritos!")
        }

        if (bookIdToUpdate) {
          await invoke("toggle_favorite_command", { bookId: bookIdToUpdate, isFavorite: !bookState.isFavorite })
        }
      } catch (error) {
        toast.error("Erro ao alterar favorito")
      }
    },
    [getBookState],
  )

  const handleToggleReadingList = useCallback(
    async (book: Book) => {
      try {
        const bookState = getBookState(book)
        let bookIdToUpdate = bookState.libraryId

        if (!bookState.isInLibrary) {
          bookIdToUpdate = await invoke<number>("add_book_to_library_command", { book })
          toast.success("Livro adicionado à biblioteca e à lista de leitura!")
        }

        if (bookIdToUpdate) {
          await invoke("toggle_reading_list_command", {
            bookId: bookIdToUpdate,
            isReadingList: !bookState.inReadingList,
          })
        }
      } catch (error) {
        toast.error("Erro ao alterar lista de leitura")
      }
    },
    [getBookState],
  )

  const handleCancelDownload = useCallback(
    async (bookId: string) => {
      try {
        await invoke("cancel_download", { bookId })
        updatePageState((prevState) => {
          const newDownloadStatus = { ...prevState.downloadStatus }
          delete newDownloadStatus[bookId]
          return { downloadStatus: newDownloadStatus }
        })
        toast.success("Download cancelado.")
      } catch (err) {
        toast.error("Erro ao cancelar download.")
      }
    },
    [updatePageState],
  )

  const processedBooks = useMemo(() => {
    const filtered = searchResults.filter((book) => {
      const matchesLanguage = selectedLanguage === "todos" || book.language === selectedLanguage
      const matchesExtension = selectedExtension === "todos" || book.extension === selectedExtension
      return matchesLanguage && matchesExtension
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "titulo":
          return a.title.localeCompare(b.title)
        case "autor":
          return a.authors[0]?.localeCompare(b.authors[0]) || 0
        case "ano":
          return Number(b.year) - Number(a.year)
        default:
          return 0
      }
    })
    return filtered
  }, [searchResults, selectedLanguage, selectedExtension, sortBy])

  const displayedBooks = useMemo(() => processedBooks.slice(0, displayCount), [processedBooks, displayCount])
  const hasMoreBooks = displayCount < processedBooks.length

  const languages = useMemo(
    () => Array.from(new Set(searchResults.map((book) => book.language))).filter(Boolean),
    [searchResults],
  )
  const extensions = useMemo(
    () => Array.from(new Set(searchResults.map((book) => book.extension))).filter(Boolean),
    [searchResults],
  )

  return (
    <div ref={containerRef} className="space-y-4 h-full overflow-auto p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Baixar Livros</h2>
          <p className="text-sm text-muted-foreground">Pesquise e baixe milhares de livros gratuitos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8 bg-transparent">
            <Filter className="h-4 w-4" />
          </Button>
          <div className="flex border rounded-md">
            <Button
              size="icon"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => updatePageState({ viewMode: "grid" })}
              className="rounded-r-none h-8 w-8"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => updatePageState({ viewMode: "list" })}
              className="rounded-l-none h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar livros por título, autor..."
            value={searchTerm}
            onChange={(e) => updatePageState({ searchTerm: e.target.value })}
            className="pl-10 h-9"
          />
        </div>
        <Button type="submit" disabled={loading} size="sm" className="h-9">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Pesquisar
        </Button>
      </form>

      {searchResults.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={selectedLanguage} onValueChange={(value) => updatePageState({ selectedLanguage: value })}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os idiomas</SelectItem>
              {languages.map((language: string) => (
                <SelectItem key={language} value={language}>
                  {language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedExtension} onValueChange={(value) => updatePageState({ selectedExtension: value })}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Formato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {extensions.map((extension: string) => (
                <SelectItem key={extension} value={extension}>
                  {extension.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => updatePageState({ sortBy: value })}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevancia">Relevância</SelectItem>
              <SelectItem value="titulo">Título</SelectItem>
              <SelectItem value="autor">Autor</SelectItem>
              <SelectItem value="ano">Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {error && (
        <Card className="border-border bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && searchResults.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Buscando livros...</span>
          </div>
        </div>
      )}

      {processedBooks.length > 0 && (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              : "space-y-2"
          }
        >
          {displayedBooks.map((book) => (
            <BookCard
              key={book.edition_link}
              book={book}
              currentDownload={downloadStatus[book.edition_link]}
              bookState={getBookState(book)}
              handleDownload={handleDownload}
              handleToggleFavorite={handleToggleFavorite}
              handleToggleReadingList={handleToggleReadingList}
              handleCancelDownload={handleCancelDownload}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {hasMoreBooks && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={() => updatePageState((prev) => ({ displayCount: prev.displayCount + 20 }))}
            disabled={loadingMore}
            variant="outline"
            size="sm"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" /> Mostrar mais ({processedBooks.length - displayCount})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
