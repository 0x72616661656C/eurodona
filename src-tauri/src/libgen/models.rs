// src/libgen/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Book {
    pub title: String,
    pub edition_link: String,
    pub authors: Vec<String>,
    pub publisher: String,
    pub year: String,
    pub language: String,
    pub pages: String,
    pub size: String,
    pub extension: String,
    pub cover_url: String,
    pub mirrors: Vec<String>,
    pub isbns: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SearchResponse {
    pub results: Vec<Book>,
    pub raw_html: String,
}

// Nova struct para retornar livros com dados do usuário do banco de dados
#[derive(Debug, Serialize, Clone)]
pub struct BookWithUserData {
    pub id: i64, // ID do livro no banco de dados
    #[serde(flatten)] // Achata os campos da struct Book nesta struct
    pub book: Book,
    pub is_reading_list: bool,
    pub is_favorite: bool,
    pub reading_progress: i32, // Progresso de leitura (ex: número da página)
    pub local_file_path: Option<String>,
}
