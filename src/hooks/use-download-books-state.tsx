"use client"

import { useState, useEffect, useRef, useCallback } from "react" // Adicionado useCallback
import { useLocation } from "react-router-dom"
import type { Book, DownloadProgress } from "@/types/book" // Importar os tipos Book e DownloadProgress

// Tipos específicos para Download Books
export interface DownloadBooksState { // Exportado para ser usado em outros arquivos, como download-books.tsx
  searchTerm: string
  searchResults: Book[] // Tipado como array de Book
  selectedLanguage: string
  selectedExtension: string
  sortBy: string
  viewMode: "grid" | "list"
  scrollPosition: number
  displayCount: number
  downloadStatus: Record<string, DownloadProgress | undefined> // Tipado como Record<string, DownloadProgress | undefined>
  bookStates: Record<string, BookState> // Tipado como Record<string, BookState>
}

// Estado individual de cada livro (copiado de download-books.tsx para consistência)
interface BookState {
  isInLibrary: boolean
  isFavorite: boolean
  inReadingList: boolean
  libraryId?: number
}

const initialState: DownloadBooksState = {
  searchTerm: "",
  searchResults: [],
  selectedLanguage: "todos",
  selectedExtension: "todos",
  sortBy: "relevancia",
  viewMode: "grid",
  scrollPosition: 0,
  displayCount: 20,
  downloadStatus: {}, // Inicializado como objeto vazio
  bookStates: {}, // Inicializado como objeto vazio
}

export function useDownloadBooksState() {
  const location = useLocation()
  const isActive = location.pathname === "/download-books"
  const [state, setState] = useState<DownloadBooksState>(initialState)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  // Carregar estado do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("download-books-state")
      if (saved) {
        const parsedState: DownloadBooksState = JSON.parse(saved)
        // Merge com initialState para garantir que novas propriedades tenham valores padrão
        // e para limpar estados temporários como downloadStatus e scrollPosition que não devem persistir entre sessões
        setState({
          ...initialState, // Começa com o estado inicial limpo
          ...parsedState,
          downloadStatus: {}, // Limpa o status de download ao carregar (downloads pendentes não persistem)
          scrollPosition: 0, // Reinicia a posição de scroll ao carregar para evitar saltos inesperados
        })
      }
    } catch (error) {
      console.error("Erro ao carregar estado do localStorage:", error)
      // Opcional: toast.error("Erro ao carregar configurações salvas.");
    }
  }, []) // Executa apenas uma vez ao montar o componente

  // Salvar estado no localStorage
  useEffect(() => {
    try {
      // Cria uma cópia do estado para remover dados voláteis antes de salvar
      const stateToSave = { ...state }
      // Propriedades que NÃO devem ser persistidas entre sessões
      stateToSave.downloadStatus = {} // Downloads não devem persistir no localStorage
      stateToSave.scrollPosition = 0 // Scroll position é restaurada via useEffect específico
      // searchResults também pode ser opcionalmente não persistido se quiser que a busca seja sempre nova
      // stateToSave.searchResults = [];

      localStorage.setItem("download-books-state", JSON.stringify(stateToSave))
    } catch (error) {
      console.error("Erro ao salvar estado no localStorage:", error)
      // Opcional: toast.error("Erro ao salvar configurações.");
    }
  }, [state]) // Depende do estado para salvar a cada mudança

  // Restaurar posição de scroll quando a página se torna ativa
  // Usar a posição salva no 'state' ou 0 se não houver
  useEffect(() => {
    if (isActive && containerRef.current && state.scrollPosition > 0) { // Só restaura se houver posição salva
      // Pequeno delay para garantir que o DOM esteja renderizado
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = state.scrollPosition
        }
      }, 50); // Reduzido para 50ms para uma experiência mais fluida
      return () => clearTimeout(timer);
    }
  }, [isActive, state.scrollPosition]); // Depende da ativação da página e da posição de scroll no estado

  // Salvar posição de scroll em tempo real com debounce
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!isActive) return // Só salva se a página estiver ativa

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        // Usa a forma funcional de setState para garantir o valor mais recente de scrollTop
        setState((prev) => ({ ...prev, scrollPosition: container.scrollTop }))
      }, 150) // Debounce de 150ms
    }

    // Adiciona o event listener
    container.addEventListener("scroll", handleScroll, { passive: true })

    // Função de limpeza para remover o event listener e limpar o timeout
    return () => {
      container.removeEventListener("scroll", handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [isActive]) // Depende de isActive para adicionar/remover listener

  // updateState agora aceita a forma funcional ou objeto para ser flexível,
  // e é memoizado com useCallback
  const updateState = useCallback((updates: Partial<DownloadBooksState> | ((prevState: DownloadBooksState) => Partial<DownloadBooksState>)) => {
    setState((prev) => {
      if (typeof updates === 'function') {
        return { ...prev, ...updates(prev) };
      }
      return { ...prev, ...updates };
    });
  }, []);

  return {
    containerRef,
    pageState: state,
    updatePageState: updateState, // Renomeado para seguir a convenção de download-books.tsx
  }
}