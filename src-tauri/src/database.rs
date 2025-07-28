use rusqlite::{Connection, Result, params};
use std::path::PathBuf;

pub struct DatabaseManager {
    db_path: PathBuf,
}

impl DatabaseManager {
    pub fn new(db_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let manager = DatabaseManager { db_path };
        manager.initialize_database()?;
        Ok(manager)
    }

    fn get_connection(&self) -> Result<Connection> {
        let conn = Connection::open(&self.db_path)?;
        Ok(conn)
    }

    fn initialize_database(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                authors TEXT NOT NULL,
                publisher TEXT NOT NULL,
                year TEXT NOT NULL,
                language TEXT NOT NULL,
                extension TEXT NOT NULL,
                cover_url TEXT,
                local_file_path TEXT,
                date_added DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS user_data (
                book_id INTEGER PRIMARY KEY,
                reading_progress INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_reading_list INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )",
            [],
        )?;

        Ok(())
    }

    pub fn add_book_to_library(&self, book: &crate::libgen::Book, local_file_path: Option<String>) -> Result<i64, Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        let authors_json = serde_json::to_string(&book.authors)?;

        conn.execute(
            "INSERT INTO books (title, authors, publisher, year, language, extension, cover_url, local_file_path) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                book.title,
                authors_json,
                book.publisher,
                book.year,
                book.language,
                book.extension,
                book.cover_url,
                local_file_path
            ],
        )?;

        let book_id = conn.last_insert_rowid();

        // Inicializar dados do usuário
        conn.execute(
            "INSERT INTO user_data (book_id, reading_progress, is_favorite, is_reading_list) 
             VALUES (?1, 0, 0, 0)",
            params![book_id],
        )?;

        Ok(book_id)
    }

    pub fn get_library_books(&self) -> Result<Vec<crate::libgen::BookWithUserData>, Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.authors, b.publisher, b.year, b.language,
                b.extension, b.cover_url, b.local_file_path,
                COALESCE(ud.reading_progress, 0) as reading_progress,
                COALESCE(ud.is_favorite, 0) as is_favorite,
                COALESCE(ud.is_reading_list, 0) as is_reading_list
            FROM books b
            LEFT JOIN user_data ud ON b.id = ud.book_id
            ORDER BY b.date_added DESC
        ")?;

        let book_iter = stmt.query_map([], |row| {
            let authors_json: String = row.get(2)?;
            let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();

            // Criar a struct Book primeiro
            let book = crate::libgen::Book {
                title: row.get(1)?,
                edition_link: String::new(), // Não temos isso no banco
                authors,
                publisher: row.get(3)?,
                year: row.get(4)?,
                language: row.get(5)?,
                pages: String::new(), // Não temos isso no banco
                size: String::new(), // Não temos isso no banco
                extension: row.get(6)?,
                cover_url: row.get(7)?,
                mirrors: Vec::new(), // Não temos isso no banco
                isbns: Vec::new(), // Não temos isso no banco
            };

            // Criar BookWithUserData com o campo book aninhado
            Ok(crate::libgen::BookWithUserData {
                id: row.get(0)?,
                book,
                reading_progress: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? != 0,
                is_reading_list: row.get::<_, i32>(11)? != 0,
                local_file_path: row.get(8)?,
            })
        })?;

        let mut books = Vec::new();
        for book_result in book_iter {
            books.push(book_result?);
        }

        Ok(books)
    }

    pub fn get_reading_list_books(&self) -> Result<Vec<crate::libgen::BookWithUserData>, Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.authors, b.publisher, b.year, b.language,
                b.extension, b.cover_url, b.local_file_path,
                ud.reading_progress, ud.is_favorite, ud.is_reading_list
            FROM books b
            INNER JOIN user_data ud ON b.id = ud.book_id
            WHERE ud.is_reading_list = 1
            ORDER BY b.date_added DESC
        ")?;

        let book_iter = stmt.query_map([], |row| {
            let authors_json: String = row.get(2)?;
            let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();

            let book = crate::libgen::Book {
                title: row.get(1)?,
                edition_link: String::new(),
                authors,
                publisher: row.get(3)?,
                year: row.get(4)?,
                language: row.get(5)?,
                pages: String::new(),
                size: String::new(),
                extension: row.get(6)?,
                cover_url: row.get(7)?,
                mirrors: Vec::new(),
                isbns: Vec::new(),
            };

            Ok(crate::libgen::BookWithUserData {
                id: row.get(0)?,
                book,
                reading_progress: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? != 0,
                is_reading_list: row.get::<_, i32>(11)? != 0,
                local_file_path: row.get(8)?,
            })
        })?;

        let mut books = Vec::new();
        for book_result in book_iter {
            books.push(book_result?);
        }

        Ok(books)
    }

    pub fn get_favorite_books(&self) -> Result<Vec<crate::libgen::BookWithUserData>, Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.authors, b.publisher, b.year, b.language,
                b.extension, b.cover_url, b.local_file_path,
                ud.reading_progress, ud.is_favorite, ud.is_reading_list
            FROM books b
            INNER JOIN user_data ud ON b.id = ud.book_id
            WHERE ud.is_favorite = 1
            ORDER BY b.date_added DESC
        ")?;

        let book_iter = stmt.query_map([], |row| {
            let authors_json: String = row.get(2)?;
            let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();

            let book = crate::libgen::Book {
                title: row.get(1)?,
                edition_link: String::new(),
                authors,
                publisher: row.get(3)?,
                year: row.get(4)?,
                language: row.get(5)?,
                pages: String::new(),
                size: String::new(),
                extension: row.get(6)?,
                cover_url: row.get(7)?,
                mirrors: Vec::new(),
                isbns: Vec::new(),
            };

            Ok(crate::libgen::BookWithUserData {
                id: row.get(0)?,
                book,
                reading_progress: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? != 0,
                is_reading_list: row.get::<_, i32>(11)? != 0,
                local_file_path: row.get(8)?,
            })
        })?;

        let mut books = Vec::new();
        for book_result in book_iter {
            books.push(book_result?);
        }

        Ok(books)
    }

    pub fn update_reading_progress(&self, book_id: i64, progress: i32) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT OR REPLACE INTO user_data (book_id, reading_progress, is_favorite, is_reading_list) 
             VALUES (?1, ?2, 
                     COALESCE((SELECT is_favorite FROM user_data WHERE book_id = ?1), 0),
                     COALESCE((SELECT is_reading_list FROM user_data WHERE book_id = ?1), 0))",
            params![book_id, progress],
        )?;
        Ok(())
    }

    pub fn toggle_favorite(&self, book_id: i64, is_favorite: bool) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        let is_favorite_int = if is_favorite { 1 } else { 0 };
        conn.execute(
            "INSERT OR REPLACE INTO user_data (book_id, is_favorite, reading_progress, is_reading_list) 
             VALUES (?1, ?2, 
                     COALESCE((SELECT reading_progress FROM user_data WHERE book_id = ?1), 0),
                     COALESCE((SELECT is_reading_list FROM user_data WHERE book_id = ?1), 0))",
            params![book_id, is_favorite_int],
        )?;
        Ok(())
    }

    pub fn toggle_reading_list(&self, book_id: i64, is_reading_list: bool) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        let is_reading_list_int = if is_reading_list { 1 } else { 0 };
        conn.execute(
            "INSERT OR REPLACE INTO user_data (book_id, is_reading_list, reading_progress, is_favorite) 
             VALUES (?1, ?2, 
                     COALESCE((SELECT reading_progress FROM user_data WHERE book_id = ?1), 0),
                     COALESCE((SELECT is_favorite FROM user_data WHERE book_id = ?1), 0))",
            params![book_id, is_reading_list_int],
        )?;
        Ok(())
    }

    pub fn delete_book(&self, book_id: i64) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.get_connection()?;
        conn.execute("DELETE FROM user_data WHERE book_id = ?1", params![book_id])?;
        conn.execute("DELETE FROM books WHERE id = ?1", params![book_id])?;
        Ok(())
    }
}
