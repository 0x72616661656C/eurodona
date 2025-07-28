"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  CheckCircle,
  FileText,
  HardDrive,
  User,
  Loader2,
  Download,
  XCircle,
  BookOpen,
  BookMarked,
  Clock,
} from "lucide-react"
import OptimizedImage from "@/components/optimized-image"
import { getStatusColor, formatFileSize, getStatusIcon } from "@/lib/utils"
import type { BookCardProps } from "@/types"

const ActionButton = ({
  book,
  bookState,
  currentDownload,
  handleDownload,
  handleCancelDownload,
  handleToggleReadingList,
  isGridMode = false,
}: BookCardProps & { isGridMode?: boolean }) => {
  const isDownloading = currentDownload && ["pending", "starting", "downloading"].includes(currentDownload.status)
  const isCompleted = currentDownload?.status === "completed"

  return (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        className={`flex-1 h-7 text-xs font-medium ${isGridMode ? "px-2" : "px-3"}`}
        onClick={() => handleDownload(book)}
        disabled={isDownloading || bookState.isInLibrary || isCompleted}
        variant={bookState.isInLibrary ? "secondary" : "default"}
      >
        {bookState.isInLibrary ? (
          <>
            <BookOpen className="h-3 w-3 mr-1" /> Biblioteca
          </>
        ) : isCompleted ? (
          <>
            <CheckCircle className="h-3 w-3 mr-1" /> OK
          </>
        ) : currentDownload?.status === "pending" ? (
          <>
            <Clock className="h-3 w-3 mr-1" /> Fila
          </>
        ) : currentDownload?.status === "starting" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin mr-1" /> Iniciando
          </>
        ) : currentDownload?.status === "downloading" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin mr-1" /> {currentDownload.percentage.toFixed(0)}%
          </>
        ) : (
          <>
            <Download className="h-3 w-3 mr-1" /> Baixar
          </>
        )}
      </Button>

      {isDownloading && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0 bg-transparent"
          onClick={() => handleCancelDownload(book.edition_link)}
        >
          <XCircle className="h-3 w-3" />
        </Button>
      )}

      {!isGridMode && (
        <Button
          size="sm"
          variant={bookState.inReadingList ? "secondary" : "outline"}
          className="h-7 w-7 p-0"
          onClick={() => handleToggleReadingList(book)}
          disabled={!!isDownloading}
        >
          <BookMarked className={`h-3 w-3 ${bookState.inReadingList ? "fill-current" : ""}`} />
        </Button>
      )}
    </div>
  )
}

const BookCard = React.memo(({ book, currentDownload, bookState, viewMode, ...handlers }: BookCardProps) => {
  const isCompleted = currentDownload?.status === "completed"

  if (viewMode === "grid") {
    return (
      <Card className="overflow-hidden h-full rounded-md flex flex-col p-0">
        <div className="aspect-[2/3] relative overflow-hidden flex-shrink-0">
          <OptimizedImage src={book.cover_url} alt={book.title} className="w-full h-full" />

          <div className="absolute top-1.5 left-1.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
              {book.extension.toUpperCase()}
            </Badge>
          </div>

          <div className="absolute top-1.5 right-1.5">
            <Button size="icon" variant={bookState.inReadingList ? "secondary" : "outline"} className="h-6 w-6">
              <BookMarked className={`h-3 w-3 ${bookState.inReadingList ? "fill-current" : ""}`} />
            </Button>
          </div>

          {currentDownload && (
            <div className="absolute bottom-1.5 left-1.5">
              <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(currentDownload.status)} text-foreground`}>
                {getStatusIcon(currentDownload.status)}
                <span className="ml-1 capitalize">{currentDownload.status}</span>
              </Badge>
            </div>
          )}
        </div>

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
            <p className="line-clamp-1 font-mono">{formatFileSize(book.size)}</p>
          </div>

          {currentDownload?.status === "downloading" && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Baixando</span>
                <span className="font-mono text-foreground">{currentDownload.percentage.toFixed(0)}%</span>
              </div>
              <Progress value={currentDownload.percentage} className="h-1" />
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <CheckCircle className="h-3 w-3" />
              <span className="font-medium">Concluído</span>
            </div>
          )}
        </div>

        <div className="p-2.5 pt-0">
          <ActionButton
            book={book}
            bookState={bookState}
            currentDownload={currentDownload}
            {...handlers}
            isGridMode={true}
          />
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-md">
      <div className="p-4 flex gap-4">
        <div className="w-16 relative overflow-hidden flex-shrink-0 rounded-sm border">
          <OptimizedImage
            src={book.cover_url}
            alt={book.title}
            className="w-full h-auto object-cover"
            fallback="/placeholder.svg?height=64&width=48"
          />
          {currentDownload && (
            <div className="absolute bottom-0.5 left-0.5">
              <div className={`w-2 h-2 rounded-full border ${getStatusColor(currentDownload.status)}`} />
            </div>
          )}
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
              <span>{formatFileSize(book.size)}</span>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {book.language}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground font-mono line-clamp-1">{book.publisher}</div>

          {currentDownload?.status === "downloading" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Baixando...</span>
                <span className="font-mono tabular-nums text-foreground">{currentDownload.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={currentDownload.percentage} className="h-1.5" />
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <CheckCircle className="h-3 w-3" />
              <span className="font-medium">Download concluído</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-2">
          <ActionButton book={book} bookState={bookState} currentDownload={currentDownload} {...handlers} />
        </div>
      </div>
    </Card>
  )
})

BookCard.displayName = "BookCard"
export default BookCard
