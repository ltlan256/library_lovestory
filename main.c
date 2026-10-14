#include "book.h"
#include "loan.h"
#include "user.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>
#ifdef _WIN32
#include <windows.h>
#include <mmsystem.h>
#endif

#define BOOK_FILE "books.txt"
#define USER_FILE "users.txt"
#define LOAN_FILE "loans.txt"
#define ENDING_ART_FILE "ending.txt"

#ifdef _WIN32
enum { BGM_BEGIN, BGM_MIDDLE, BGM_ENDING };
static int current_bgm_stage = -1;

static void bgm_play_stage(int stage) {
    char command[128];
    const char *filename;

    if (current_bgm_stage == stage) return;

    mciSendStringA("stop library_bgm", NULL, 0, NULL);
    mciSendStringA("close library_bgm", NULL, 0, NULL);
    if (stage == BGM_ENDING) filename = "ending.mp3";
    else if (stage == BGM_MIDDLE) filename = "middle.mp3";
    else filename = "begin.mp3";
    snprintf(command, sizeof(command),
             "open \"%s\" type mpegvideo alias library_bgm", filename);
    mciSendStringA(command, NULL, 0, NULL);
    mciSendStringA("play library_bgm repeat", NULL, 0, NULL);
    current_bgm_stage = stage;
}

static void bgm_start(void) {
    bgm_play_stage(BGM_BEGIN);
}

static void bgm_update_for_progress(int returned_books) {
    if (returned_books >= 25) bgm_play_stage(BGM_ENDING);
    else if (returned_books > 4) bgm_play_stage(BGM_MIDDLE);
    else bgm_play_stage(BGM_BEGIN);
}

static void bgm_stop(void) {
    mciSendStringA("stop library_bgm", NULL, 0, NULL);
    mciSendStringA("close library_bgm", NULL, 0, NULL);
    current_bgm_stage = -1;
}
#else
static void bgm_start(void) { }
static void bgm_update_for_progress(int returned_books) { (void)returned_books; }
static void bgm_stop(void) { }
#endif

static User *login(UserStore *users) {
    char username[SMALL_TEXT_SIZE], password[SMALL_TEXT_SIZE];
    read_line("账号: ", username, sizeof(username)); read_line("密码: ", password, sizeof(password));
    return user_authenticate(users, username, password);
}

static void pause_page(void) {
    char input[SMALL_TEXT_SIZE];
    read_line("\n按回车返回上一页...", input, sizeof(input));
}

static void welcome_page(void) {
    printf("\n\n");
    printf("        *  .  *     .  *     .  *\n");
    printf("     .        *  *  .  *  *        .\n\n");
    printf("              /\\_/\\\n");
    printf("             ( o.o )\n");
    printf("              > ^ <\n");
    printf("          .-=================-.\n");
    printf("         /  欢迎来到图书馆！  \\\n");
    printf("        /_______________________\\\n");
    printf("        |  []  []  |  []  []   |\n");
    printf("        |  []  []  |  []  []   |\n");
    printf("        |__________|____________|\n");
    printf("        |       ______________  |\n");
    printf("        |      |              | |\n");
    printf("        |______|______________|_|\n\n");
    printf("          (ﾉ≧∀≦)ﾉ ︵ ┻━┻\n\n");
    printf("          ==============================\n");
    printf("             欢迎来到图书馆攻略系统\n");
    printf("          ==============================\n");
    printf("              今天也要好好读书哦！\n\n");
    printf("        *  .  *     .  *     .  *\n\n");
}

static void flow_portrait(int blushing) {
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⣀⣀⠀⢀⢀⡠⠔⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n");
        printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣤⣭⣿⣿⣭⣿⣟⣥⣖⣫⣭⣤⡄⠀⠀⠀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣻⡶⢤⡀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⠚⣩⣶⣿⣿⣿⣿⣿⣿⣿⣾⣿⣿⣿⣿⣿⡿⢿⣷⣦⣄⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿⣿⣿⣿⣿⢿⢿⣿⣿⣿⣿⣿⣿⣿⠇⠨⣿⣿⣕⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡜⣵⣿⣿⣿⣿⣿⣿⣿⣵⣤⣽⣸⣿⡛⡟⣷⣁⣸⣶⣾⣿⣿⣿⣆⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠸⢫⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⣿⣷⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠇⢸⢿⣿⣿⡿⢻⣿⣿⣧⣿⣿⢿⢿⡏⡿⢿⣿⣿⣿⣿⣿⣿⣿⡟⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠘⣿⢿⡇⠀⠉⠙⠙⠿⠿⠈⡿⠟⢿⠽⠏⢿⣿⣿⣿⣿⡇⠁⠀⠀⠀\n");
    if (blushing) printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⢸⡇⸝⸝⠀⠀⠀⠀⠀⠀  ⢨⣿⠛⠟⠃⠀⠀⠀⠀⠀\n");
    else printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢨⣿⠛⠟⠃⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⢁⠀⠀⠀⠀⢀⡀⠀⠀⠀⠀⠀⠀⡼⢟⠀⠀⠀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⡀⠀⠀⠀⠈⠁⠀⠀⠀⠀⠀⢰⡥⠀⠀⠀⠀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⡷⡀⠀⠐⠦⠤⠀⠀⠀⢀⠄⡽⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡇⢚⣦⡀⠀⠀⢀⣠⠔⠁⠀⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣔⣶⠆⠀⣰⡷⢿⠫⡿⠒⠒⠉⠀⠀⠀⠀⠓⠶⣤⡄⣀⠀⠀⠀⠀⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠲⣿⣽⣷⣾⣿⣿⣿⠀⡸⢛⠀⣹⡄⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⡌⠉⠁⡲⢠⣤⣄\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⢸⣿⢿⣿⣿⣿⣿⣟⠄⠛⠁⠋⢿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⢱⠁⠀⣰⢱⣷⠃⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠈⣿⡘⡆⢹⣿⣿⠿⠓⠒⠀⢀⠈⠃⠀⠀⠀⠀⠀⠀⠀⠀⣼⣧⠇⠀⢠⠇⣿⡏⠀⠀\n");
    printf("⠀⠀⠀⠀⠀⠀⠀⠀⢹⣧⣿⢸⡏⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⢟⠆⠀⠀⢸⢰⣻⠁⠀⠀\n");
}

static void strategy_info(void) {
    printf("\n========== 图书馆攻略说明 ==========\n");
    printf("角色立绘：流川枫\n");
    flow_portrait(0);
    printf("目标角色：流川枫 (｡･ω･｡)\n");
    printf("攻略方式：借阅图书并成功归还，慢慢积累他的好感度。\n");
    printf("当前规则：每成功归还 1 本图书，好感度 +1。\n");
    printf("达成条件：成功归还 25 本图书，即可触发攻略结局！\n");
    printf("提示：请先从登录入口进入借阅者账号。\n");
    pause_page();
}

static void ending_page(void) {
    char line[1024];
    FILE *file = fopen(ENDING_ART_FILE, "r");

    printf("\n========== 攻略成功 ==========" "\n\n");
    if (file != NULL) {
        while (fgets(line, sizeof(line), file) != NULL) fputs(line, stdout);
        fclose(file);
    } else {
        printf("[无法读取最终攻略画面：%s]\n", ENDING_ART_FILE);
    }
    printf("\n(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ 恭喜你，你可以跟他一起打篮球了！\n");
    printf("从今天起，就和流川枫一起奔赴球场吧～ ٩(ˊᗜˋ*)و ♡\n");
}

static void ending_sequence(void) {
    char input[SMALL_TEXT_SIZE];

    printf("\n========== 鼓起勇气 ==========\n");
    printf("最近几天，你发现流川枫每次看向你时，脸上都泛着淡淡的红晕。\n");
    printf("终于，你鼓起勇气，向他说出自己的心里话。\n\n");
    printf("你大喊道：“流川枫，我可以跟你一起打篮球吗？”\n");
    printf("流川枫白皙的脸上泛起淡淡的红晕，然后默默地点了点头。\n");
    read_line("\n按回车切换到最终页面...", input, sizeof(input));

#ifdef _WIN32
    (void)system("cls");
#else
    (void)system("clear");
#endif
    ending_page();
    pause_page();
}

static void relationship_status(const User *user) {
    int filled = user->returned_books * 10 / 25;
    if (filled > 10) filled = 10;
    bgm_update_for_progress(user->returned_books);
    if (user->returned_books >= 25) {
        ending_sequence();
        return;
    }
    printf("\n========== 攻略进度 ==========\n");
    printf("对象：流川枫  (´• ω •`)\n");
    flow_portrait(user->returned_books > 4);
    if (user->returned_books > 4) {
        printf("流川枫脸红了！你已经成功借阅并归还 %d 本书。\n", user->returned_books);
    } else {
        printf("借阅并成功归还超过 4 本后，流川枫就会脸红。\n");
    }
    printf("流川枫  (´• ω •`)   好感度：");
    for (int i = 0; i < 10; i++) printf(i < filled ? "♥" : "♡");
    printf(" %d / 25 本\n", user->returned_books);
    if (user->returned_books > 0) {
        printf("(ง •̀_•́)ง 继续借阅并归还，就快成功啦！\n");
    } else {
        printf("(｡•́︿•̀｡) 还没有成功归还记录，快去挑一本书吧！\n");
    }
    pause_page();
}

static void admin_menu(void) { printf("\n========== 管理员菜单 ==========\n1. 查看全部图书\n2. 检索图书\n3. 添加图书\n4. 修改图书\n5. 删除图书\n6. 添加借阅者\n7. 查看借阅者\n8. 查看全部借阅记录\n0. 退出当前账号\n"); }
static void user_menu(void) { printf("\n========== 借阅者菜单 ==========\n1. 查看全部图书\n2. 检索图书\n3. 借阅图书\n4. 归还图书\n5. 查看我的借阅\n6. 查看攻略进度\n0. 退出当前账号\n"); }

static void run_admin(BookStore *books, UserStore *users, LoanStore *loans) {
    int choice;
    while (1) {
        admin_menu(); choice = read_int("请选择操作: ");
        switch (choice) {
            case 1: book_list(books); break; case 2: book_search(books); break; case 3: book_add(books, BOOK_FILE); break;
            case 4: book_update(books, BOOK_FILE); break; case 5: book_delete(books, BOOK_FILE); break; case 6: user_add(users, USER_FILE); break;
            case 7: user_list(users); break; case 8: loan_list_all(loans, books); break; case 0: return;
            default: printf("无效选项，请重新选择。\n");
        }
    }
}

static void run_user(User *user, BookStore *books, UserStore *users, LoanStore *loans) {
    int choice;
    bgm_update_for_progress(user->returned_books);
    while (1) {
        user_menu(); choice = read_int("请选择操作: ");
        switch (choice) {
            case 1: book_list(books); break; case 2: book_search(books); break;
            case 3: loan_borrow(books, loans, user, BOOK_FILE, LOAN_FILE); break;
            case 4: {
                int returned_before = user->returned_books;
                loan_return(books, loans, users, user, BOOK_FILE, LOAN_FILE, USER_FILE);
                bgm_update_for_progress(user->returned_books);
                if (returned_before < 25 && user->returned_books >= 25) {
                    ending_sequence();
                }
                break;
            }
            case 5: loan_list_for_user(loans, books, user); break; case 6: relationship_status(user); break;
            case 0: bgm_update_for_progress(0); return;
            default: printf("无效选项，请重新选择。\n");
        }
    }
}

static void login_page(BookStore *books, UserStore *users, LoanStore *loans) {
    int choice;
    while (1) {
        printf("\n========== 图书馆大厅 ==========\n");
        printf("             _____________\n");
        printf("            |  书  架  1  |\n");
        printf("            |[书][书][书] |\n");
        printf("            |[书][书][书] |\n");
        printf("            |-------------|\n");
        printf("            |  书  架  2  |\n");
        printf("            |[书][书][书] |\n");
        printf("            |[书][书][书] |\n");
        printf("            |_____________|\n\n");
        printf("      (｡･ω･｡)ﾉ  欢迎来到藏书区\n");
        printf("1. 登录\n0. 返回首页\n");
        choice = read_int("请选择: ");
        if (choice == 0) return;
        if (choice != 1) { printf("无效选项，请重新选择。\n"); continue; }
        User *user = login(users);
        if (user == NULL) printf("账号或密码错误。\n");
        else if (user->is_admin) { printf("登录成功，欢迎管理员 %s。\n", user->name); run_admin(books, users, loans); }
        else { printf("登录成功，欢迎 %s。\n", user->name); run_user(user, books, users, loans); }
    }
}

int main(void) {
    BookStore books; UserStore users; LoanStore loans; int choice;
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8); SetConsoleCP(CP_UTF8);
#endif
    book_store_init(&books); user_store_init(&users); loan_store_init(&loans);
    book_load(&books, BOOK_FILE); user_load(&users, USER_FILE); loan_load(&loans, LOAN_FILE);
    bgm_start();
    printf("已加载 %d 本图书、%d 个用户和 %d 条借阅记录。\n", books.count, users.count, loans.count);
    while (1) {
        welcome_page();
        printf("1. 进入图书馆\n2. 查看攻略说明\n0. 离开图书馆\n");
        choice = read_int("请选择: ");
        if (choice == 0) break;
        if (choice == 1) login_page(&books, &users, &loans);
        else if (choice == 2) strategy_info();
        else printf("无效选项，请重新选择。\n");
    }
    bgm_stop();
    printf("系统已退出。\n"); return 0;
}
