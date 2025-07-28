"use client"

import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { BookOpen, Download, Heart, LibraryBig, Settings, Book } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { useLibrary } from "@/hooks"
import { BookDetailsModal } from "@/components/book-details-modal"
import type { BookWithUserData } from "@/types"

interface AppSidebarProps {
  activePage: string
}

export function AppSidebar({ activePage }: AppSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const { books: libraryBooks, loading: loadingBooks } = useLibrary()

  // Estados para o modal
  const [selectedBook, setSelectedBook] = useState<BookWithUserData | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const menuItems = [
    { title: "Minha Biblioteca", icon: LibraryBig, page: "library" },
    { title: "Baixar Livros", icon: Download, page: "download-books" },
    { title: "Favoritos", icon: Heart, page: "favorites" },
    { title: "Lista de Leitura", icon: BookOpen, page: "reading-list" },
    { title: "Configurações", icon: Settings, page: "settings" },
  ]

  const handleNavigation = (page: string) => {
    navigate(`/${page}`)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleBookClick = (book: BookWithUserData) => {
    setSelectedBook(book)
    setShowDetails(true)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const openReader = (book: BookWithUserData) => {
    if (!book.local_file_path) {
      toast.error("Livro não disponível para leitura")
      return
    }

    // Fechar o modal e navegar para o leitor
    setShowDetails(false)
    navigate(`/reader/${book.id}`)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleUpdateLibrary = () => {
    // A biblioteca já é atualizada automaticamente via useLibrary hook
    // Não precisa fazer nada aqui pois o hook já escuta os eventos do Tauri
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.page}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={location.pathname === `/${item.page}`}
                      onClick={() => handleNavigation(item.page)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Meus Livros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {loadingBooks ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : libraryBooks.length === 0 ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <Book className="opacity-50" />
                      <span className="text-muted-foreground">Nenhum livro</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  libraryBooks.slice(0, 10).map((book) => (
                    <SidebarMenuItem key={book.id}>
                      <SidebarMenuButton
                        tooltip={`${book.title} - ${book.reading_progress}% lido`}
                        onClick={() => handleBookClick(book)}
                        className="group relative"
                      >
                        <div className="w-4 h-4 rounded-sm overflow-hidden flex-shrink-0 bg-muted">
                          <img
                            src={book.cover_url || "/placeholder.svg"}
                            alt={book.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                              target.nextElementSibling?.classList.remove("hidden")
                            }}
                          />
                          <Book className="w-4 h-4 text-muted-foreground hidden" />
                        </div>

                        <span className="truncate flex-1 text-left">{book.title}</span>

                        {book.reading_progress > 0 && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}

                {libraryBooks.length > 10 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("library")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <LibraryBig className="w-4 h-4" />
                      <span>Ver todos ({libraryBooks.length})</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Modal de detalhes do livro */}
      <BookDetailsModal
        book={selectedBook}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onOpenReader={openReader}
        onUpdate={handleUpdateLibrary}
      />
    </>
  )
}
