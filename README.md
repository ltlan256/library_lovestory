# 图书馆检索系统（C 语言模块化版）

这是一个适合大学程序设计课程小组作业的控制台程序，支持：

- 查看全部图书
- 按书名、作者或分类检索
- 管理员登录后添加、修改、删除图书
- 管理员添加和查看借阅者
- 借阅者登录后借阅、归还图书
- 保存借阅日期和借阅记录

## 项目目录

```text
程序设计plus/
├── src/              # C 源码和头文件
├── assets/console/   # 控制台音乐和结局字符画
├── web/              # 网页代码、书目和网页素材
├── tests/            # 网页和登录服务测试
├── scripts/          # 可在其他电脑复用的构建脚本
├── build/            # 编译产物和临时文件，不纳入 Git
├── local-data/       # 网页账号数据库，不纳入 Git
├── .vscode/          # 编译和调试配置
├── books.txt         # C 程序图书数据
├── users.txt         # C 程序用户数据
├── loans.txt         # C 程序借阅记录
├── server.py         # 网页服务入口
├── Makefile          # C 程序编译入口
├── CMakeLists.txt    # Windows / Linux / macOS 通用构建配置
├── build.bat         # Windows 一键编译入口
└── README.md         # 使用说明
```

修改 C 功能看 `src/`，修改网页看 `web/`。三个 C 数据文件保留原位，继续使用已有数据。以下编译和运行命令均在项目根目录执行，以便读取数据及 `assets/console/` 素材。

### 源码分工（位于 src/）

- `main.c`：登录和菜单流程
- `models.h`：公共数据结构和容量定义
- `book.c` / `book.h`：图书检索、增删改和保存
- `user.c` / `user.h`：用户登录和借阅者管理
- `loan.c` / `loan.h`：借阅、归还和借阅记录
- `utils.c` / `utils.h`：输入和通用字符串工具

## 编译运行

### 发给同学后如何编译

请上传或打包整个源码项目，包含 `src/`、`assets/`、三个 `.txt` 数据文件及构建脚本。其他同学不需要你的电脑路径；编译器需要在各自电脑上安装。`build/`、本地账号数据库和编译器工具链无需上传。不要用个人账号数据替换仓库中的演示数据。

**Windows 推荐方式（GCC，无需安装 make 或 CMake）：**

1. 从 [w64devkit 官方发布页](https://github.com/skeeto/w64devkit/releases)下载适合电脑架构的工具链并解压，或使用已安装的 MinGW-w64。
2. 将工具链的 `bin` 目录加入 PATH，重新打开终端。在项目根目录执行：

```powershell
.\build.bat
.\build\library.exe
```

也可以双击 `build.bat` 编译。如果不想设置 PATH，可显式指定编译器（换成自己电脑的路径）：

```powershell
.\build.bat -Compiler "D:\w64devkit\bin\gcc.exe"
```

脚本会自动创建输出目录、编译全部 C 模块并链接 Windows 音乐库。VS Code 的 `Ctrl+Shift+B` 使用同一个脚本。每次运行程序都应从项目根目录执行上述运行命令。

**Linux / macOS：**安装 GCC 或 Clang 及 make（Ubuntu 可安装 `build-essential`；macOS 可执行 `xcode-select --install`），然后在项目根目录执行 `make`、`./build/library`。非 Windows 系统提供控制台功能，背景音乐仅在 Windows 播放。

**使用 Visual Studio / CMake 的同学：**安装 CMake 和 C 编译工具链。Windows 的 Visual Studio Installer 中需勾选“使用 C++ 的桌面开发”（含 Windows SDK）；只有 VS Code 编辑器还不能编译。项目支持 MSVC、GCC 和 Clang。在项目根目录执行：

```text
cmake -S . -B build/cmake
cmake --build build/cmake --config Release
```

Windows 运行 `.\build\cmake\library.exe`，Linux / macOS 运行 `./build/cmake/library`。切换编译器时使用新的构建目录。安装 Python 3 后，可执行 `ctest --test-dir build/cmake -C Release --output-on-failure` 进行启动、数据读取和退出检查；Python 不是 C 程序的编译依赖。

Windows 使用 GCC 配合 CMake 时，推荐使用 Ninja（w64devkit 已附带），尤其项目路径含中文时，避免使用 `MinGW Makefiles` 生成器：

```powershell
cmake -S . -B build/cmake-gcc -G Ninja -DCMAKE_C_COMPILER=gcc
cmake --build build/cmake-gcc
ctest --test-dir build/cmake-gcc --output-on-failure
```

仓库附有 GitHub Actions 配置，上传到 GitHub 后会分别在 Windows、Linux、macOS 上自动构建和检查。是否通过以 Actions 实际结果为准。

### 手动使用 GCC / Makefile

需要安装 GCC 或 MinGW。在项目目录执行：

```bash
mkdir -p build
gcc -std=c11 -Wall -Wextra -Wpedantic -Wshadow -Wformat=2 src/main.c src/book.c src/user.c src/loan.c src/utils.c -o build/library
./build/library
```

Windows PowerShell 下运行：

```powershell
New-Item -ItemType Directory -Force build | Out-Null
gcc -std=c11 -Wall -Wextra -Wpedantic -Wshadow -Wformat=2 src/main.c src/book.c src/user.c src/loan.c src/utils.c -o build/library.exe -lwinmm
chcp 65001
.\build\library.exe
```

也可以使用 Makefile（产物输出到 `build/`）。VS Code 中按 `Ctrl+Shift+B` 编译，按 `F5` 调试：

```bash
make
./build/library
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

网页开场名称为「图书馆心动大作战」，第一步选择攻略对象，再查看角色欢迎页和攻略说明，之后登录进入图书馆。流川枫路线为粉色主题，奶龙路线为奶油黄色主题，两条路线共用登录、馆藏、搜索和借阅确认功能。奶龙使用用户提供的图片，角色图片显示在好感度下方。侧栏的「切换攻略对象」可重新选择；角色链接分别为 `http://localhost:8001/?character=rukawa` 与 `http://localhost:8001/?character=nailong`。

流川枫路线点击「推开门，开始攻略」后，先展示体育馆初遇的开场剧情，配角色图片和开场 BGM；点击「让他记住我，开始攻略」后进入登录页，已登录则直接进入图书馆。剧情页可返回欢迎页重看。

奶龙路线分三段剧情：开场「它只是，想被认真对待」讲述奶蛙形态被做成梗图后的委屈与戒备；累计归还第 5 本时触发「它开始，愿意相信你」，第二段结束于“对你的信任一点点多了起来”；好感度达到 25 点触发「这个模样，只给你看」，第三段从“奶龙始终不愿意在其他人面前露出奶蛙形态”开始。两段阶段事件分别按读者保存已读状态；已有进度会依次补看中期、后期剧情，奶龙页面保留黄色主题。

流川枫路线累计归还第 5 本图书时，自动弹出「原来，他记得你」剧情，故事中的姓名使用当前登录读者的姓名。读完继续或按 Esc 关闭后，按读者保存已读状态，刷新、切换页面或再次达到门槛不会重复弹出。已有归还进度达到门槛的读者也会在进入流川枫图书馆时触发；奶龙路线和管理员不触发。剧情门槛按归还本数计算，逾期扣分不抹除已达成的归还次数。好感度达到 25 点时，先补看中期剧情，再进入流川枫特别结局「目光相遇，心意终于说出口」：第一页为告白剧情，点击「看看他的回应」后切换到结局图片页，显示「恭喜你，可以跟流川枫一起打篮球了」；离开结局页后按读者保存已读状态，刷新不会重复弹出。结局图片位于 `web/assets/rukawa-ending.jpg`。

总览和「攻略进度」里的角色图片均可点击，默认重看最新解锁的剧情；图片下方也可选择重看初遇、中期或结局。两条角色路线都支持，已看过的剧情在逾期扣分后仍可重温，未解锁剧情不可提前查看。重看不会改变库存、好感度或归还次数；从攻略进度重看开场后继续，会返回攻略进度页。

每成功归还 1 本图书，对应角色的好感度 +1，好感度达到 25 点解锁该角色的特别结局。两位角色的进度分别保存，归还时计入借阅时选择的角色；旧版进度保留为流川枫路线的进度。BGM 沿用原项目音频：0–4 点播放 `begin.mp3`、5–24 点播放 `middle.mp3`、25 点起播放 `ending.mp3`，可在右下角暂停或调节音量。侧栏的「攻略说明 / 回到入口」可重新查看说明。网页图片和音乐位于 `web/assets/`。

借阅规则：每位读者最多同时借阅 10 本，两个角色路线合并计数；借期为借阅日期加 30 个自然日，到期当天归还不逾期，次日开始每本每天扣 1 点借阅时对应角色的好感度。页面显示当前扣分，归还时将逾期天数存入历史，此后该书停止累计；刷新和重复归还不会重复扣分。当前好感度为本角色累计归还次数减去在借及历史逾期扣分，最低显示为 0；好感度达到 25 点才解锁结局，BGM 阶段也按扣分后的好感度切换。旧版在借记录按原借阅日期补算 30 天期限，旧版已归还历史不追溯扣分。

项目另附一个无需安装第三方依赖的浏览器演示界面。在项目根目录启动本地网页与登录服务：

```powershell
python server.py
```

然后访问 <http://localhost:8001>。欢迎页之后是登录页，读者和管理员均需填写姓名、学号和密码。首次使用可切换到「首次注册」创建读者账号；选择管理员身份可初始化首个管理员，创建后关闭管理员公开注册。后续请使用注册时的三项信息和对应身份登录。右上角可退出账号，更换身份需重新登录。旧的纯静态启动命令不支持登录。

账号由本机 Python 服务校验，密码以加盐 PBKDF2 哈希保存在 `local-data/accounts.sqlite3`，登录会话保存在 HttpOnly Cookie 中，8 小时过期。该目录不纳入 Git；请保留它以免丢失账号。服务仅监听本机地址。运行 `python -m unittest discover -s tests -v` 可检查注册、登录、身份验证和退出流程。

登录与注册均校验输入：姓名为文字，可用空格、间隔号、短横线或撇号连接，不接受数字和表情；学号为 1–32 位纯数字，保留开头的 0；密码为 6–128 位，可包含数字、字母或符号。读者和管理员执行相同规则，网页字段旁会显示要求，服务端也会再次校验。

流川枫路线壁纸使用用户提供的粉色花朵与草莓图片 `web/assets/rukawa-wallpaper.jpg`，奶龙路线使用黄色花朵图片 `web/assets/nailong-wallpaper.jpeg`。背景覆盖欢迎、剧情、登录与馆内页面，表单和卡片保留浅色底以便阅读，角色头像保持原图。

网页的馆藏初始数据位于 `web/books.json`，在原 `books.txt` 的 100 种图书基础上扩充。网页数据保存在当前浏览器的 `localStorage`，与 C 程序使用的文本文件互不写入或同步；需要重新开始演示时，可在浏览器开发者工具中清除本站点数据。

网页初始馆藏现有 250 种图书，每种随机分配 1–3 本，总量在书目文件中固定，刷新不会重新随机。列表显示可借数量与总数量，借出扣减、归还恢复；同一读者同一种书同时限借 1 本。旧版浏览器数据会自动补充新增书目并保留借阅、读者和好感度进度。管理员可设置每种书的数量（1–3 本，不能少于已借出的数量）。新增书目未指定版本的出版年份显示为「—」。

网页名称为「心动图书馆」。总览的馆藏、当前可借、在借记录和累计归还卡片均可点击进入相应页面（管理员第四张卡片进入读者档案）。可从总览搜索栏或馆藏页搜索图书；点击「借阅」后，核对图书、借阅人、数量和日期，勾选确认并点击「确认借阅 1 本」才会扣减库存。取消或按 Esc 关闭均不会产生借阅；成功后可继续搜书或查看我的借阅。

登录使用本地服务验证；馆藏、借阅和攻略进度仍保存在当前浏览器的 `localStorage` 中，属于课程演示，不提供跨设备同步或服务端借阅权限控制。

「借阅管理 / 我的借阅」提供可点击的「当前在借」和「历史记录」入口。成功归还后自动保存书名、作者、借阅人、借阅日期、归还日期及攻略角色；读者仅查看自己的记录，管理员可查看当前浏览器中的全部记录。历史按最近归还优先显示，刷新后保留，图书被修改或删除后仍保留当时的书名和作者。历史记录从此功能启用后开始保存，旧版已归还记录无法还原，原有累计归还和好感度不受影响。
