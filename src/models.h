#ifndef MODELS_H
#define MODELS_H

#define MAX_BOOKS 500
#define MAX_USERS 100
#define MAX_LOANS 500
#define TEXT_SIZE 128
#define SMALL_TEXT_SIZE 64

typedef struct { int id; char title[TEXT_SIZE]; char author[TEXT_SIZE]; char category[TEXT_SIZE]; int year; int available; } Book;
typedef struct { int id; char username[SMALL_TEXT_SIZE]; char password[SMALL_TEXT_SIZE]; char name[TEXT_SIZE]; int is_admin; int returned_books; } User;
typedef struct { int book_id; int user_id; char borrower[TEXT_SIZE]; char borrow_date[SMALL_TEXT_SIZE]; } Loan;
typedef struct { Book items[MAX_BOOKS]; int count; } BookStore;
typedef struct { User items[MAX_USERS]; int count; } UserStore;
typedef struct { Loan items[MAX_LOANS]; int count; } LoanStore;

#endif
