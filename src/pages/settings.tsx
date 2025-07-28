"use client"

import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { confirm, open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  FolderOpen,
  Download,
  AlertTriangle,
  Settings,
  Book,
  Palette,
  Shield,
  Archive,
  Share2,
  RotateCcw,
  Check,
  X,
} from "lucide-react"

interface AppSettings {
  // Download settings
  download_path?: string | null
  max_concurrent_downloads: number
  auto_open_after_download: boolean
  download_notifications: boolean

  // UI settings
  theme: string
  default_view_mode: string
  books_per_page: number
  compact_mode: boolean

  // Reading settings
  auto_bookmark: boolean
  reading_timer: boolean
  show_reading_progress: boolean
  default_font_size: number
  reading_background: string

  // Library settings
  auto_backup: boolean
  backup_frequency: string
  auto_cleanup: boolean
  cache_size_mb: number

  // Privacy settings
  analytics_enabled: boolean
  crash_reports: boolean

  // Advanced settings
  debug_mode: boolean
  experimental_features: boolean
}

interface SettingsUpdateEvent {
  event_type: string
  setting_key?: string
  setting_value?: any
  settings?: AppSettings
}

// Atualizar o defaultSettings para corresponder à estrutura Rust
const defaultSettings: AppSettings = {
  download_path: null,
  max_concurrent_downloads: 3,
  auto_open_after_download: false,
  download_notifications: true,
  theme: "system",
  default_view_mode: "grid",
  books_per_page: 20,
  compact_mode: false,
  auto_bookmark: true,
  reading_timer: false,
  show_reading_progress: true,
  default_font_size: 16,
  reading_background: "white",
  auto_backup: true,
  backup_frequency: "weekly",
  auto_cleanup: true,
  cache_size_mb: 500,
  analytics_enabled: true,
  crash_reports: true,
  debug_mode: false,
  experimental_features: false,
}

const SettingSection = ({ icon: Icon, title, description, children }: any) => (
  <Card className="mb-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
)

const ToggleSetting = ({ label, description, checked, onCheckedChange, disabled = false }: any) => (
  <div className="flex items-center justify-between">
    <div className="space-y-0.5">
      <Label className="text-base font-medium">{label}</Label>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
)

const SliderSetting = ({ label, value, onValueChange, min, max, step, suffix = "", disabled = false }: any) => (
  <div className="space-y-3">
    <div className="flex justify-between">
      <Label className="text-base font-medium">{label}</Label>
      <span className="text-sm text-muted-foreground">
        {value}
        {suffix}
      </span>
    </div>
    <Slider
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(values) => onValueChange(values[0])}
      disabled={disabled}
    />
  </div>
)

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Carregar configurações iniciais
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const currentSettings: AppSettings = await invoke("get_settings")
      setSettings(currentSettings)
      setError(null)
    } catch (err) {
      setError("Falha ao carregar configurações.")
      console.error("Error fetching settings:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Setup do listener de eventos de configurações
  useEffect(() => {
    let unlistenSettings: (() => void) | null = null

    const setupListeners = async () => {
      try {
        // Carregar configurações iniciais
        await fetchSettings()

        // Listener para atualizações de configurações
        unlistenSettings = await listen<SettingsUpdateEvent>("settings-updated", (event) => {
          const { event_type, setting_key, setting_value, settings: updatedSettings } = event.payload

          switch (event_type) {
            case "settings_updated":
              if (updatedSettings) {
                setSettings(updatedSettings)
                setHasUnsavedChanges(false)
                toast.success("Configurações atualizadas!")
              }
              break

            case "setting_changed":
              if (setting_key && setting_value !== undefined) {
                setSettings((prev) => ({
                  ...prev,
                  [setting_key]: setting_value,
                }))
                toast.success(`${setting_key} atualizado!`)
              }
              break

            case "settings_reset":
              if (updatedSettings) {
                setSettings(updatedSettings)
                setHasUnsavedChanges(false)
                toast.success("Configurações resetadas!")
              }
              break

            case "settings_applied":
              toast.success("Configurações aplicadas!")
              break

            case "listener_started":
              console.log("Settings listener started")
              break
          }
        })

        // Inicializar o listener no backend
        await invoke("start_settings_listener")
      } catch (error) {
        console.error("Erro ao configurar listeners de configurações:", error)
      }
    }

    setupListeners()

    return () => {
      if (unlistenSettings) {
        unlistenSettings()
      }
    }
  }, [fetchSettings])

  // Função para atualizar uma configuração individual
  const updateSingleSetting = async (key: string, value: any) => {
    try {
      await invoke("update_single_setting", { key, value })
    } catch (err) {
      toast.error(`Erro ao atualizar ${key}`)
      console.error("Error updating single setting:", err)
    }
  }

  // Função para validar configurações
  const validateSettings = async (settingsToValidate: AppSettings) => {
    try {
      const errors: string[] = await invoke("validate_settings", { settings: settingsToValidate })
      setValidationErrors(errors)
      return errors.length === 0
    } catch (err) {
      console.error("Error validating settings:", err)
      return false
    }
  }

  // Salvar todas as configurações
  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const isValid = await validateSettings(settings)
      if (!isValid) {
        toast.error("Por favor, corrija os erros de validação")
        return
      }

      await invoke("set_settings", { settings })
      setHasUnsavedChanges(false)
    } catch (err) {
      setError("Falha ao salvar configurações.")
      toast.error("Erro ao salvar configurações")
    } finally {
      setSaving(false)
    }
  }

  // Resetar configurações
  const handleResetSettings = async () => {
    const confirmed = await confirm("Todas as configurações serão resetadas para os valores padrão. Continuar?", {
      title: "Resetar Configurações",
      type: "warning",
    })

    if (confirmed) {
      try {
        await invoke("reset_settings")
      } catch (err) {
        toast.error("Erro ao resetar configurações")
      }
    }
  }

  // Selecionar diretório de download
  const handleSelectDownloadPath = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false })
      if (selectedPath && typeof selectedPath === "string") {
        const newSettings = { ...settings, download_path: selectedPath }
        setSettings(newSettings)
        setHasUnsavedChanges(true)
        await updateSingleSetting("download_path", selectedPath)
      }
    } catch (err) {
      toast.error("Erro ao selecionar diretório.")
    }
  }

  // Reset completo dos dados do app
  const handleResetAppData = async () => {
    const confirmed = await confirm(
      "Todos os seus dados serão apagados permanentemente. Esta ação não pode ser desfeita.",
      { title: "Confirmar Reset Total", type: "warning" },
    )

    if (confirmed) {
      try {
        await invoke("reset_app_data")
      } catch (err) {
        setError("Falha ao resetar dados.")
      }
    }
  }

  // Exportar configurações
  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "library-settings.json"
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Configurações exportadas!")
  }

  // Função auxiliar para atualizar configurações localmente
  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setHasUnsavedChanges(true)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Carregando configurações...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchSettings}>Tentar Novamente</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Configurações</h1>
            </div>
            <p className="text-muted-foreground">Gerencie as configurações do aplicativo.</p>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Alterações não salvas
              </div>
            )}
            <Button onClick={handleResetSettings} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar
            </Button>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              Erros de Validação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-sm text-destructive">
                  {error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Downloads */}
      <SettingSection icon={Download} title="Downloads" description="Configure como os livros são baixados">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-base font-medium">Diretório de Download</Label>
            <div className="flex gap-2">
              <Input value={settings.download_path || "Diretório padrão"} readOnly className="flex-1" />
              <Button onClick={handleSelectDownloadPath} variant="outline">
                <FolderOpen className="h-4 w-4 mr-2" />
                Selecionar
              </Button>
            </div>
          </div>

          <SliderSetting
            label="Downloads Simultâneos"
            value={settings.max_concurrent_downloads}
            onValueChange={(value: number) => updateSetting("max_concurrent_downloads", value)}
            min={1}
            max={10}
            step={1}
          />
        </div>

        <div className="space-y-4">
          <ToggleSetting
            label="Abrir Automaticamente"
            description="Abre o arquivo após o download"
            checked={settings.auto_open_after_download}
            onCheckedChange={(checked: boolean) => updateSetting("auto_open_after_download", checked)}
          />

          <ToggleSetting
            label="Notificações de Download"
            description="Avisa quando downloads terminam"
            checked={settings.download_notifications}
            onCheckedChange={(checked: boolean) => updateSetting("download_notifications", checked)}
          />
        </div>
      </SettingSection>

      {/* Aparência */}
      <SettingSection icon={Palette} title="Aparência" description="Personalize a interface">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-base font-medium">Tema</Label>
            <Select value={settings.theme} onValueChange={(value) => updateSetting("theme", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Visualização Padrão</Label>
            <Select
              value={settings.default_view_mode}
              onValueChange={(value) => updateSetting("default_view_mode", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grade</SelectItem>
                <SelectItem value="list">Lista</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SliderSetting
            label="Livros por Página"
            value={settings.books_per_page}
            onValueChange={(value: number) => updateSetting("books_per_page", value)}
            min={10}
            max={100}
            step={10}
          />

          <SliderSetting
            label="Tamanho da Fonte"
            value={settings.default_font_size}
            onValueChange={(value: number) => updateSetting("default_font_size", value)}
            min={8}
            max={72}
            step={1}
            suffix="px"
          />
        </div>

        <ToggleSetting
          label="Modo Compacto"
          description="Interface mais densa"
          checked={settings.compact_mode}
          onCheckedChange={(checked: boolean) => updateSetting("compact_mode", checked)}
        />
      </SettingSection>

      {/* Leitura */}
      <SettingSection icon={Book} title="Leitura" description="Configure sua experiência de leitura">
        <div className="space-y-4">
          <ToggleSetting
            label="Marcador Automático"
            description="Salva automaticamente sua posição"
            checked={settings.auto_bookmark}
            onCheckedChange={(checked: boolean) => updateSetting("auto_bookmark", checked)}
          />

          <ToggleSetting
            label="Timer de Leitura"
            description="Mostra tempo de leitura"
            checked={settings.reading_timer}
            onCheckedChange={(checked: boolean) => updateSetting("reading_timer", checked)}
          />

          <ToggleSetting
            label="Mostrar Progresso"
            description="Exibe barra de progresso"
            checked={settings.show_reading_progress}
            onCheckedChange={(checked: boolean) => updateSetting("show_reading_progress", checked)}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Fundo de Leitura</Label>
          <Select
            value={settings.reading_background}
            onValueChange={(value) => updateSetting("reading_background", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="white">Branco</SelectItem>
              <SelectItem value="cream">Creme</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SettingSection>

      {/* Biblioteca */}
      <SettingSection icon={Archive} title="Biblioteca" description="Organize sua coleção">
        <div className="space-y-4">
          <ToggleSetting
            label="Backup Automático"
            description="Cria backups automáticos"
            checked={settings.auto_backup}
            onCheckedChange={(checked: boolean) => updateSetting("auto_backup", checked)}
          />

          <ToggleSetting
            label="Limpeza Automática"
            description="Remove arquivos temporários"
            checked={settings.auto_cleanup}
            onCheckedChange={(checked: boolean) => updateSetting("auto_cleanup", checked)}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-base font-medium">Frequência de Backup</Label>
            <Select
              value={settings.backup_frequency}
              onValueChange={(value) => updateSetting("backup_frequency", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SliderSetting
            label="Tamanho do Cache"
            value={settings.cache_size_mb}
            onValueChange={(value: number) => updateSetting("cache_size_mb", value)}
            min={100}
            max={2000}
            step={50}
            suffix="MB"
          />
        </div>
      </SettingSection>

      {/* Privacidade */}
      <SettingSection icon={Shield} title="Privacidade" description="Controle seus dados">
        <div className="space-y-4">
          <ToggleSetting
            label="Analytics"
            description="Ajuda a melhorar o app"
            checked={settings.analytics_enabled}
            onCheckedChange={(checked: boolean) => updateSetting("analytics_enabled", checked)}
          />

          <ToggleSetting
            label="Relatórios de Crash"
            description="Envia relatórios de erro"
            checked={settings.crash_reports}
            onCheckedChange={(checked: boolean) => updateSetting("crash_reports", checked)}
          />
        </div>
      </SettingSection>

      {/* Avançado */}
      <SettingSection icon={Settings} title="Avançado" description="Configurações técnicas">
        <div className="space-y-4">
          <ToggleSetting
            label="Modo Debug"
            description="Ativa logs detalhados"
            checked={settings.debug_mode}
            onCheckedChange={(checked: boolean) => updateSetting("debug_mode", checked)}
          />

          <ToggleSetting
            label="Recursos Experimentais"
            description="Habilita funcionalidades em teste"
            checked={settings.experimental_features}
            onCheckedChange={(checked: boolean) => updateSetting("experimental_features", checked)}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Importar/Exportar</h3>
          <div className="flex gap-4">
            <Button onClick={handleExportSettings} variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </SettingSection>

      {/* Zona de Perigo */}
      <SettingSection icon={AlertTriangle} title="Zona de Perigo" description="Ações irreversíveis">
        <div className="border border-destructive/20 rounded-lg p-6 bg-destructive/5">
          <div className="flex items-center gap-4 p-4 bg-background rounded-md border">
            <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Resetar Todos os Dados</p>
              <p className="text-sm text-muted-foreground">Remove permanentemente todos os dados.</p>
            </div>
            <Button variant="destructive" onClick={handleResetAppData}>
              Resetar
            </Button>
          </div>
        </div>
      </SettingSection>

      {/* Botões de Ação */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t pt-4 pb-6 mt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {validationErrors.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                Configurações válidas
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <X className="h-4 w-4" />
                {validationErrors.length} erro(s) encontrado(s)
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSettings} disabled={saving || validationErrors.length > 0} size="lg">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
