use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use tokio::sync::Semaphore;

use crate::database::DatabaseManager;
use crate::libgen::{Book, BookWithUserData, SearchResponse};
use crate::book_reader::{BookReader, BookContent, BookPage};
use tauri_plugin_store::Store;

#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    book_id: String,
    file_name: String,
    status: String,
    downloaded: u64,
    total: u64,
    percentage: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    // Download settings
    pub download_path: Option<String>,
    pub max_concurrent_downloads: u64,
    pub auto_open_after_download: bool,
    pub download_notifications: bool,
    
    // UI settings
    pub theme: String, // "light", "dark", "system"
    pub default_view_mode: String, // "grid", "list"
    pub books_per_page: u64,
    pub compact_mode: bool,
    
    // Reading settings
    pub auto_bookmark: bool,
    pub reading_timer: bool,
    pub show_reading_progress: bool,
    pub default_font_size: u64,
    pub reading_background: String,
    
    // Library settings
    pub auto_backup: bool,
    pub backup_frequency: String, // "daily", "weekly", "monthly"
    pub auto_cleanup: bool,
    pub cache_size_mb: u64,
    
    // Privacy settings
    pub analytics_enabled: bool,
    pub crash_reports: bool,
    
    // Advanced settings
    pub debug_mode: bool,
    pub experimental_features: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_path: None,
            max_concurrent_downloads: 3,
            auto_open_after_download: false,
            download_notifications: true,
            theme: "system".to_string(),
            default_view_mode: "grid".to_string(),
            books_per_page: 20,
            compact_mode: false,
            auto_bookmark: true,
            reading_timer: false,
            show_reading_progress: true,
            default_font_size: 16,
            reading_background: "white".to_string(),
            auto_backup: true,
            backup_frequency: "weekly".to_string(),
            auto_cleanup: true,
            cache_size_mb: 500,
            analytics_enabled: true,
            crash_reports: true,
            debug_mode: false,
            experimental_features: false,
        }
    }
}

// Eventos para atualizações da biblioteca
#[derive(Clone, Serialize)]
pub struct LibraryUpdateEvent {
    pub event_type: String,
    pub book_id: Option<i64>,
    pub book: Option<BookWithUserData>,
}

// Eventos para atualizações de configurações
#[derive(Clone, Serialize)]
pub struct SettingsUpdateEvent {
    pub event_type: String, // "settings_updated", "setting_changed"
    pub setting_key: Option<String>,
    pub setting_value: Option<serde_json::Value>,
    pub settings: Option<AppSettings>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub page_number: usize,
    pub context: String,
}

pub struct AppState {
    pub active_downloads: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
    pub db_manager: Arc<Mutex<DatabaseManager>>,
    pub download_semaphore: Arc<Semaphore>,
    pub settings_store: Arc<Store<tauri::Wry>>,
    pub current_settings: Arc<Mutex<AppSettings>>,
}

// Função auxiliar para emitir eventos de atualização da biblioteca
async fn emit_library_update(app: &AppHandle, event_type: &str, book_id: Option<i64>, book: Option<BookWithUserData>) {
    let _ = app.emit("library-updated", LibraryUpdateEvent {
        event_type: event_type.to_string(),
        book_id,
        book,
    });
}

// Função auxiliar para emitir eventos de atualização de configurações
async fn emit_settings_update(app: &AppHandle, event_type: &str, setting_key: Option<String>, setting_value: Option<serde_json::Value>, settings: Option<AppSettings>) {
    let _ = app.emit("settings-updated", SettingsUpdateEvent {
        event_type: event_type.to_string(),
        setting_key,
        setting_value,
        settings,
    });
}

// Função para aplicar configurações imediatamente
async fn apply_settings_immediately(app: &AppHandle, settings: &AppSettings, _state: &State<'_, AppState>) {
    // Aplicar outras configurações conforme necessário
    if settings.debug_mode {
        println!("Debug mode enabled");
    }
    
    // Emitir evento para o frontend
    emit_settings_update(app, "settings_applied", None, None, Some(settings.clone())).await;
}

#[tauri::command]
pub async fn search_books(term: String) -> Result<SearchResponse, String> {
    crate::libgen::search_books(term).await
}

#[tauri::command]
pub async fn download_book(
    book: Book,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let book_id = book.edition_link.clone();
    let authors_str = book.authors.join(", ");
    let file_name_base = format!("{} - {}, {}", book.title, authors_str, book.year);
    let sanitized_file_name = file_name_base
        .chars()
        .filter(|c| !"\\/<>:\"|?*".contains(*c))
        .collect::<String>();
    let file_name = format!("{}.{}", sanitized_file_name, book.extension);

    let mut active_downloads = state.active_downloads.lock().await;

    if active_downloads.contains_key(&book_id) {
        return Err("Download já está em progresso.".to_string());
    }

    let app_handle_clone = app.clone();
    let active_downloads_clone = Arc::clone(&state.active_downloads);
    let db_manager_clone = Arc::clone(&state.db_manager);
    let mirrors = book.mirrors.clone();
    let book_id_clone = book_id.clone();
    let file_name_clone = file_name.clone();
    let book_clone_for_db = book.clone();
    let download_semaphore_clone = Arc::clone(&state.download_semaphore);

    // Obter configurações atuais
    let current_settings = state.current_settings.lock().await.clone();
    let custom_download_path = current_settings.download_path.clone();
    let download_notifications = current_settings.download_notifications;
    let auto_open_after_download = current_settings.auto_open_after_download;

    let task = tokio::spawn(async move {
        let _permit = download_semaphore_clone
            .acquire_owned()
            .await
            .expect("Failed to acquire semaphore permit");

        let emit = |status: &str, downloaded: u64, total: u64, percentage: f64| {
            let _ = app_handle_clone.emit(
                "download-status",
                DownloadProgress {
                    book_id: book_id_clone.clone(),
                    file_name: file_name_clone.clone(),
                    status: status.to_string(),
                    downloaded,
                    total,
                    percentage,
                },
            );
        };

        emit("starting", 0, 0, 0.0);

        let final_link = match crate::libgen::find_final_download_link(&mirrors).await {
            Ok(Some(link)) => link,
            _ => {
                emit("error", 0, 0, 0.0);
                let mut downloads = active_downloads_clone.lock().await;
                downloads.remove(&book_id_clone);
                return;
            }
        };

        let res = match reqwest::get(&final_link).await {
            Ok(r) => r,
            _ => {
                emit("error", 0, 0, 0.0);
                let mut downloads = active_downloads_clone.lock().await;
                downloads.remove(&book_id_clone);
                return;
            }
        };

        let total_size = res.content_length().unwrap_or(0);

        let download_dir = if let Some(path_str) = custom_download_path {
            std::path::PathBuf::from(path_str)
        } else {
            app_handle_clone.path().download_dir().unwrap_or_default()
        };

        let dest_path = download_dir.join(&file_name_clone);

        if let Err(e) = tokio::fs::create_dir_all(&download_dir).await {
            emit("error", 0, 0, 0.0);
            eprintln!("Failed to create download directory: {}", e);
            let mut downloads = active_downloads_clone.lock().await;
            downloads.remove(&book_id_clone);
            return;
        }

        if let Ok(mut file) = File::create(&dest_path).await {
            let mut stream = res.bytes_stream();
            let mut downloaded: u64 = 0;

            while let Some(item) = stream.next().await {
                match item {
                    Ok(chunk) => {
                        if file.write_all(&chunk).await.is_ok() {
                            downloaded += chunk.len() as u64;
                            let percentage = if total_size > 0 {
                                (downloaded as f64 / total_size as f64) * 100.0
                            } else {
                                0.0
                            };
                            emit("downloading", downloaded, total_size, percentage);
                        } else {
                            emit("error", downloaded, total_size, 0.0);
                            break;
                        }
                    }
                    Err(_) => {
                        emit("error", downloaded, total_size, 0.0);
                        break;
                    }
                }
            }

            if downloaded >= total_size && total_size > 0 {
                emit("completed", downloaded, total_size, 100.0);
                
                // Notificação de download concluído se habilitada
                if download_notifications {
                    let _ = app_handle_clone.emit("download-completed", format!("Download concluído: {}", file_name_clone));
                }
                
                // Abrir arquivo automaticamente se habilitado
                if auto_open_after_download {
                    let dest_path_str = dest_path.to_string_lossy().to_string();
                    let _ = app_handle_clone.opener().open_path(dest_path_str, None::<String>);
                }
                
                let added_book_result = {
                    let db_manager = db_manager_clone.lock().await;
                    let book_id_result = db_manager.add_book_to_library(
                        &book_clone_for_db,
                        Some(dest_path.to_string_lossy().into_owned()),
                    );
                    
                    match book_id_result {
                        Ok(book_id) => {
                            db_manager.get_library_books()
                                .map(|books| books.into_iter().find(|b| b.id == book_id))
                                .unwrap_or(None)
                        }
                        Err(e) => {
                            eprintln!("Failed to add book to library: {}", e);
                            None
                        }
                    }
                };
                
                if let Some(added_book) = added_book_result {
                    emit_library_update(&app_handle_clone, "book_added", Some(added_book.id), Some(added_book)).await;
                }
            } else {
                emit("error", 0, 0, 0.0);
            }
        } else {
            emit("error", 0, 0, 0.0);
        }

        let mut downloads = active_downloads_clone.lock().await;
        downloads.remove(&book_id_clone);
    });

    active_downloads.insert(book_id, task);
    Ok(())
}

#[tauri::command]
pub fn read_book_content(file_path: String) -> Result<BookContent, String> {
    BookReader::read_book(&file_path)
}

#[tauri::command]
pub fn get_page_content_command(file_path: String, page_number: usize) -> Result<BookPage, String> {
    BookReader::get_page_content(&file_path, page_number)
}

#[tauri::command]
pub fn search_in_book_command(file_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let results_from_reader = BookReader::search_in_book(&file_path, &query)?;

    let frontend_results = results_from_reader.into_iter().map(|result| {
        SearchResult {
            page_number: result.page_number,
            context: result.context,
        }
    }).collect();

    Ok(frontend_results)
}

#[tauri::command]
pub async fn cancel_download(book_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut active_downloads = state.active_downloads.lock().await;
    if let Some(task_handle) = active_downloads.remove(&book_id) {
        task_handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn add_book_to_library_command(
    book: Book,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let (book_id, added_book) = {
        let db_manager = state.db_manager.lock().await;
        let book_id = db_manager
            .add_book_to_library(&book, None)
            .map_err(|e| e.to_string())?;
        
        let added_book = db_manager.get_library_books()
            .map(|books| books.into_iter().find(|b| b.id == book_id))
            .unwrap_or(None);
            
        (book_id, added_book)
    };
    
    if let Some(added_book) = added_book {
        emit_library_update(&app, "book_added", Some(book_id), Some(added_book)).await;
    }
    
    Ok(book_id)
}

#[tauri::command]
pub async fn get_library_books_command(
    state: State<'_, AppState>,
) -> Result<Vec<BookWithUserData>, String> {
    let db_manager = state.db_manager.lock().await;
    db_manager.get_library_books().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_reading_progress_command(
    book_id: i64,
    progress: i32,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let updated_book = {
        let db_manager = state.db_manager.lock().await;
        db_manager
            .update_reading_progress(book_id, progress)
            .map_err(|e| e.to_string())?;
        
        db_manager.get_library_books()
            .map(|books| books.into_iter().find(|b| b.id == book_id))
            .unwrap_or(None)
    };
    
    if let Some(updated_book) = updated_book {
        emit_library_update(&app, "progress_updated", Some(book_id), Some(updated_book)).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn toggle_favorite_command(
    book_id: i64,
    is_favorite: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let updated_book = {
        let db_manager = state.db_manager.lock().await;
        db_manager
            .toggle_favorite(book_id, is_favorite)
            .map_err(|e| e.to_string())?;
        
        db_manager.get_library_books()
            .map(|books| books.into_iter().find(|b| b.id == book_id))
            .unwrap_or(None)
    };
    
    if let Some(updated_book) = updated_book {
        emit_library_update(&app, "favorite_toggled", Some(book_id), Some(updated_book)).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn toggle_reading_list_command(
    book_id: i64,
    is_reading_list: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let updated_book = {
        let db_manager = state.db_manager.lock().await;
        db_manager
            .toggle_reading_list(book_id, is_reading_list)
            .map_err(|e| e.to_string())?;
        
        db_manager.get_library_books()
            .map(|books| books.into_iter().find(|b| b.id == book_id))
            .unwrap_or(None)
    };
    
    if let Some(updated_book) = updated_book {
        emit_library_update(&app, "reading_list_toggled", Some(book_id), Some(updated_book)).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_reading_list_books_command(
    state: State<'_, AppState>,
) -> Result<Vec<BookWithUserData>, String> {
    let db_manager = state.db_manager.lock().await;
    db_manager
        .get_reading_list_books()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_favorite_books_command(
    state: State<'_, AppState>,
) -> Result<Vec<BookWithUserData>, String> {
    let db_manager = state.db_manager.lock().await;
    db_manager.get_favorite_books().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file_location(app: AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_book_from_library_command(
    book_id: i64,
    file_name: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_manager = state.db_manager.lock().await;

    db_manager
        .delete_book(book_id)
        .map_err(|e| format!("Failed to delete book from database: {}", e))?;

    drop(db_manager);

    emit_library_update(&app, "book_removed", Some(book_id), None).await;

    let current_settings = state.current_settings.lock().await;
    let custom_download_path = current_settings.download_path.clone();
    drop(current_settings);

    let download_dir = if let Some(path_str) = custom_download_path {
        std::path::PathBuf::from(path_str)
    } else {
        app.path().download_dir().unwrap_or_default()
    };

    let file_path = download_dir.join(&file_name);

    if file_path.exists() {
        tokio::fs::remove_file(&file_path)
            .await
            .map_err(|e| format!("Failed to delete file from disk: {}", e))?;
    } else {
        println!("File not found at path: {:?}", file_path);
    }

    Ok(())
}

// Comandos de configurações expandidos
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let current_settings = state.current_settings.lock().await;
    Ok(current_settings.clone())
}

#[tauri::command]
pub async fn set_settings(
    settings: AppSettings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let store = &state.settings_store;

    // Salvar todas as configurações no store
    store.set("download_path".to_string(), settings.download_path.clone());
    store.set("max_concurrent_downloads".to_string(), settings.max_concurrent_downloads);
    store.set("auto_open_after_download".to_string(), settings.auto_open_after_download);
    store.set("download_notifications".to_string(), settings.download_notifications);
    store.set("theme".to_string(), settings.theme.clone());
    store.set("default_view_mode".to_string(), settings.default_view_mode.clone());
    store.set("books_per_page".to_string(), settings.books_per_page);
    store.set("compact_mode".to_string(), settings.compact_mode);
    store.set("auto_bookmark".to_string(), settings.auto_bookmark);
    store.set("reading_timer".to_string(), settings.reading_timer);
    store.set("show_reading_progress".to_string(), settings.show_reading_progress);
    store.set("default_font_size".to_string(), settings.default_font_size);
    store.set("reading_background".to_string(), settings.reading_background.clone());
    store.set("auto_backup".to_string(), settings.auto_backup);
    store.set("backup_frequency".to_string(), settings.backup_frequency.clone());
    store.set("auto_cleanup".to_string(), settings.auto_cleanup);
    store.set("cache_size_mb".to_string(), settings.cache_size_mb);
    store.set("analytics_enabled".to_string(), settings.analytics_enabled);
    store.set("crash_reports".to_string(), settings.crash_reports);
    store.set("debug_mode".to_string(), settings.debug_mode);
    store.set("experimental_features".to_string(), settings.experimental_features);

    if let Err(e) = store.save() {
        return Err(format!("Failed to save settings: {}", e));
    }

    // Atualizar configurações atuais
    {
        let mut current_settings = state.current_settings.lock().await;
        *current_settings = settings.clone();
    }

    // Aplicar configurações imediatamente
    apply_settings_immediately(&app, &settings, &state).await;

    // Emitir evento de atualização
    emit_settings_update(&app, "settings_updated", None, None, Some(settings)).await;

    Ok(())
}

#[tauri::command]
pub async fn update_single_setting(
    key: String,
    value: serde_json::Value,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let store = &state.settings_store;
    
    // Salvar configuração individual
    store.set(key.clone(), value.clone());
    
    if let Err(e) = store.save() {
        return Err(format!("Failed to save setting: {}", e));
    }

    // Atualizar configurações atuais
    {
        let mut current_settings = state.current_settings.lock().await;
        
        // Atualizar o campo específico baseado na chave
        match key.as_str() {
            "download_path" => current_settings.download_path = value.as_str().map(String::from),
            "max_concurrent_downloads" => {
                if let Some(val) = value.as_u64() {
                    current_settings.max_concurrent_downloads = val;
                }
            },
            "theme" => {
                if let Some(val) = value.as_str() {
                    current_settings.theme = val.to_string();
                }
            },
            "default_view_mode" => {
                if let Some(val) = value.as_str() {
                    current_settings.default_view_mode = val.to_string();
                }
            },
            "compact_mode" => {
                if let Some(val) = value.as_bool() {
                    current_settings.compact_mode = val;
                }
            },
            "debug_mode" => {
                if let Some(val) = value.as_bool() {
                    current_settings.debug_mode = val;
                }
            },
            _ => {} // Ignorar chaves desconhecidas
        }
    }

    // Emitir evento de mudança de configuração individual
    emit_settings_update(&app, "setting_changed", Some(key), Some(value), None).await;

    Ok(())
}

#[tauri::command]
pub async fn reset_settings(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let default_settings = AppSettings::default();
    
    // Resetar no store
    let store = &state.settings_store;
    store.clear();
    
    if let Err(e) = store.save() {
        return Err(format!("Failed to reset settings: {}", e));
    }

    // Atualizar configurações atuais
    {
        let mut current_settings = state.current_settings.lock().await;
        *current_settings = default_settings.clone();
    }

    // Aplicar configurações padrão
    apply_settings_immediately(&app, &default_settings, &state).await;

    // Emitir evento de reset
    emit_settings_update(&app, "settings_reset", None, None, Some(default_settings)).await;

    Ok(())
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let store = &state.settings_store;
    
    match store.get(&key) {
        Some(value) => Ok(value.clone()),
        None => Err(format!("Setting '{}' not found", key)),
    }
}

#[tauri::command]
pub async fn reset_app_data(app: AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|_| {
        "Não foi possível encontrar o diretório de dados do aplicativo.".to_string()
    })?;

    let db_path = app_data_dir.join("library.db");
    let settings_path = app_data_dir.join("settings.dat");

    if db_path.exists() {
        tokio::fs::remove_file(&db_path)
            .await
            .map_err(|e| format!("Falha ao apagar o banco de dados: {}", e))?;
    }

    if settings_path.exists() {
        tokio::fs::remove_file(&settings_path)
            .await
            .map_err(|e| format!("Falha ao apagar as configurações: {}", e))?;
    }

    app.restart();
}

#[tauri::command]
pub async fn start_library_listener(app: AppHandle) -> Result<(), String> {
    emit_library_update(&app, "listener_started", None, None).await;
    Ok(())
}

#[tauri::command]
pub async fn start_settings_listener(app: AppHandle) -> Result<(), String> {
    emit_settings_update(&app, "listener_started", None, None, None).await;
    Ok(())
}

#[tauri::command]
pub async fn refresh_library(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    {
        let db_manager = state.db_manager.lock().await;
        let _books = db_manager.get_library_books().map_err(|e| e.to_string())?;
    }
    
    emit_library_update(&app, "library_refreshed", None, None).await;
    Ok(())
}

// Comando para validar configurações
#[tauri::command]
pub async fn validate_settings(settings: AppSettings) -> Result<Vec<String>, String> {
    let mut errors = Vec::new();

    // Validar max_concurrent_downloads
    if settings.max_concurrent_downloads == 0 || settings.max_concurrent_downloads > 10 {
        errors.push("Downloads simultâneos deve estar entre 1 e 10".to_string());
    }

    // Validar books_per_page
    if settings.books_per_page == 0 || settings.books_per_page > 100 {
        errors.push("Livros por página deve estar entre 1 e 100".to_string());
    }

    // Validar default_font_size
    if settings.default_font_size < 8 || settings.default_font_size > 72 {
        errors.push("Tamanho da fonte deve estar entre 8 e 72".to_string());
    }

    // Validar cache_size_mb
    if settings.cache_size_mb > 5000 {
        errors.push("Tamanho do cache não pode exceder 5GB".to_string());
    }

    // Validar download_path se fornecido
    if let Some(path) = &settings.download_path {
        if !std::path::Path::new(path).exists() {
            errors.push("Caminho de download não existe".to_string());
        }
    }

    Ok(errors)
}
