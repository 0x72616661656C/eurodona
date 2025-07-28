use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use zip::ZipArchive;
use epub::doc::EpubDoc;
use pdf_extract;
use base64::{Engine as _, engine::general_purpose};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookContent {
    pub pages: Vec<BookPage>,
    pub total_pages: usize,
    pub resources: HashMap<String, String>,
    pub stylesheets: Vec<String>,
    pub metadata: BookMetadata,
    pub chapters: Vec<BookChapter>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookPage {
    pub page_number: usize,
    pub content: String,
    pub word_count: Option<usize>,
    pub chapter_title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookMetadata {
    pub title: String,
    pub authors: Vec<String>,
    pub publisher: Option<String>,
    pub publication_date: Option<String>,
    pub language: Option<String>,
    pub isbn: Option<String>,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub page_count: usize,
    pub file_size: Option<u64>,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookChapter {
    pub title: String,
    pub resource: String, // We'll store the resource path to link to pages
    pub level: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub page_number: usize,
    pub context: String,
    pub position: usize,
    pub chapter_title: Option<String>,
}

pub struct BookReader;

impl BookReader {
    pub fn read_book(file_path: &str) -> Result<BookContent, String> {
        let extension = Path::new(file_path)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "epub" => Self::read_epub(file_path),
            "pdf" => Self::read_pdf(file_path),
            "cbz" => Self::read_cbz(file_path),
            "txt" => Self::read_txt(file_path),
            _ => Err(format!("Formato não suportado: {}", extension)),
        }
    }

    pub fn get_page_content(file_path: &str, page_number: usize) -> Result<BookPage, String> {
        let content = Self::read_book(file_path)?;

        if page_number > 0 && page_number <= content.total_pages {
            Ok(content.pages[page_number - 1].clone())
        } else {
            Err("Número de página inválido".to_string())
        }
    }

    pub fn search_in_book(file_path: &str, query: &str) -> Result<Vec<SearchResult>, String> {
        let content = Self::read_book(file_path)?;
        let mut results = Vec::new();

        for page in &content.pages {
            let page_text = Self::strip_html(&page.content);
            if let Some(pos) = page_text.to_lowercase().find(&query.to_lowercase()) {
                let start = pos.saturating_sub(50);
                let end = std::cmp::min(pos + query.len() + 50, page_text.len());
                let context = page_text[start..end].to_string();

                results.push(SearchResult {
                    page_number: page.page_number,
                    context,
                    position: pos,
                    chapter_title: page.chapter_title.clone(),
                });
            }
        }

        Ok(results)
    }

    fn read_epub(file_path: &str) -> Result<BookContent, String> {
        let mut doc = EpubDoc::new(file_path)
            .map_err(|e| format!("Erro ao abrir EPUB: {}", e))?;
    
        let mut pages = Vec::new();
        let mut resources = HashMap::new();
        let mut stylesheets = Vec::new();
        
        fn process_chapters_recursive(
            nav_points: &[epub::doc::NavPoint],
            level: usize,
            chapters: &mut Vec<BookChapter>,
        ) {
            for nav_point in nav_points {
                chapters.push(BookChapter {
                    title: nav_point.label.clone(),
                    resource: nav_point.content.to_string_lossy().to_string(),
                    level,
                });
                if !nav_point.children.is_empty() {
                    process_chapters_recursive(&nav_point.children, level + 1, chapters);
                }
            }
        }
        
        let mut chapters = Vec::new();
        process_chapters_recursive(&doc.toc, 1, &mut chapters);
    
        let metadata = BookMetadata {
            title: doc.mdata("title").unwrap_or_else(|| "Título Desconhecido".to_string()),
            authors: doc.mdata("creator").map(|s| vec![s]).unwrap_or_else(|| vec!["Autor Desconhecido".to_string()]),
            publisher: doc.mdata("publisher"),
            publication_date: doc.mdata("date"),
            language: doc.mdata("language"),
            isbn: doc.mdata("identifier"),
            description: doc.mdata("description"),
            cover_image: None,
            page_count: 0,
            file_size: std::fs::metadata(file_path).ok().map(|m| m.len()),
            format: "EPUB".to_string(),
        };
    
        for resource_id in doc.resources.keys().cloned().collect::<Vec<_>>() {
            if let Some((content, mime_type)) = doc.get_resource(&resource_id) {
                let base64_content = general_purpose::STANDARD.encode(&content);
                let data_url = format!("data:{};base64,{}", mime_type, base64_content);
                resources.insert(resource_id.clone(), data_url);
    
                if mime_type == "text/css" {
                    if let Ok(css_text) = String::from_utf8(content) {
                        stylesheets.push(css_text);
                    }
                }
            }
        }
    
        // Processar páginas da spine
        for spine_index in 0..doc.spine.len() {
            if doc.set_current_page(spine_index) {
                // ** FIX IS HERE: Get content and path in two steps **
                if let Some((content, _mime)) = doc.get_current_str() {
                    if let Some(resource_path) = doc.get_current_path() {
                        let mut html_content = content;
    
                        for (resource_id, data_url) in &resources {
                            html_content = html_content
                                .replace(&format!("src=\"../{}\"", resource_id), &format!("src=\"{}\"", data_url))
                                .replace(&format!("href=\"../{}\"", resource_id), &format!("href=\"{}\"", data_url))
                                .replace(&format!("url(../{})", resource_id), &format!("url({})", data_url));
                        }
    
                        let word_count = Self::count_words(&html_content);
                        
                        let chapter_title = chapters.iter()
                            .find(|ch| resource_path.to_string_lossy().contains(&ch.resource))
                            .map(|ch| ch.title.clone());
    
                        pages.push(BookPage {
                            page_number: pages.len() + 1,
                            content: html_content,
                            word_count: Some(word_count),
                            chapter_title,
                        });
                    }
                }
            }
        }
    
        let mut final_metadata = metadata;
        final_metadata.page_count = pages.len();
    
        Ok(BookContent {
            total_pages: pages.len(),
            pages,
            resources,
            stylesheets,
            metadata: final_metadata,
            chapters,
        })
    }
    

    fn read_pdf(file_path: &str) -> Result<BookContent, String> {
        let text = pdf_extract::extract_text(file_path)
            .map_err(|e| format!("Erro ao extrair PDF: {}", e))?;

        let pages: Vec<BookPage> = text
            .split('\x0C')
            .enumerate()
            .filter_map(|(i, page_text)| {
                if !page_text.trim().is_empty() {
                    Some(BookPage {
                        page_number: i + 1,
                        content: format!("<pre>{}</pre>", Self::escape_html(page_text)),
                        word_count: Some(Self::count_words(page_text)),
                        chapter_title: None,
                    })
                } else {
                    None
                }
            })
            .collect();

        let metadata = BookMetadata {
            title: Path::new(file_path).file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Documento PDF")
                .to_string(),
            authors: vec!["Autor Desconhecido".to_string()],
            publisher: None,
            publication_date: None,
            language: None,
            isbn: None,
            description: None,
            cover_image: None,
            page_count: pages.len(),
            file_size: std::fs::metadata(file_path).ok().map(|m| m.len()),
            format: "PDF".to_string(),
        };

        Ok(BookContent {
            total_pages: pages.len(),
            pages,
            resources: HashMap::new(),
            stylesheets: vec!["pre { font-family: serif; white-space: pre-wrap; }".to_string()],
            metadata,
            chapters: Vec::new(),
        })
    }

    fn read_cbz(file_path: &str) -> Result<BookContent, String> {
        let file = File::open(file_path)
            .map_err(|e| format!("Erro ao abrir CBZ: {}", e))?;
        
        let mut archive = ZipArchive::new(BufReader::new(file))
            .map_err(|e| format!("Erro ao ler ZIP: {}", e))?;

        let mut image_files = Vec::new();
        for i in 0..archive.len() {
            let file = archive.by_index(i)
                .map_err(|e| format!("Erro ao acessar arquivo: {}", e))?;
            
            let name = file.name().to_string();
            if Self::is_image_file(&name) {
                image_files.push((i, name));
            }
        }

        image_files.sort_by(|a, b| a.1.cmp(&b.1));

        let mut pages = Vec::new();
        for (page_num, (index, _)) in image_files.iter().enumerate() {
            let mut file = archive.by_index(*index)
                .map_err(|e| format!("Erro ao acessar imagem: {}", e))?;
            
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Erro ao ler imagem: {}", e))?;

            let base64_image = general_purpose::STANDARD.encode(&buffer);
            let data_url = format!("data:image/jpeg;base64,{}", base64_image);
            
            pages.push(BookPage {
                page_number: page_num + 1,
                content: format!(
                    r#"<div style="text-align: center; height: 100vh; display: flex; align-items: center; justify-content: center;">
                        <img src="{}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>"#, 
                    data_url
                ),
                word_count: Some(0),
                chapter_title: None,
            });
        }

        let metadata = BookMetadata {
            title: Path::new(file_path).file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Comic Book")
                .to_string(),
            authors: vec!["Autor Desconhecido".to_string()],
            publisher: None,
            publication_date: None,
            language: None,
            isbn: None,
            description: None,
            cover_image: None,
            page_count: pages.len(),
            file_size: std::fs::metadata(file_path).ok().map(|m| m.len()),
            format: "CBZ".to_string(),
        };

        Ok(BookContent {
            total_pages: pages.len(),
            pages,
            resources: HashMap::new(),
            stylesheets: Vec::new(),
            metadata,
            chapters: Vec::new(),
        })
    }

    fn read_txt(file_path: &str) -> Result<BookContent, String> {
        let content = std::fs::read_to_string(file_path)
            .map_err(|e| format!("Erro ao ler TXT: {}", e))?;

        let word_count = Self::count_words(&content);
        let pages = vec![BookPage {
            page_number: 1,
            content: format!("<pre>{}</pre>", Self::escape_html(&content)),
            word_count: Some(word_count),
            chapter_title: None,
        }];

        let metadata = BookMetadata {
            title: Path::new(file_path).file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Documento de Texto")
                .to_string(),
            authors: vec!["Autor Desconhecido".to_string()],
            publisher: None,
            publication_date: None,
            language: None,
            isbn: None,
            description: None,
            cover_image: None,
            page_count: 1,
            file_size: std::fs::metadata(file_path).ok().map(|m| m.len()),
            format: "TXT".to_string(),
        };

        Ok(BookContent {
            total_pages: 1,
            pages,
            resources: HashMap::new(),
            stylesheets: vec!["pre { font-family: monospace; white-space: pre-wrap; }".to_string()],
            metadata,
            chapters: Vec::new(),
        })
    }

    fn is_image_file(filename: &str) -> bool {
        let lower = filename.to_lowercase();
        lower.ends_with(".jpg") || lower.ends_with(".jpeg") || 
        lower.ends_with(".png") || lower.ends_with(".gif") || 
        lower.ends_with(".bmp") || lower.ends_with(".webp")
    }

    fn escape_html(text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    }

    fn strip_html(html: &str) -> String {
        // Simples remoção de tags HTML para busca
        let re = regex::Regex::new(r"<[^>]*>").unwrap();
        re.replace_all(html, "").to_string()
    }

    fn count_words(text: &str) -> usize {
        let clean_text = Self::strip_html(text);
        clean_text.split_whitespace().count()
    }
}