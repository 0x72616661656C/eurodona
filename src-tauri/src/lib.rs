use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;
use tokio::sync::Semaphore;

mod commands;
mod database;
mod libgen;
mod book_reader;

// Função para carregar configurações do store
fn load_settings_from_store(store: &tauri_plugin_store::Store<tauri::Wry>) -> commands::AppSettings {
    let mut settings = commands::AppSettings::default();

    if let Some(value) = store.get("download_path") {
        settings.download_path = value.as_str().map(String::from);
    }
    if let Some(value) = store.get("max_concurrent_downloads") {
        settings.max_concurrent_downloads = value.as_u64().unwrap_or(3);
    }
    if let Some(value) = store.get("auto_open_after_download") {
        settings.auto_open_after_download = value.as_bool().unwrap_or(false);
    }
    if let Some(value) = store.get("download_notifications") {
        settings.download_notifications = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("theme") {
        settings.theme = value.as_str().unwrap_or("system").to_string();
    }
    if let Some(value) = store.get("default_view_mode") {
        settings.default_view_mode = value.as_str().unwrap_or("grid").to_string();
    }
    if let Some(value) = store.get("books_per_page") {
        settings.books_per_page = value.as_u64().unwrap_or(20);
    }
    if let Some(value) = store.get("compact_mode") {
        settings.compact_mode = value.as_bool().unwrap_or(false);
    }
    if let Some(value) = store.get("auto_bookmark") {
        settings.auto_bookmark = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("reading_timer") {
        settings.reading_timer = value.as_bool().unwrap_or(false);
    }
    if let Some(value) = store.get("show_reading_progress") {
        settings.show_reading_progress = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("default_font_size") {
        settings.default_font_size = value.as_u64().unwrap_or(16);
    }
    if let Some(value) = store.get("reading_background") {
        settings.reading_background = value.as_str().unwrap_or("white").to_string();
    }
    if let Some(value) = store.get("auto_backup") {
        settings.auto_backup = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("backup_frequency") {
        settings.backup_frequency = value.as_str().unwrap_or("weekly").to_string();
    }
    if let Some(value) = store.get("auto_cleanup") {
        settings.auto_cleanup = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("cache_size_mb") {
        settings.cache_size_mb = value.as_u64().unwrap_or(500);
    }
    if let Some(value) = store.get("analytics_enabled") {
        settings.analytics_enabled = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("crash_reports") {
        settings.crash_reports = value.as_bool().unwrap_or(true);
    }
    if let Some(value) = store.get("debug_mode") {
        settings.debug_mode = value.as_bool().unwrap_or(false);
    }
    if let Some(value) = store.get("experimental_features") {
        settings.experimental_features = value.as_bool().unwrap_or(false);
    }

    settings
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data directory: {}", e))?;

            fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to create app data directory: {}", e))?;

            let db_path = app_data_dir.join("library.db");

            let db_manager = database::DatabaseManager::new(db_path)
                .map_err(|e| format!("Failed to initialize database: {}", e))?;

            let store = app_handle
                .store_builder("settings.dat")
                .build()
                .map_err(|e| format!("Failed to create store: {}", e))?;

            if let Err(e) = store.reload() {
                eprintln!("Failed to load store: {}", e);
            }

            // Carregar configurações do store
            let current_settings = load_settings_from_store(&store);

            let initial_max_downloads = current_settings.max_concurrent_downloads as usize;

            let app_state = commands::AppState {
                active_downloads: Arc::new(Mutex::new(HashMap::new())),
                db_manager: Arc::new(Mutex::new(db_manager)),
                download_semaphore: Arc::new(Semaphore::new(initial_max_downloads)),
                settings_store: store,
                current_settings: Arc::new(Mutex::new(current_settings)),
            };

            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::search_books,
            commands::download_book,
            commands::cancel_download,
            commands::add_book_to_library_command,
            commands::get_library_books_command,
            commands::update_reading_progress_command,
            commands::toggle_favorite_command,
            commands::toggle_reading_list_command,
            commands::get_reading_list_books_command,
            commands::get_favorite_books_command,
            commands::open_file_location,
            commands::delete_book_from_library_command,
            commands::get_settings,
            commands::set_settings,
            commands::update_single_setting,
            commands::reset_settings,
            commands::get_setting,
            commands::validate_settings,
            commands::reset_app_data,
            commands::read_book_content,
            commands::get_page_content_command,
            commands::search_in_book_command,
            commands::start_library_listener,
            commands::start_settings_listener,
            commands::refresh_library,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
