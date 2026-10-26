#include "loan.h"
#include "book.h"
#include "user.h"
#include "utils.h"
#include <stdio.h>
#include <string.h>
#include <time.h>

#define LOAN_DAYS 30
#define LOAN_LIMIT 10

void loan_store_init(LoanStore *store) { store->count = 0; }

static int date_time(const char *text, int add_days, time_t *out) {
    struct tm t; int year, month, day;
    if (sscanf(text, "%d-%d-%d", &year, &month, &day) != 3) return 0;
    memset(&t, 0, sizeof(t));
    t.tm_year = year - 1900; t.tm_mon = month - 1; t.tm_mday = day + add_days; t.tm_hour = 12;
    *out = mktime(&t);
    return *out != (time_t)-1;
}

static int today_date(char *buffer, size_t size) {
    time_t now = time(NULL); struct tm *local = localtime(&now);
    return local != NULL && strftime(buffer, size, "%Y-%m-%d", local) > 0;
}

static int loan_overdue_days(const Loan *loan) {
    char today[SMALL_TEXT_SIZE]; time_t due, now; double seconds;
    if (!date_time(loan->borrow_date, LOAN_DAYS, &due) || !today_date(today, sizeof(today)) || !date_time(today, 0, &now)) return 0;
    seconds = difftime(now, due);
    int days = (int)(seconds / 86400.0 + (seconds >= 0 ? 0.5 : -0.5));
    return days > 0 ? days : 0;
}

static void loan_due_text(const Loan *loan, char *buffer, size_t size) {
    time_t due; struct tm *local;
    if (!date_time(loan->borrow_date, LOAN_DAYS, &due) || (local = localtime(&due)) == NULL || strftime(buffer, size, "%Y-%m-%d", local) == 0) snprintf(buffer, size, "未知");
}

static int loan_count_for_user(const LoanStore *store, int user_id) {
    int count = 0;
    for (int i = 0; i < store->count; i++) if (store->items[i].user_id == user_id) count++;
    return count;
}

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
    int book_id = read_int("请输入要借阅的图书编号: "); int book_index = book_find_index(books, book_id); Loan loan; char due[SMALL_TEXT_SIZE];
    if (book_index < 0) printf("未找到该编号的图书。\n");
    else if (!books->items[book_index].available) printf("这本书当前已被借出。\n");
    else if (loan_count_for_user(loans, user->id) >= LOAN_LIMIT) printf("每人最多同时借阅 %d 本书，请先归还后再借。\n", LOAN_LIMIT);
    else if (loans->count >= MAX_LOANS) printf("借阅记录已达到上限。\n");
    else if (!today_date(loan.borrow_date, sizeof(loan.borrow_date))) printf("无法获取当前日期，借阅失败。\n");
    else {
        loan.book_id = book_id; loan.user_id = user->id; strcpy(loan.borrower, user->name);
        loans->items[loans->count++] = loan; books->items[book_index].available = 0;
        book_save(books, book_file); loan_save(loans, loan_file); loan_due_text(&loan, due, sizeof(due));
        printf("借阅成功: %s\n借阅日期: %s | 应还日期: %s（%d 天内归还，逾期每天扣 1 点进度）\n", books->items[book_index].title, loan.borrow_date, due, LOAN_DAYS);
    }
}

void loan_return(BookStore *books, LoanStore *loans, UserStore *users, User *user, const char *book_file, const char *loan_file, const char *user_file) {
    int book_id = read_int("请输入要归还的图书编号: "); int loan_index = loan_find_index(loans, book_id, user->id); int book_index = book_find_index(books, book_id); int overdue;
    if (loan_index < 0 || book_index < 0) { printf("没有找到你的这条借阅记录。\n"); return; }
    overdue = loan_overdue_days(&loans->items[loan_index]);
    for (int i = loan_index; i < loans->count - 1; i++) loans->items[i] = loans->items[i + 1];
    loans->count--; books->items[book_index].available = 1; user->returned_books++; user->overdue_penalty += overdue;
    book_save(books, book_file); loan_save(loans, loan_file); user_save(users, user_file);
    printf("归还成功: %s\n", books->items[book_index].title);
    if (overdue > 0) printf("本书逾期 %d 天，扣除 %d 点进度。\n", overdue, overdue);
}

void loan_list_for_user(const LoanStore *loans, const BookStore *books, const User *user) {
    int found = 0; printf("\n========== 我的借阅 ==========\n");
    for (int i = 0; i < loans->count; i++) if (loans->items[i].user_id == user->id) {
        int book_index = book_find_index(books, loans->items[i].book_id); int overdue = loan_overdue_days(&loans->items[i]); char due[SMALL_TEXT_SIZE];
        loan_due_text(&loans->items[i], due, sizeof(due));
        printf("图书编号: %d | 借阅者: %s | 借阅日期: %s | 应还日期: %s", loans->items[i].book_id, loans->items[i].borrower, loans->items[i].borrow_date, due);
        if (overdue > 0) printf(" | 已逾期 %d 天 · 扣 %d 点", overdue, overdue);
        printf("\n");
        if (book_index >= 0) {
            printf("书名: %s\n", books->items[book_index].title);
        }
        found = 1;
    }
    if (!found) printf("当前没有借阅记录。\n");
    printf("当前进度: %d（已归还 %d 本，累计逾期扣除 %d 点）\n", user_progress(user), user->returned_books, user->overdue_penalty);
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
