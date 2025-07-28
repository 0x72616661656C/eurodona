// src/libgen/mod.rs

// Declara os módulos filhos
pub mod api;
pub mod models;

// Reexporta os tipos e funções públicos para fácil acesso
pub use api::{find_final_download_link, search_books};
pub use models::{Book, BookWithUserData, SearchResponse};
