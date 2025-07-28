"use client"

import BookListPage from "@/components/book-list-page"

export default function FavoritesPage() {
  return (
    <BookListPage
      type="favorites"
      title="Favoritos"
      emptyMessage="Você não tem livros favoritos."
      fetchCommand="get_favorite_books_command"
    />
  )
}
