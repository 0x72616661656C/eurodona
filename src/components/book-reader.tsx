"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Search,
  X,
  Menu,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookmarkIcon,
  Settings,
  Trash2,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Palette,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Tipos expandidos
export type BookPage = {
  page_number: number
  content: string
  word_count?: number
  chapter_title?: string
}

export type BookMetadata = {
  title: string
  authors: string[]
  publisher?: string
  publication_date?: string
  language?: string
  isbn?: string
  description?: string
  cover_image?: string
  page_count: number
  file_size?: number
  format: string
}

export type BookChapter = {
  title: string
  page_start: number
  page_end?: number
  level: number
}

export type BookContent = {
  total_pages: number
  pages: BookPage[]
  resources: { [key: string]: string } // resource_name -> base64_data
  stylesheets: string[]
  metadata: BookMetadata
  chapters: BookChapter[]
  internal_file_map?: { [filePath: string]: number } // NEW: Maps internal file paths (e.g., "OEBPS/text/chapter1.xhtml") to page numbers
}

export type SearchResult = {
  page_number: number
  context: string
  position: number
  chapter_title?: string
}

// Temas expandidos
const THEMES = {
  light: {
    name: "Claro",
    icon: Sun,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    surfaceColor: "#f8f9fa",
    borderColor: "#e9ecef",
    primaryColor: "#0066cc",
    mutedColor: "#6c757d",
  },
  dark: {
    name: "Escuro",
    icon: Moon,
    backgroundColor: "#0d1117",
    textColor: "#e6edf3",
    surfaceColor: "#161b22",
    borderColor: "#30363d",
    primaryColor: "#58a6ff",
    mutedColor: "#8b949e",
  },
  auto: {
    name: "Automático",
    icon: Monitor,
    backgroundColor: "auto",
    textColor: "auto",
    surfaceColor: "auto",
    borderColor: "auto",
    primaryColor: "auto",
    mutedColor: "auto",
  },
  amoled: {
    name: "AMOLED",
    icon: Moon,
    backgroundColor: "#000000",
    textColor: "#ffffff",
    surfaceColor: "#111111",
    borderColor: "#333333",
    primaryColor: "#bb86fc",
    mutedColor: "#888888",
  },
  sepia: {
    name: "Sépia",
    icon: Palette,
    backgroundColor: "#f4f3e8",
    textColor: "#5c4b37",
    surfaceColor: "#ede8d3",
    borderColor: "#d4c5a9",
    primaryColor: "#8b4513",
    mutedColor: "#8b7355",
  },
  gruvbox: {
    name: "Gruvbox",
    icon: Palette,
    backgroundColor: "#282828",
    textColor: "#ebdbb2",
    surfaceColor: "#3c3836",
    borderColor: "#504945",
    primaryColor: "#fe8019",
    mutedColor: "#a89984",
  },
}

interface BookReaderProps {
  bookTitle: string
  bookAuthor: string
  filePath: string
  fileType: "pdf" | "epub" | "txt" | "cbz" | "cbr" | "mobi"
  onClose: () => void
  onProgressUpdate?: (progress: any) => void
}

export function BookReader({ bookTitle, bookAuthor, filePath, fileType, onClose, onProgressUpdate }: BookReaderProps) {
  // Estados principais
  const [currentPage, setCurrentPage] = useState(1)
  const [bookContent, setBookContent] = useState<BookContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados de interface
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarTab, setSidebarTab] = useState("chapters")
  const [zoom, setZoom] = useState(100)

  // Estados de configuração
  const [settings, setSettings] = useState({
    fontSize: 16,
    fontFamily: "serif",
    lineHeight: 1.6,
    theme: "auto",
    viewMode: "scroll", // "scroll" ou "pages"
    preserveOriginalFormatting: true,
  })

  // Estados de funcionalidades
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [bookmarks, setBookmarks] = useState<
    { id: string; page: number; title: string; note?: string; timestamp: Date; chapter_title?: string }[]
  >([])
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false)
  const [newBookmarkNote, setNewBookmarkNote] = useState("")
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [pendingLink, setPendingLink] = useState<string | null>(null)

  // Refs
  const shadowHostRef = useRef<HTMLDivElement>(null) // Ref para o host do Shadow DOM

  // Detectar tema do sistema
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemTheme(mediaQuery.matches ? "dark" : "light")

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Aplicar tema
  const effectiveTheme = settings.theme === "auto" ? systemTheme : settings.theme
  const themeColors = THEMES[effectiveTheme as keyof typeof THEMES] || THEMES.light

  // Carregar conteúdo do livro
  const loadBookContent = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const content: BookContent = await invoke("read_book_content", { filePath, fileType })
      setBookContent(content)
    } catch (error) {
      console.error("Erro ao carregar conteúdo:", error)
      setError(String(error))
    } finally {
      setIsLoading(false)
    }
  }, [filePath, fileType])

  // Navegação
  const goToPage = useCallback(
    (page: number) => {
      if (!bookContent || page < 1 || page > bookContent.total_pages) return
      setCurrentPage(page)
      onProgressUpdate?.({
        currentPage: page,
        totalPages: bookContent.total_pages,
        percentage: Math.round((page / bookContent.total_pages) * 100),
      })
    },
    [bookContent, onProgressUpdate],
  )

  const nextPage = () => {
    if (currentPage < (bookContent?.total_pages || 0)) {
      goToPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1)
    }
  }

  // Zoom
  const zoomIn = () => setZoom(Math.min(zoom + 25, 300))
  const zoomOut = () => setZoom(Math.max(zoom - 25, 50))
  const resetZoom = () => setZoom(100)

  // Busca
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results: SearchResult[] = await invoke("search_in_book_command", {
        filePath,
        query,
      })
      setSearchResults(results)
    } catch (error) {
      console.error("Erro na busca:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Marcadores
  const addBookmark = () => {
    const currentPageContent = bookContent?.pages[currentPage - 1]
    const newBookmark = {
      id: Date.now().toString(),
      page: currentPage,
      title: `Página ${currentPage}`,
      note: newBookmarkNote,
      timestamp: new Date(),
      chapter_title: currentPageContent?.chapter_title,
    }

    setBookmarks([...bookmarks, newBookmark])
    setNewBookmarkNote("")
    setShowBookmarkDialog(false)
  }

  const removeBookmark = (id: string) => {
    setBookmarks(bookmarks.filter((b) => b.id !== id))
  }

  // Renderizar conteúdo da página no Shadow DOM
  useEffect(() => {
    const shadowHost = shadowHostRef.current
    if (!shadowHost || !bookContent) return

    // Limpar Shadow DOM existente se houver
    if (shadowHost.shadowRoot) {
      shadowHost.shadowRoot.innerHTML = ""
    }

    // Criar ou obter Shadow DOM
    const shadowRoot = shadowHost.shadowRoot || shadowHost.attachShadow({ mode: "open" })

    // Injetar estilos do livro no Shadow DOM
    if (bookContent.stylesheets.length > 0) {
      const styleElement = document.createElement("style")
      styleElement.textContent = bookContent.stylesheets.join("\n")
      shadowRoot.appendChild(styleElement)
    }

    // Adicionar estilos base para reset e tipografia se não for preservar formatação original
    if (!settings.preserveOriginalFormatting) {
      const baseStyles = `
        :host {
          display: block;
          font-size: ${settings.fontSize}px;
          font-family: ${settings.fontFamily};
          line-height: ${settings.lineHeight};
          color: ${themeColors.textColor};
        }
        body {
          margin: 0;
          padding: 0;
        }
        /* Basic typography resets for better readability */
        p { margin-top: 1em; margin-bottom: 1em; }
        h1, h2, h3, h4, h5, h6 { margin-top: 2em; margin-bottom: 1em; font-weight: bold; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.2em; }
        ul, ol { margin-left: 1.5em; }
        a { color: ${themeColors.primaryColor}; text-decoration: underline; cursor: pointer; }
        img, svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
      `
      const baseStyleElement = document.createElement("style")
      baseStyleElement.textContent = baseStyles
      shadowRoot.appendChild(baseStyleElement)
    }

    const currentPageHtml = bookContent.pages[currentPage - 1]?.content
    if (currentPageHtml) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(currentPageHtml, "application/xml") // Use application/xml for XHTML

      // Processar imagens (src e xlink:href)
      const processImageSrc = (element: Element, attr: string) => {
        const originalSrc = element.getAttribute(attr)
        if (originalSrc && bookContent.resources[originalSrc]) {
          // Assumindo que o tipo de imagem pode ser inferido ou é sempre jpeg/png
          // O backend deve fornecer o tipo MIME correto ou o nome do arquivo deve ter a extensão
          const fileExtension = originalSrc.split(".").pop()?.toLowerCase()
          let mimeType = "image/jpeg" // Default
          if (fileExtension === "png") mimeType = "image/png"
          else if (fileExtension === "gif") mimeType = "image/gif"
          else if (fileExtension === "svg") mimeType = "image/svg+xml"
          // Adicione mais tipos conforme necessário

          const dataUrl = `data:${mimeType};base64,${bookContent.resources[originalSrc]}`
          element.setAttribute(attr, dataUrl)
        }
      }

      doc.querySelectorAll("img").forEach((img) => processImageSrc(img, "src"))
      doc.querySelectorAll("image").forEach((img) => processImageSrc(img, "xlink:href")) // Para SVG <image>

      // Processar links
      doc.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href")
        if (href) {
          if (href.startsWith("#")) {
            // Link interno na mesma página, o navegador lida com isso
          } else if (href.startsWith("http://") || href.startsWith("https://")) {
            // Link externo, será tratado pelo listener de click
            a.setAttribute("target", "_blank") // Abrir em nova aba
            a.setAttribute("rel", "noopener noreferrer") // Segurança
          } else {
            // Link interno para outra "página" (arquivo XHTML)
            const resolvedPath = href.split("#")[0] // Remove âncora para buscar o arquivo
            const anchor = href.includes("#") ? "#" + href.split("#")[1] : ""

            if (bookContent.internal_file_map && bookContent.internal_file_map[resolvedPath]) {
              const targetPage = bookContent.internal_file_map[resolvedPath]
              a.setAttribute("data-internal-page-target", String(targetPage))
              a.setAttribute("data-internal-anchor", anchor)
              a.removeAttribute("href") // Remover href para evitar navegação padrão
            } else {
              // Se não puder resolver, tratar como link externo ou logar erro
              console.warn(`Link interno não resolvido: ${href}`)
              a.setAttribute("target", "_blank")
              a.setAttribute("rel", "noopener noreferrer")
            }
          }
        }
      })

      // Adicionar o conteúdo processado ao Shadow DOM
      // É importante adicionar os filhos do <body>, não o <html> ou <body> em si
      Array.from(doc.documentElement.querySelector("body")?.children || []).forEach((child) => {
        shadowRoot.appendChild(child.cloneNode(true))
      })

      // Adicionar listener de click ao Shadow DOM para links
      const handleShadowClick = (event: Event) => {
        const target = event.target as HTMLElement
        if (target.tagName === "A") {
          const externalHref = target.getAttribute("href")
          const internalPageTarget = target.getAttribute("data-internal-page-target")
          const internalAnchor = target.getAttribute("data-internal-anchor")

          if (externalHref && (externalHref.startsWith("http://") || externalHref.startsWith("https://"))) {
            event.preventDefault()
            setPendingLink(externalHref)
            setShowLinkDialog(true)
          } else if (internalPageTarget) {
            event.preventDefault()
            const pageNum = Number.parseInt(internalPageTarget, 10)
            if (!isNaN(pageNum)) {
              goToPage(pageNum)
              // Se houver âncora, esperar a página renderizar e rolar
              if (internalAnchor && internalAnchor !== "#") {
                // Pequeno delay para garantir que o conteúdo da nova página esteja no DOM
                setTimeout(() => {
                  const element = shadowRoot.querySelector(internalAnchor)
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" })
                  }
                }, 100)
              }
            }
          }
        }
      }
      shadowRoot.addEventListener("click", handleShadowClick)

      // Cleanup function for the event listener
      return () => {
        shadowRoot.removeEventListener("click", handleShadowClick)
      }
    }
  }, [
    currentPage,
    bookContent,
    settings.preserveOriginalFormatting,
    settings.fontSize,
    settings.fontFamily,
    settings.lineHeight,
    themeColors,
  ])

  // Efeitos
  useEffect(() => {
    loadBookContent()
  }, [loadBookContent])

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault()
          prevPage()
          break
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault()
          nextPage()
          break
        case "Home":
          e.preventDefault()
          goToPage(1)
          break
        case "End":
          e.preventDefault()
          goToPage(bookContent?.total_pages || 1)
          break
        case "Escape":
          onClose()
          break
        case "b":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setShowBookmarkDialog(true)
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentPage, bookContent, onClose])

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center w-full h-full min-h-screen transition-colors duration-200"
        style={{ backgroundColor: themeColors.backgroundColor, color: themeColors.textColor }}
      >
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 animate-pulse mx-auto" style={{ color: themeColors.primaryColor }} />
          <div>
            <p className="text-lg font-medium">Carregando livro...</p>
            <p className="text-sm" style={{ color: themeColors.mutedColor }}>
              Preservando formatações originais...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center w-full h-full min-h-screen"
        style={{ backgroundColor: themeColors.backgroundColor }}
      >
        <Card style={{ backgroundColor: themeColors.surfaceColor, borderColor: themeColors.borderColor }}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar livro</h3>
            <p className="text-sm mb-4" style={{ color: themeColors.mutedColor }}>
              {error}
            </p>
            <div className="flex gap-2">
              <Button onClick={loadBookContent} variant="outline">
                Tentar novamente
              </Button>
              <Button onClick={onClose} variant="secondary">
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div
      className="flex w-full h-full min-h-screen transition-colors duration-200"
      style={{
        backgroundColor: themeColors.backgroundColor,
        color: themeColors.textColor,
      }}
    >
      {/* Sidebar */}
      {showSidebar && (
        <div
          className="w-80 border-r flex-shrink-0 h-full"
          style={{
            backgroundColor: themeColors.surfaceColor,
            borderColor: themeColors.borderColor,
          }}
        >
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Navegação</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="chapters">Capítulos</TabsTrigger>
                <TabsTrigger value="bookmarks">Marcadores</TabsTrigger>
                <TabsTrigger value="search">Busca</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
              </TabsList>

              <div className="flex-1 mt-4 overflow-hidden">
                <TabsContent value="chapters" className="h-full">
                  <ScrollArea className="h-full">
                    {bookContent?.chapters?.map((chapter, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start mb-1 text-left",
                          currentPage >= chapter.page_start &&
                            currentPage <= (chapter.page_end || bookContent.total_pages) &&
                            "bg-primary/10",
                        )}
                        style={{ paddingLeft: `${chapter.level * 12}px` }}
                        onClick={() => goToPage(chapter.page_start)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{chapter.title}</div>
                          <div className="text-xs" style={{ color: themeColors.mutedColor }}>
                            Página {chapter.page_start}
                          </div>
                        </div>
                      </Button>
                    ))}
                    {(!bookContent?.chapters || bookContent.chapters.length === 0) && (
                      <div className="text-center py-8" style={{ color: themeColors.mutedColor }}>
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum capítulo detectado</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="bookmarks" className="h-full">
                  <div className="space-y-2 h-full flex flex-col">
                    <Button onClick={() => setShowBookmarkDialog(true)} className="w-full">
                      <BookmarkIcon className="h-4 w-4 mr-2" />
                      Adicionar Marcador
                    </Button>

                    <ScrollArea className="flex-1">
                      {bookmarks.map((bookmark) => (
                        <Card
                          key={bookmark.id}
                          className="mb-2"
                          style={{ backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }}
                        >
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{bookmark.title}</p>
                                {bookmark.chapter_title && (
                                  <p className="text-xs truncate" style={{ color: themeColors.mutedColor }}>
                                    {bookmark.chapter_title}
                                  </p>
                                )}
                                {bookmark.note && (
                                  <p
                                    className="text-xs mt-1 p-2 rounded"
                                    style={{ backgroundColor: themeColors.surfaceColor }}
                                  >
                                    {bookmark.note}
                                  </p>
                                )}
                                <p className="text-xs mt-1" style={{ color: themeColors.mutedColor }}>
                                  {bookmark.timestamp.toLocaleDateString()}
                                </p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => removeBookmark(bookmark.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              variant="link"
                              className="p-0 h-auto text-xs"
                              onClick={() => goToPage(bookmark.page)}
                            >
                              Ir para página {bookmark.page}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {bookmarks.length === 0 && (
                        <div className="text-center py-8" style={{ color: themeColors.mutedColor }}>
                          <BookmarkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Nenhum marcador adicionado</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="search" className="h-full">
                  <div className="space-y-2 h-full flex flex-col">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Buscar no livro..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && performSearch(searchQuery)}
                      />
                      <Button onClick={() => performSearch(searchQuery)} disabled={isSearching} size="icon">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>

                    <ScrollArea className="flex-1">
                      {isSearching && (
                        <div className="text-center py-4">
                          <Search className="h-6 w-6 animate-pulse mx-auto mb-2" />
                          <p className="text-sm" style={{ color: themeColors.mutedColor }}>
                            Buscando...
                          </p>
                        </div>
                      )}
                      {searchResults.map((result, index) => (
                        <Card
                          key={index}
                          className="mb-2 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => goToPage(result.page_number)}
                          style={{ backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }}
                        >
                          <CardContent className="p-3">
                            <p className="text-sm font-medium">Página {result.page_number}</p>
                            {result.chapter_title && (
                              <p className="text-xs" style={{ color: themeColors.mutedColor }}>
                                {result.chapter_title}
                              </p>
                            )}
                            <p className="text-xs line-clamp-3 mt-1" style={{ color: themeColors.mutedColor }}>
                              {result.context}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                      {!isSearching && searchResults.length === 0 && searchQuery && (
                        <div className="text-center py-8" style={{ color: themeColors.mutedColor }}>
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Nenhum resultado encontrado</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="info" className="h-full">
                  <ScrollArea className="h-full">
                    <div className="space-y-4">
                      <Card
                        style={{ backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }}
                      >
                        <CardHeader>
                          <CardTitle className="text-sm">Metadados do Livro</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div>
                            <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                              Título
                            </Label>
                            <p className="text-sm">{bookContent?.metadata?.title || bookTitle}</p>
                          </div>
                          <div>
                            <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                              Autor(es)
                            </Label>
                            <p className="text-sm">{bookContent?.metadata?.authors.join(", ") || bookAuthor}</p>
                          </div>
                          {bookContent?.metadata?.publisher && (
                            <div>
                              <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                                Editora
                              </Label>
                              <p className="text-sm">{bookContent.metadata.publisher}</p>
                            </div>
                          )}
                          {bookContent?.metadata?.publication_date && (
                            <div>
                              <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                                Data de Publicação
                              </Label>
                              <p className="text-sm">{bookContent.metadata.publication_date}</p>
                            </div>
                          )}
                          {bookContent?.metadata?.isbn && (
                            <div>
                              <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                                ISBN
                              </Label>
                              <p className="text-sm">{bookContent.metadata.isbn}</p>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                              Formato
                            </Label>
                            <p className="text-sm">{bookContent?.metadata?.format}</p>
                          </div>
                          <div>
                            <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                              Páginas
                            </Label>
                            <p className="text-sm">{bookContent?.metadata?.page_count}</p>
                          </div>
                          {bookContent?.metadata?.file_size && (
                            <div>
                              <Label className="text-xs" style={{ color: themeColors.mutedColor }}>
                                Tamanho do Arquivo
                              </Label>
                              <p className="text-sm">{Math.round(bookContent.metadata.file_size / 1024 / 1024)} MB</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col h-full">
        {/* Barra superior */}
        <div
          className="flex items-center justify-between p-4 border-b flex-shrink-0"
          style={{
            backgroundColor: themeColors.surfaceColor,
            borderColor: themeColors.borderColor,
          }}
        >
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar(!showSidebar)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="font-semibold text-sm">{bookContent?.metadata?.title || bookTitle}</p>
              <p className="text-xs" style={{ color: themeColors.mutedColor }}>
                {bookContent?.metadata?.authors.join(", ") || bookAuthor}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="secondary">{zoom}%</Badge>
            <Button variant="ghost" size="icon" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={resetZoom}>
              <RotateCcw className="h-4 w-4" />
            </Button>

            {/* Configurações */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Configurações do Leitor</DialogTitle>
                  <DialogDescription>Personalize sua experiência de leitura</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tema</Label>
                    <Select
                      value={settings.theme}
                      onValueChange={(value) => setSettings((prev) => ({ ...prev, theme: value }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(THEMES).map(([key, theme]) => {
                          const IconComponent = theme.icon
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                {theme.name}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Modo de Visualização</Label>
                    <Select
                      value={settings.viewMode}
                      onValueChange={(value) => setSettings((prev) => ({ ...prev, viewMode: value }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scroll">Rolagem Contínua</SelectItem>
                        <SelectItem value="pages">Páginas Laterais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tamanho da Fonte</Label>
                    <Slider
                      value={[settings.fontSize]}
                      onValueChange={([value]) => setSettings((prev) => ({ ...prev, fontSize: value }))}
                      min={12}
                      max={24}
                      step={1}
                      className="mt-2"
                    />
                    <div className="text-xs text-muted-foreground mt-1">{settings.fontSize}px</div>
                  </div>

                  <div>
                    <Label>Família da Fonte</Label>
                    <Select
                      value={settings.fontFamily}
                      onValueChange={(value) => setSettings((prev) => ({ ...prev, fontFamily: value }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serif">Serif</SelectItem>
                        <SelectItem value="sans-serif">Sans Serif</SelectItem>
                        <SelectItem value="monospace">Monospace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Preservar Formatação Original</Label>
                    <Switch
                      checked={settings.preserveOriginalFormatting}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, preserveOriginalFormatting: checked }))
                      }
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Área de conteúdo */}
        <div className="flex-1 overflow-auto">
          <ScrollArea className="h-full w-full">
            <div
              ref={shadowHostRef} // O host do Shadow DOM
              className={cn(
                "max-w-4xl mx-auto p-8 transition-all duration-200",
                settings.viewMode === "pages" && "min-h-full flex items-center justify-center",
              )}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                minHeight: settings.viewMode === "scroll" ? "100%" : "auto",
              }}
            >
              {/* O conteúdo do livro será injetado aqui via Shadow DOM */}
            </div>
          </ScrollArea>
        </div>

        {/* Barra inferior */}
        <div
          className="flex items-center justify-between p-4 border-t flex-shrink-0"
          style={{
            backgroundColor: themeColors.surfaceColor,
            borderColor: themeColors.borderColor,
          }}
        >
          <Button variant="ghost" size="icon" onClick={prevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-4 flex-1 mx-8">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value))}
                className="w-16 text-center"
                min={1}
                max={bookContent?.total_pages || 1}
              />
              <span className="text-sm" style={{ color: themeColors.mutedColor }}>
                de {bookContent?.total_pages || 0}
              </span>
            </div>

            <Slider
              value={[currentPage]}
              onValueChange={([value]) => goToPage(value)}
              min={1}
              max={bookContent?.total_pages || 1}
              step={1}
              className="flex-1"
            />

            <Badge variant="secondary">
              {bookContent ? Math.round((currentPage / bookContent.total_pages) * 100) : 0}%
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={nextPage}
            disabled={currentPage >= (bookContent?.total_pages || 0)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialog para adicionar marcador */}
      <Dialog open={showBookmarkDialog} onOpenChange={setShowBookmarkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Marcador</DialogTitle>
            <DialogDescription>
              Página {currentPage}
              {bookContent?.pages[currentPage - 1]?.chapter_title &&
                ` - ${bookContent.pages[currentPage - 1]?.chapter_title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bookmark-note">Nota (opcional)</Label>
              <Textarea
                id="bookmark-note"
                placeholder="Adicione uma nota para este marcador..."
                value={newBookmarkNote}
                onChange={(e) => setNewBookmarkNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBookmarkDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addBookmark}>Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para links externos */}
      <AlertDialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abrir Link Externo</AlertDialogTitle>
            <AlertDialogDescription>
              O livro quer abrir o seguinte link no seu navegador:
              <br />
              <br />
              <code className="bg-muted p-1 rounded text-sm break-all">{pendingLink}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingLink(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLink) {
                  window.open(pendingLink, "_blank")
                }
                setPendingLink(null)
                setShowLinkDialog(false)
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Navegador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
