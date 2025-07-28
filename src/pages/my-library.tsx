"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, LayoutGrid, List } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookDetailsModal } from "@/components/book-details-modal"
import { useLibrary } from "@/hooks"
import LibraryBookCard from "@/components/library-book-card"
import type { BookWithUserData } from "@/types"

export default function MyLibraryPage() {
  const { books, loading, error } = useLibrary()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedBook, setSelectedBook] = useState<BookWithUserData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showReader, setShowReader] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("library-view-mode") as "grid" | "list"
    if (saved) setViewMode(saved)
  }, [])

  const changeViewMode = (mode: "grid" | "list") => {
    if (mode) {
      setViewMode(mode)
      localStorage.setItem("library-view-mode", mode)
    }
  }

  const openReader = (book: BookWithUserData) => {
    if (!book.local_file_path) return toast("Livro não disponível")
    setSelectedBook(book)
    setShowReader(true)
    setShowDetails(false)
  }

  const handleUpdateLibrary = () => {
    // Força uma atualização da biblioteca
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" /> Carregando...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-destructive">Oops!</CardTitle>
            <CardDescription>Algo deu errado.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (books.length === 0) {
    return <div className="text-center text-muted-foreground p-8">Sua biblioteca está vazia. Baixe alguns livros!</div>
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

      {showReader && selectedBook && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* BookReader component would go here */}
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Leitor de Livros</h2>
              <p className="text-muted-foreground mb-4">Lendo: {selectedBook.title}</p>
              <button
                onClick={() => setShowReader(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
