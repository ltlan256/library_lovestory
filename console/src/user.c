#include "user.h"
#include "utils.h"
#include <stdio.h>
#include <string.h>

void user_store_init(UserStore *store) { store->count = 0; }

void user_load(UserStore *store, const char *file_name) {
    FILE *file = fopen(file_name, "r"); char line[TEXT_SIZE * 3];
    if (file == NULL) return;
    while (store->count < MAX_USERS && fgets(line, sizeof(line), file) != NULL) {
        User *user = &store->items[store->count]; trim_newline(line);
        user->returned_books = 0;
        if (sscanf(line, "%d|%63[^|]|%63[^|]|%127[^|]|%d|%d", &user->id, user->username, user->password, user->name, &user->is_admin, &user->returned_books) >= 5) store->count++;
    }
    fclose(file);
}

int user_save(const UserStore *store, const char *file_name) {
    FILE *file = fopen(file_name, "w");
    if (file == NULL) { perror("无法保存用户数据"); return 0; }
    for (int i = 0; i < store->count; i++) {
        const User *user = &store->items[i];
        fprintf(file, "%d|%s|%s|%s|%d|%d\n", user->id, user->username, user->password, user->name, user->is_admin, user->returned_books);
    }
    fclose(file); return 1;
}

User *user_authenticate(UserStore *store, const char *username, const char *password) {
    for (int i = 0; i < store->count; i++) {
        User *user = &store->items[i];
        if (strcmp(user->username, username) == 0 && strcmp(user->password, password) == 0) return user;
    }
    return NULL;
}

void user_add(UserStore *store, const char *file_name) {
    User user; int max_id = 0;
    if (store->count >= MAX_USERS) { printf("用户数量已达到上限。\n"); return; }
    for (int i = 0; i < store->count; i++) if (store->items[i].id > max_id) max_id = store->items[i].id;
    user.id = max_id + 1; user.returned_books = 0;
    read_line("请输入登录账号: ", user.username, sizeof(user.username)); read_line("请输入登录密码: ", user.password, sizeof(user.password));
    read_line("请输入借阅者姓名: ", user.name, sizeof(user.name)); user.is_admin = 0;
    store->items[store->count++] = user; user_save(store, file_name); printf("借阅者添加成功，用户编号为 %d。\n", user.id);
}

void user_list(const UserStore *store) {
    printf("\n========== 借阅者列表 ==========\n");
    for (int i = 0; i < store->count; i++) if (!store->items[i].is_admin) printf("编号: %-4d | 账号: %-16s | 姓名: %s\n", store->items[i].id, store->items[i].username, store->items[i].name);
}
