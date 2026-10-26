#ifndef BOOK_H
#define BOOK_H
#include "models.h"
void book_store_init(BookStore *store);
void book_load(BookStore *store, const char *file_name);
int book_save(const BookStore *store, const char *file_name);
int book_find_index(const BookStore *store, int id);
void book_print(const Book *book);
void book_list(const BookStore *store);
void book_search(const BookStore *store);
void book_add(BookStore *store, const char *file_name);
void book_update(BookStore *store, const char *file_name);
void book_delete(BookStore *store, const char *file_name);
#endif
