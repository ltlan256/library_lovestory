#ifndef LOAN_H
#define LOAN_H
#include "models.h"
void loan_store_init(LoanStore *store);
void loan_load(LoanStore *store, const char *file_name);
int loan_save(const LoanStore *store, const char *file_name);
void loan_borrow(BookStore *books, LoanStore *loans, const User *user, const char *book_file, const char *loan_file);
void loan_return(BookStore *books, LoanStore *loans, UserStore *users, User *user, const char *book_file, const char *loan_file, const char *user_file);
void loan_list_for_user(const LoanStore *loans, const BookStore *books, const User *user);
void loan_list_all(const LoanStore *loans, const BookStore *books);
#endif
