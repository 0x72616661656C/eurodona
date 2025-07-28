"use client"

import type React from "react"
import { createContext, useContext, useReducer, useEffect } from "react"

// Tipos para os estados das páginas
interface MyLibraryState {
  searchTerm: string
  selectedCategory: string
  selectedFormat: string
  sortBy: string
  viewMode: "grid" | "list"
  scrollPosition: number
  displayCount: number
}

interface DownloadBooksState {
  searchTerm: string
  searchResults: any[]
  selectedLanguage: string
  selectedExtension: string
  sortBy: string
  viewMode: "grid" | "list"
  scrollPosition: number
  displayCount: number
  downloadStatus: Record<string, any>
  bookStates: Record<string, any>
}

interface FavoritesState {
  searchTerm: string
  selectedCategory: string
  sortBy: string
  viewMode: "grid" | "list"
  scrollPosition: number
}

interface ReadingListState {
  searchTerm: string
  selectedCategory: string
  sortBy: string
  viewMode: "grid" | "list"
  scrollPosition: number
}

interface SettingsState {
  activeTab: string
  scrollPosition: number
}

interface PageStates {
  myLibrary: MyLibraryState
  downloadBooks: DownloadBooksState
  favorites: FavoritesState
  readingList: ReadingListState
  settings: SettingsState
}

// Estados iniciais
const initialMyLibraryState: MyLibraryState = {
  searchTerm: "",
  selectedCategory: "todos",
  selectedFormat: "todos",
  sortBy: "titulo",
  viewMode: "grid",
  scrollPosition: 0,
  displayCount: 20,
}

const initialDownloadBooksState: DownloadBooksState = {
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

const initialFavoritesState: FavoritesState = {
  searchTerm: "",
  selectedCategory: "todos",
  sortBy: "titulo",
  viewMode: "grid",
  scrollPosition: 0,
}

const initialReadingListState: ReadingListState = {
  searchTerm: "",
  selectedCategory: "todos",
  sortBy: "titulo",
  viewMode: "grid",
  scrollPosition: 0,
}

const initialSettingsState: SettingsState = {
  activeTab: "general",
  scrollPosition: 0,
}

const initialPageStates: PageStates = {
  myLibrary: initialMyLibraryState,
  downloadBooks: initialDownloadBooksState,
  favorites: initialFavoritesState,
  readingList: initialReadingListState,
  settings: initialSettingsState,
}

// Actions
type PageStateAction =
  | { type: "UPDATE_MY_LIBRARY"; payload: Partial<MyLibraryState> }
  | { type: "UPDATE_DOWNLOAD_BOOKS"; payload: Partial<DownloadBooksState> }
  | { type: "UPDATE_FAVORITES"; payload: Partial<FavoritesState> }
  | { type: "UPDATE_READING_LIST"; payload: Partial<ReadingListState> }
  | { type: "UPDATE_SETTINGS"; payload: Partial<SettingsState> }
  | { type: "RESTORE_STATES"; payload: Partial<PageStates> }

// Reducer
function pageStateReducer(state: PageStates, action: PageStateAction): PageStates {
  switch (action.type) {
    case "UPDATE_MY_LIBRARY":
      return {
        ...state,
        myLibrary: { ...state.myLibrary, ...action.payload },
      }
    case "UPDATE_DOWNLOAD_BOOKS":
      return {
        ...state,
        downloadBooks: { ...state.downloadBooks, ...action.payload },
      }
    case "UPDATE_FAVORITES":
      return {
        ...state,
        favorites: { ...state.favorites, ...action.payload },
      }
    case "UPDATE_READING_LIST":
      return {
        ...state,
        readingList: { ...state.readingList, ...action.payload },
      }
    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }
    case "RESTORE_STATES":
      return {
        ...state,
        ...action.payload,
      }
    default:
      return state
  }
}

// Context
interface PageStateContextType {
  states: PageStates
  updateMyLibrary: (updates: Partial<MyLibraryState>) => void
  updateDownloadBooks: (updates: Partial<DownloadBooksState>) => void
  updateFavorites: (updates: Partial<FavoritesState>) => void
  updateReadingList: (updates: Partial<ReadingListState>) => void
  updateSettings: (updates: Partial<SettingsState>) => void
}

const PageStateContext = createContext<PageStateContextType | undefined>(undefined)

// Provider
export function PageStateProvider({ children }: { children: React.ReactNode }) {
  const [states, dispatch] = useReducer(pageStateReducer, initialPageStates)

  // Carregar estados salvos do localStorage
  useEffect(() => {
    try {
      const savedStates = localStorage.getItem("page-states")
      if (savedStates) {
        const parsedStates = JSON.parse(savedStates)
        dispatch({ type: "RESTORE_STATES", payload: parsedStates })
      }
    } catch (error) {
      console.error("Erro ao carregar estados das páginas:", error)
    }
  }, [])

  // Salvar estados no localStorage quando mudarem
  useEffect(() => {
    try {
      localStorage.setItem("page-states", JSON.stringify(states))
    } catch (error) {
      console.error("Erro ao salvar estados das páginas:", error)
    }
  }, [states])

  const updateMyLibrary = (updates: Partial<MyLibraryState>) => {
    dispatch({ type: "UPDATE_MY_LIBRARY", payload: updates })
  }

  const updateDownloadBooks = (updates: Partial<DownloadBooksState>) => {
    dispatch({ type: "UPDATE_DOWNLOAD_BOOKS", payload: updates })
  }

  const updateFavorites = (updates: Partial<FavoritesState>) => {
    dispatch({ type: "UPDATE_FAVORITES", payload: updates })
  }

  const updateReadingList = (updates: Partial<ReadingListState>) => {
    dispatch({ type: "UPDATE_READING_LIST", payload: updates })
  }

  const updateSettings = (updates: Partial<SettingsState>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: updates })
  }

  return (
    <PageStateContext.Provider
      value={{
        states,
        updateMyLibrary,
        updateDownloadBooks,
        updateFavorites,
        updateReadingList,
        updateSettings,
      }}
    >
      {children}
    </PageStateContext.Provider>
  )
}

// Hook para usar o contexto
export function usePageState() {
  const context = useContext(PageStateContext)
  if (context === undefined) {
    throw new Error("usePageState deve ser usado dentro de um PageStateProvider")
  }
  return context
}
