import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./components/theme-provider"
import { SidebarProvider } from "./components/ui/sidebar"
import { BrowserRouter } from "react-router-dom"
import { PageStateProvider } from "./contexts/page-state-context"

// Função para ler o estado do sidebar do localStorage
function getSidebarState(): boolean {
  try {
    const saved = localStorage.getItem("sidebar:state")
    return saved ? JSON.parse(saved) : true
  } catch {
    return true
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <PageStateProvider>
          <SidebarProvider defaultOpen={getSidebarState()}>
            <App />
          </SidebarProvider>
        </PageStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
