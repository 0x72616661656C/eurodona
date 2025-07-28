"use client"

import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle, CredenzaBody } from "@/components/ui/credenza"
import { useMediaQuery } from "@/lib/utils"
import {
  Heart,
  BookOpen,
  Trash2,
  BookText,
  FolderOpen,
  Star,
  Calendar,
  Globe,
  FileText,
  HardDrive,
  Users,
  Building,
} from "lucide-react"
import type { BookWithUserData } from "@/types"

interface BookDetailsModalProps {
  book: BookWithUserData | null
  isOpen: boolean
  onClose: () => void
  onOpenReader: (book: BookWithUserData) => void
  onUpdate: () => void
}

const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm text-muted-foreground truncate">{value}</p>
    </div>
  </div>
)

const ActionButton = ({
  active,
  onClick,
  icon: Icon,
  activeText,
  inactiveText,
  activeClass,
  inactiveClass,
  mobile = false,
}: {
  active: boolean
  onClick: () => void
  icon: any
  activeText: string
  inactiveText: string
  activeClass: string
  inactiveClass: string
  mobile?: boolean
}) => (
  <Button
    variant={active ? "default" : "outline"}
    onClick={onClick}
    className={`w-full ${active ? activeClass : inactiveClass}`}
    size={mobile ? "default" : "lg"}
  >
    <Icon className={`h-4 w-4 mr-2 ${active ? "fill-current" : ""}`} />
    {active ? activeText : inactiveText}
  </Button>
)

export function BookDetailsModal({ book, isOpen, onClose, onOpenReader, onUpdate }: BookDetailsModalProps) {
  const [progress, setProgress] = useState("")
  const [displayBook, setDisplayBook] = useState<BookWithUserData | null>(book)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  useEffect(() => setDisplayBook(book), [book])

  const handleAction = useCallback(
    async (action: string, value?: any) => {
      if (!displayBook) return

      try {
        switch (action) {
          case "progress":
            const prog = Number.parseInt(progress)
            if (isNaN(prog) || prog < 0 || prog > 100) {
              toast("Progresso deve ser entre 0 e 100")
              return
            }
            await invoke("update_reading_progress_command", { bookId: displayBook.id, progress: prog })
            setDisplayBook((prev) => (prev ? { ...prev, reading_progress: prog } : null))
            toast("Progresso atualizado!")
            setProgress("")
            onUpdate()
            break

          case "favorite":
            await invoke("toggle_favorite_command", { bookId: displayBook.id, isFavorite: !displayBook.is_favorite })
            setDisplayBook((prev) => (prev ? { ...prev, is_favorite: !prev.is_favorite } : null))
            toast(displayBook.is_favorite ? "Removido dos favoritos" : "Adicionado aos favoritos!")
            onUpdate()
            break

          case "reading_list":
            await invoke("toggle_reading_list_command", {
              bookId: displayBook.id,
              isReadingList: !displayBook.is_reading_list,
            })
            setDisplayBook((prev) => (prev ? { ...prev, is_reading_list: !prev.is_reading_list } : null))
            toast(displayBook.is_reading_list ? "Removido da lista de leitura" : "Adicionado à lista de leitura!")
            onUpdate()
            break

          case "remove":
            await invoke("delete_book_from_library_command", { bookId: displayBook.id, fileName: value })
            toast("Livro removido da biblioteca!")
            onClose()
            onUpdate()
            break

          case "open_location":
            if (!value) {
              toast("Caminho não disponível")
              return
            }
            await invoke("open_file_location", { path: value })
            break
        }
      } catch (err) {
        console.error("Erro na ação:", err)
      }
    },
    [displayBook, progress, onUpdate, onClose],
  )

  if (!displayBook) return null

  const fileName = `${displayBook.title} - ${displayBook.authors.join(", ")}, ${displayBook.book?.year || "N/A"}.${displayBook.extension}`

  const BookInfo = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {!mobile && (
        <div className="space-y-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 pr-4">
              <h2 className="text-2xl font-bold leading-tight">{displayBook.title}</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{displayBook.authors.join(", ")}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {displayBook.is_favorite && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                  <Heart className="h-3 w-3 mr-1 fill-current" />
                  Favorito
                </Badge>
              )}
              {displayBook.is_reading_list && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Lista
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`grid ${mobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"} gap-4 mb-6`}>
        <div className="space-y-3">
          <InfoItem icon={Building} label="Editora" value={displayBook.book?.publisher || "N/A"} />
          <InfoItem icon={Calendar} label="Ano" value={displayBook.book?.year || "N/A"} />
          <InfoItem icon={Globe} label="Idioma" value={displayBook.book?.language || "N/A"} />
        </div>
        <div className="space-y-3">
          <InfoItem icon={FileText} label="Páginas" value={displayBook.book?.pages || "N/A"} />
          <InfoItem icon={HardDrive} label="Tamanho" value={displayBook.book?.size || "N/A"} />
          <div className="flex items-center gap-3">
            <Star className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Formato</p>
              <Badge variant="outline" className="mt-1">
                {displayBook.extension.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <div className={`grid ${mobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
          <Button
            onClick={() => onOpenReader(displayBook)}
            disabled={!displayBook.local_file_path}
            className="w-full"
            size={mobile ? "default" : "lg"}
          >
            <BookText className="h-4 w-4 mr-2" />
            Ler Livro
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("open_location", displayBook.local_file_path)}
            disabled={!displayBook.local_file_path}
            className="w-full"
            size={mobile ? "default" : "lg"}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Abrir Pasta
          </Button>
        </div>

        <div className={`grid ${mobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
          <ActionButton
            active={displayBook.is_favorite}
            onClick={() => handleAction("favorite")}
            icon={Heart}
            activeText="Remover Favorito"
            inactiveText="Adicionar Favorito"
            activeClass="bg-red-500 hover:bg-red-600 text-white"
            inactiveClass="hover:bg-red-50 hover:border-red-200"
            mobile={mobile}
          />
        </div>

        <div className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" size={mobile ? "default" : "lg"}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remover da Biblioteca
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover <strong>"{displayBook.title}"</strong> da sua biblioteca? Esta ação não
                  pode ser desfeita e o arquivo será removido do disco.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleAction("remove", fileName)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  )

  return (
    <Credenza open={isOpen} onOpenChange={onClose}>
      <CredenzaContent
        className={
          isDesktop ? "max-w-6xl w-[95vw] max-h-[95vh] min-w-[800px] min-h-[600px] overflow-hidden p-0" : "max-h-[95vh]"
        }
      >
        {isDesktop ? (
          <div className="flex h-full">
            <div className="w-80 bg-card p-8 flex flex-col items-center justify-center flex-shrink-0">
              <div className="relative group">
                <img
                  src={displayBook.cover_url || "/placeholder.svg"}
                  alt={displayBook.title}
                  className="w-56 h-80 object-cover rounded-lg shadow-2xl transition-transform group-hover:scale-105"
                />
                <div className="absolute -bottom-4 -right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                  {displayBook.reading_progress}%
                </div>
              </div>
              <div className="w-full mt-8 space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Progresso de leitura</span>
                  <span>{displayBook.reading_progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${displayBook.reading_progress}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0-100"
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                    className="flex-1"
                    min="0"
                    max="100"
                  />
                  <Button size="sm" onClick={() => handleAction("progress")} className="px-4">
                    Atualizar
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
              <BookInfo />
            </div>
          </div>
        ) : (
          <div className="max-h-[85dvh] overflow-y-auto">
            <CredenzaHeader className="text-center pb-4">
              <CredenzaTitle className="text-xl font-bold">{displayBook.title}</CredenzaTitle>
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Users className="h-4 w-4" />
                <span>{displayBook.authors.join(", ")}</span>
              </div>
            </CredenzaHeader>
            <CredenzaBody className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <img
                    src={displayBook.cover_url || "/placeholder.svg"}
                    alt={displayBook.title}
                    className="w-32 h-48 object-cover rounded-lg shadow-lg"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold">
                    {displayBook.reading_progress}%
                  </div>
                </div>
                <div className="flex gap-2">
                  {displayBook.is_favorite && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                      <Heart className="h-3 w-3 mr-1 fill-current" />
                      Favorito
                    </Badge>
                  )}
                  {displayBook.is_reading_list && (
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Lista
                    </Badge>
                  )}
                </div>
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Progresso</span>
                    <span>{displayBook.reading_progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${displayBook.reading_progress}%` }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0-100"
                      value={progress}
                      onChange={(e) => setProgress(e.target.value)}
                      className="flex-1"
                      min="0"
                      max="100"
                    />
                    <Button size="sm" onClick={() => handleAction("progress")}>
                      OK
                    </Button>
                  </div>
                </div>
              </div>
              <Separator />
              <BookInfo mobile />
            </CredenzaBody>
          </div>
        )}
      </CredenzaContent>
    </Credenza>
  )
}
