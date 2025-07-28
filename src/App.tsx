"use client"

import type React from "react"
import { useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from "./components/app-sidebar"
import { SidebarInset, SidebarTrigger, SidebarRail, useSidebar } from "./components/ui/sidebar"
import { useEffect } from "react"
import { WindowControls } from "./components/window-controls"
import MyLibraryPage from "./pages/my-library"
import DownloadBooksPage from "./pages/download-books"
import FavoritesPage from "./pages/favorites"
import ReadingListPage from "./pages/reading-list"
import SettingsPage from "./pages/settings"
import { Cat } from "lucide-react"

export default function App() {
  const location = useLocation()
  const activePage = location.pathname.slice(1) || "library"
  const { setOpen } = useSidebar()

  useEffect(() => {
    const handleSidebarChange = () => {
      const sidebarState = document.cookie
        .split("; ")
        .find((row) => row.startsWith("sidebar:state="))
        ?.split("=")[1]

      if (sidebarState) {
        localStorage.setItem("sidebar:state", sidebarState)
      }
    }

    const observer = new MutationObserver(handleSidebarChange)
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    return () => observer.disconnect()
  }, [])

  const getCurrentPageName = () => {
    switch (activePage) {
      case "library":
        return "Minha Biblioteca"
      case "download-books":
        return "Baixar Livros"
      case "favorites":
      case "reading-list":
        return "Lista de Leitura"
      case "settings":
        return "Configurações"
      default:
        return "Minha Biblioteca"
    }
  }

  return (
    <div
      className="flex flex-col w-full min-h-screen pt-8"
      style={{ "--header-height": "3rem" } as React.CSSProperties}
    >
      <header className="h-8 w-full border-b fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-lg z-[100]">
        {/* Faixa para redimensionar no topo */}
        <div
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, cursor: "ns-resize", zIndex: 10001 }}
        />

        {/* Região drag para o restante do header */}
        <div data-tauri-drag-region className="flex items-center h-full relative">
          <Cat className="ml-3 opacity-60 pointer-events-none" />

          {/* Título centralizado (não clicável, não bloqueia drag) */}
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none select-none">
            <span className="font-mono text-sm tracking-wide opacity-40">logenia</span>
          </div>

          {/* Espaço flexível */}
          <div className="flex-1 pointer-events-none" />

          {/* Controles da janela - CLICÁVEL */}
          <div className="relative z-[10002] pointer-events-auto">
            <WindowControls />
          </div>
        </div>
      </header>

      <div className="flex flex-1 mt-0">
        <AppSidebar activePage={activePage} />
        <SidebarInset>
          <SidebarTrigger className="ml-2 mt-2" variant="outline" />
          <div className="flex flex-1 flex-col gap-4 p-4 relative">
            <div className={`${activePage === "library" ? "block" : "hidden"}`}>
              <MyLibraryPage />
            </div>
            <div className={`${activePage === "download-books" ? "block" : "hidden"}`}>
              <DownloadBooksPage />
            </div>
            <div className={`${activePage === "favorites" ? "block" : "hidden"}`}>
              <FavoritesPage />
            </div>
            <div className={`${activePage === "reading-list" ? "block" : "hidden"}`}>
              <ReadingListPage />
            </div>
            <div className={`${activePage === "settings" ? "block" : "hidden"}`}>
              <SettingsPage />
            </div>
          </div>
        </SidebarInset>
        <SidebarRail />
      </div>
      <Toaster />
    </div>
  )
}
