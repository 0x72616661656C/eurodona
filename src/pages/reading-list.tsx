"use client"

import BookListPage from "@/components/book-list-page"

export default function ReadingListPage() {
  return (
    <BookListPage
      type="reading-list"
      title="Lista de Leitura"
      emptyMessage="Sua lista de leitura está vazia."
      fetchCommand="get_reading_list_books_command"
    />
  )
}
