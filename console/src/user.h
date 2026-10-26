#ifndef USER_H
#define USER_H
#include "models.h"
void user_store_init(UserStore *store);
void user_load(UserStore *store, const char *file_name);
int user_save(const UserStore *store, const char *file_name);
User *user_authenticate(UserStore *store, const char *username, const char *password);
void user_add(UserStore *store, const char *file_name);
void user_list(const UserStore *store);
#endif
