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

网页以「流川枫心动狙击战」欢迎页作为入口，包含攻略说明；点击「推开门，开始攻略」进入登录页并播放 BGM，登录后进入图书馆。读者总览的好感度下方展示角色图片，每成功归还 1 本图书好感度 +1，累计 25 本解锁特别结局。BGM 沿用原项目音频：0–4 本播放 `begin.mp3`、5–24 本播放 `middle.mp3`、25 本起播放 `ending.mp3`，可在右下角暂停或调节音量。侧栏的「攻略说明 / 回到入口」可重新查看说明。网页图片和音乐位于 `web/assets/`。

项目另附一个无需安装第三方依赖的浏览器演示界面。在项目根目录启动本地网页与登录服务：

```powershell
python server.py
```

然后访问 <http://localhost:8001>。欢迎页之后是登录页，读者和管理员均需填写姓名、学号和密码。首次使用可切换到「首次注册」创建读者账号；选择管理员身份可初始化首个管理员，创建后关闭管理员公开注册。后续请使用注册时的三项信息和对应身份登录。右上角可退出账号，更换身份需重新登录。旧的纯静态启动命令不支持登录。

账号由本机 Python 服务校验，密码以加盐 PBKDF2 哈希保存在 `local-data/accounts.sqlite3`，登录会话保存在 HttpOnly Cookie 中，8 小时过期。该目录不纳入 Git；请保留它以免丢失账号。服务仅监听本机地址。运行 `python -m unittest discover -s tests -v` 可检查注册、登录、身份验证和退出流程。

网页的馆藏初始数据位于 `web/books.json`，由 `books.txt` 转换而来。网页数据保存在当前浏览器的 `localStorage`，与 C 程序使用的文本文件互不写入或同步；需要重新开始演示时，可在浏览器开发者工具中清除本站点数据。

登录使用本地服务验证；馆藏、借阅和攻略进度仍保存在当前浏览器的 `localStorage` 中，属于课程演示，不提供跨设备同步或服务端借阅权限控制。
