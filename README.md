# 图书馆检索系统（C 语言模块化版）

这是一个适合大学程序设计课程小组作业的控制台程序，支持：

- 查看全部图书
- 按书名、作者或分类检索
- 管理员登录后添加、修改、删除图书
- 管理员添加和查看借阅者
- 借阅者登录后借阅、归还图书
- 保存借阅日期和借阅记录

## 文件分工

- `main.c`：登录和菜单流程
- `models.h`：公共数据结构和容量定义
- `book.c` / `book.h`：图书检索、增删改和保存
- `user.c` / `user.h`：用户登录和借阅者管理
- `loan.c` / `loan.h`：借阅、归还和借阅记录
- `utils.c` / `utils.h`：输入和通用字符串工具

## 编译运行

需要安装 GCC 或 MinGW。在项目目录执行：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic -Wshadow -Wformat=2 main.c book.c user.c loan.c utils.c -o library
./library
```

Windows PowerShell 下运行：

```powershell
gcc -std=c11 -Wall -Wextra -Wpedantic -Wshadow -Wformat=2 main.c book.c user.c loan.c utils.c -o library.exe -lwinmm
chcp 65001
.\library.exe
```

也可以使用 Makefile：

```bash
make
./library
```

程序启动时会读取当前目录的 `books.txt`、`users.txt` 和 `loans.txt`。文件使用 `|` 分隔字段，格式如下：

```text
图书编号|书名|作者|分类|出版年份|是否可借阅
用户编号|登录账号|登录密码|姓名|是否管理员
图书编号|用户编号|借阅者姓名|借阅日期
```

其中 `1` 表示可借阅、管理员或真，`0` 表示已借出、普通借阅者或假。不要在文本字段中输入 `|`。

## 初始账号

- 管理员：账号 `admin`，密码 `admin123`
- 借阅者：账号 `student`，密码 `student123`

## 小组分工建议

1. 一人负责 `book.c`：图书检索和管理员图书维护。
2. 一人负责 `user.c`：登录、用户和权限。
3. 一人负责 `loan.c`：借阅、归还和记录查询。
4. 一人负责 `main.c`、测试和项目文档。

## 网页演示版

项目另附一个无需安装依赖的浏览器演示界面，入口为 `web/index.html`。在项目根目录启动本地静态服务器：

```powershell
py -m http.server 8000 --directory web
```

然后访问 <http://localhost:8000>。网页包含馆藏检索、借阅与归还、管理员图书维护、读者档案和阅读进度；可点击右上角身份在管理员和读者演示模式间切换。

网页的馆藏初始数据位于 `web/books.json`，由 `books.txt` 转换而来。网页数据保存在当前浏览器的 `localStorage`，与 C 程序使用的文本文件互不写入或同步；需要重新开始演示时，可在浏览器开发者工具中清除本站点数据。

这是纯前端课程演示，不提供服务端身份验证或多用户共享。请勿直接部署到公网，也不要在其中存放真实用户或密码；正式使用需要增加服务端、身份验证和数据库。
