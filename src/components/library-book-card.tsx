"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Calendar, CheckCircle, FileText, HardDrive, User, BookMarked, Heart } from "lucide-react"
import OptimizedImage from "@/components/optimized-image"
import { formatFileSize } from "@/lib/utils"
import type { BookWithUserData } from "@/types"

interface LibraryBookCardProps {
  book: BookWithUserData
  viewMode: "grid" | "list"
  onClick: () => void
}

const LibraryBookCard = React.memo(({ book, viewMode, onClick }: LibraryBookCardProps) => {
  if (viewMode === "grid") {
    return (
      <Card
        className="overflow-hidden h-full rounded-md flex flex-col p-0 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <div className="aspect-[2/3] relative overflow-hidden flex-shrink-0">
          <OptimizedImage src={book.cover_url} alt={book.title} className="w-full h-full" />

          {/* Badges e botões de ação sobre a imagem */}
          <div className="absolute top-1.5 left-1.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
              {book.extension.toUpperCase()}
            </Badge>
          </div>

          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
            {book.is_favorite && (
              <Button size="icon" variant="secondary" className="h-6 w-6">
                <Heart className="h-3 w-3 fill-current text-red-500" />
              </Button>
            )}
            {book.is_reading_list && (
              <Button size="icon" variant="secondary" className="h-6 w-6">
                <BookMarked className="h-3 w-3 fill-current text-blue-500" />
              </Button>
            )}
          </div>

          {/* Progress badge */}
          <div className="absolute bottom-1.5 right-1.5">
            <Badge className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground">{book.reading_progress}%</Badge>
          </div>
        </div>

        {/* Conteúdo de texto com padding reduzido */}
        <div className="p-2.5 space-y-1.5 flex-grow flex flex-col">
          <div className="space-y-0.5">
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight text-foreground">{book.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{book.authors.join(", ")}</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{book.year}</span>
            <Separator orientation="vertical" className="h-2.5" />
            <Badge variant="outline" className="text-xs">
              {book.language}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5 flex-grow">
            <p className="line-clamp-1 font-mono">{formatFileSize(book.book?.size || "0B")}</p>
          </div>

          {/* Progress bar */}
          {book.reading_progress > 0 && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Progresso</span>
                <span className="font-mono text-foreground">{book.reading_progress}%</span>
              </div>
              <Progress value={book.reading_progress} className="h-1" />
            </div>
          )}

          {book.local_file_path && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <CheckCircle className="h-3 w-3" />
              <span className="font-medium">Disponível</span>
            </div>
          )}
        </div>
      </Card>
    )
  }

  // ViewMode "list"
  return (
    <Card className="rounded-md cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="p-4 flex gap-4">
        <div className="w-16 relative overflow-hidden flex-shrink-0 rounded-sm border">
          <OptimizedImage
            src={book.cover_url}
            alt={book.title}
            className="w-full h-auto object-cover"
            fallback="/placeholder.svg?height=64&width=48"
          />
          {/* Progress indicator */}
          <div className="absolute bottom-0.5 right-0.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <h3 className="font-semibold text-base line-clamp-1 leading-tight text-foreground">{book.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-1 font-mono">
              <User className="h-3 w-3 inline mr-1" />
              {book.authors.join(", ")}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{book.year}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="uppercase font-semibold">{book.extension}</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <span>{formatFileSize(book.book?.size || "0B")}</span>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {book.language}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground font-mono line-clamp-1">{book.publisher}</div>

          {/* Progress bar for list view */}
          {book.reading_progress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Progresso de leitura</span>
                <span className="font-mono tabular-nums text-foreground">{book.reading_progress}%</span>
              </div>
              <Progress value={book.reading_progress} className="h-1.5" />
            </div>
          )}

          {book.local_file_path && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <CheckCircle className="h-3 w-3" />
              <span className="font-medium">Livro disponível</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-2">
          <div className="flex gap-1">
            {book.is_favorite && (
              <Button size="icon" variant="outline" className="h-7 w-7 bg-transparent">
                <Heart className="h-3 w-3 fill-current text-red-500" />
              </Button>
            )}
            {book.is_reading_list && (
              <Button size="icon" variant="outline" className="h-7 w-7 bg-transparent">
                <BookMarked className="h-3 w-3 fill-current text-blue-500" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
})

LibraryBookCard.displayName = "LibraryBookCard"
export default LibraryBookCard
