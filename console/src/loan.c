#include "loan.h"
#include "book.h"
#include "user.h"
#include "utils.h"
#include <stdio.h>
#include <string.h>

void loan_store_init(LoanStore *store) { store->count = 0; }

void loan_load(LoanStore *store, const char *file_name) {
    FILE *file = fopen(file_name, "r"); char line[TEXT_SIZE * 2];
    if (file == NULL) return;
    while (store->count < MAX_LOANS && fgets(line, sizeof(line), file) != NULL) {
        Loan *loan = &store->items[store->count]; trim_newline(line);
        if (sscanf(line, "%d|%d|%127[^|]|%63[^|]", &loan->book_id, &loan->user_id, loan->borrower, loan->borrow_date) == 4) store->count++;
    }
    fclose(file);
}

int loan_save(const LoanStore *store, const char *file_name) {
    FILE *file = fopen(file_name, "w");
    if (file == NULL) { perror("无法保存借阅记录"); return 0; }
    for (int i = 0; i < store->count; i++) fprintf(file, "%d|%d|%s|%s\n", store->items[i].book_id, store->items[i].user_id, store->items[i].borrower, store->items[i].borrow_date);
    fclose(file); return 1;
}

static int loan_find_index(const LoanStore *store, int book_id, int user_id) {
    for (int i = 0; i < store->count; i++) if (store->items[i].book_id == book_id && store->items[i].user_id == user_id) return i;
    return -1;
}

void loan_borrow(BookStore *books, LoanStore *loans, const User *user, const char *book_file, const char *loan_file) {
    int book_id = read_int("请输入要借阅的图书编号: "); int book_index = book_find_index(books, book_id); Loan loan;
    if (book_index < 0) printf("未找到该编号的图书。\n");
    else if (!books->items[book_index].available) printf("这本书当前已被借出。\n");
    else if (loans->count >= MAX_LOANS) printf("借阅记录已达到上限。\n");
    else {
        loan.book_id = book_id; loan.user_id = user->id; strcpy(loan.borrower, user->name);
        read_line("请输入借阅日期(YYYY-MM-DD): ", loan.borrow_date, sizeof(loan.borrow_date)); loans->items[loans->count++] = loan;
        books->items[book_index].available = 0; book_save(books, book_file); loan_save(loans, loan_file);
        printf("借阅成功: %s\n", books->items[book_index].title);
    }
}

void loan_return(BookStore *books, LoanStore *loans, UserStore *users, User *user, const char *book_file, const char *loan_file, const char *user_file) {
    int book_id = read_int("请输入要归还的图书编号: "); int loan_index = loan_find_index(loans, book_id, user->id); int book_index = book_find_index(books, book_id);
    if (loan_index < 0 || book_index < 0) { printf("没有找到你的这条借阅记录。\n"); return; }
    for (int i = loan_index; i < loans->count - 1; i++) loans->items[i] = loans->items[i + 1];
    loans->count--; books->items[book_index].available = 1; user->returned_books++;
    book_save(books, book_file); loan_save(loans, loan_file); user_save(users, user_file);
    printf("归还成功: %s\n", books->items[book_index].title);
}

void loan_list_for_user(const LoanStore *loans, const BookStore *books, const User *user) {
    int found = 0; printf("\n========== 我的借阅 ==========\n");
    for (int i = 0; i < loans->count; i++) if (loans->items[i].user_id == user->id) {
        int book_index = book_find_index(books, loans->items[i].book_id);
        printf("图书编号: %d | 借阅者: %s | 借阅日期: %s\n", loans->items[i].book_id, loans->items[i].borrower, loans->items[i].borrow_date);
        if (book_index >= 0) {
            printf("书名: %s\n", books->items[book_index].title);
        }
        found = 1;
    }
    if (!found) printf("当前没有借阅记录。\n");
}

void loan_list_all(const LoanStore *loans, const BookStore *books) {
    printf("\n========== 全部借阅记录 ==========\n");
    if (loans->count == 0) { printf("当前没有借阅记录。\n"); return; }
    for (int i = 0; i < loans->count; i++) {
        int book_index = book_find_index(books, loans->items[i].book_id);
        printf("图书编号: %d | 借阅者编号: %d | 姓名: %s | 日期: %s", loans->items[i].book_id, loans->items[i].user_id, loans->items[i].borrower, loans->items[i].borrow_date);
        if (book_index >= 0) printf(" | 书名: %s", books->items[book_index].title);
        printf("\n");
    }
}
