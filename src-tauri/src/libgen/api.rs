// src/libgen/api.rs
use super::models::{Book, SearchResponse};
use scraper::{ElementRef, Html, Selector};

const DOMAIN: &str = "https://libgen.la";

/// Analisa uma linha da tabela de resultados e a transforma em uma struct Book.
fn parse_book_from_row(row: ElementRef) -> Option<Book> {
    let cell_selector = Selector::parse("td").unwrap();
    let title_selector = Selector::parse("a[href*='edition.php']").unwrap();
    let isbn_selector = Selector::parse("font[color=green]").unwrap();
    let cover_selector = Selector::parse("img").unwrap();
    let mirror_selector =
        Selector::parse("a[href*='get.php'], a[href*='/ads.php'], a[href*='books.ms']").unwrap();

    let cells: Vec<_> = row.select(&cell_selector).collect();
    let num_cells = cells.len();

    let (cover_url, title_info_cell, data_offset) = if num_cells >= 10 {
        let cover_cell = cells[0];
        let mut url = cover_cell
            .select(&cover_selector)
            .next()
            .and_then(|img| img.value().attr("src"))
            .map(|src| format!("{}{}", DOMAIN, src))
            .unwrap_or_default();
        
        // Remove _small.jpg do final da URL da capa para obter a imagem em tamanho normal
        if url.ends_with("_small.jpg") {
            url = url.replace("_small.jpg", ".jpg");
        }

        (url, cells[1], 1)
    } else if num_cells == 9 {
        (String::new(), cells[0], 0)
    } else {
        return None;
    };

    let title_element = title_info_cell.select(&title_selector).next()?;
    let title = title_element.text().collect::<String>().trim().to_string();
    if title.is_empty() {
        return None;
    }

    let edition_link = title_element
        .value()
        .attr("href")
        .map(|href| format!("{}/{}", DOMAIN, href))
        .unwrap_or_default();

    let isbns: Vec<String> = title_info_cell
        .select(&isbn_selector)
        .next()
        .map(|font| font.text().collect::<String>())
        .unwrap_or_default()
        .split(';')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let authors = vec![cells[data_offset + 1]
        .text()
        .collect::<String>()
        .trim()
        .to_string()];
    let publisher = cells[data_offset + 2]
        .text()
        .collect::<String>()
        .trim()
        .to_string();
    let year = cells[data_offset + 3]
        .text()
        .collect::<String>()
        .trim()
        .to_string();
    let language = cells[data_offset + 4]
        .text()
        .collect::<String>()
        .trim()
        .to_string();
    let pages = cells[data_offset + 5]
        .text()
        .collect::<String>()
        .trim()
        .to_string();
    let size = cells[data_offset + 6]
        .text()
        .collect::<String>()
        .trim()
        .to_string();
    let extension = cells[data_offset + 7]
        .text()
        .collect::<String>()
        .trim()
        .to_string();

    let mirrors: Vec<String> = cells[data_offset + 8]
        .select(&mirror_selector)
        .filter_map(|a| {
            a.value().attr("href").map(|href| {
                if href.starts_with('/') {
                    format!("{}{}", DOMAIN, href)
                } else {
                    href.to_string()
                }
            })
        })
        .collect();

    if mirrors.is_empty() {
        return None;
    }

    Some(Book {
        title,
        edition_link,
        authors,
        publisher,
        year,
        language,
        pages,
        size,
        extension,
        cover_url,
        mirrors,
        isbns,
    })
}

/// Tenta encontrar o link de download final a partir de uma lista de mirrors.
pub async fn find_final_download_link(mirrors: &[String]) -> Result<Option<String>, String> {
    for mirror_url in mirrors {
        if let Ok(resp) = reqwest::get(mirror_url).await {
            if let Ok(text) = resp.text().await {
                let doc = Html::parse_document(&text);
                if let Some(element) = doc
                    .select(&Selector::parse("a[href*='get.php?md5=']").unwrap())
                    .next()
                {
                    if let Some(href) = element.value().attr("href") {
                        return Ok(Some(format!("{}/{}", DOMAIN, href)));
                    }
                }
                if let Some(element) = doc
                    .select(&Selector::parse("h2 > a[href*='library.lol']").unwrap())
                    .next()
                {
                    if let Some(href) = element.value().attr("href") {
                        return Ok(Some(href.to_string()));
                    }
                }
            }
        }
    }
    Ok(None)
}

/// Executa uma busca no Libgen e retorna os resultados.
pub async fn search_books(term: String) -> Result<SearchResponse, String> {
    let encoded_term = term.replace(' ', "+");
    let url = format!(
        "{}/index.php?req={}&columns[]=t&columns[]=a&columns[]=s&columns[]=y&columns[]=p&columns[]=i&objects[]=f&objects[]=e&objects[]=s&objects[]=a&objects[]=p&objects[]=w&topics[]=l&topics[]=c&topics[]=f&topics[]=a&topics[]=m&topics[]=r&topics[]=s&res=100&covers=on&showch=on&gmode=on&filesuns=all",
        DOMAIN, encoded_term
    );

    let html_content = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html_content);
    let row_selector = Selector::parse("table.c > tbody > tr, #tablelibgen > tbody > tr").unwrap();

    let books: Vec<Book> = document
        .select(&row_selector)
        .skip(1)
        .filter_map(parse_book_from_row)
        .collect();

    Ok(SearchResponse {
        results: books,
        raw_html: html_content,
    })
}
