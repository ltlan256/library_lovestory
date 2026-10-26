# C 终端版

本目录包含完整的 C 程序，可以单独复制给同学编译。与 `../web/` 网页版的数据分别保存。

## Windows 编译运行

在本目录打开终端：

```powershell
.\build.bat
.\build\library.exe
```

需要 GCC。可从 [w64devkit 官方发布页](https://github.com/skeeto/w64devkit/releases)下载工具链并解压，将 `bin` 加入 PATH，或直接指定编译器：

```powershell
.\build.bat -Compiler "D:\w64devkit\bin\gcc.exe"
```

本机的免安装编译器保存在 `build/tools/w64devkit/`，脚本可以自动找到它；该工具链不上传。同学需要自行安装编译器。Windows 脚本不需要 make 或 CMake。始终从本目录运行程序，以读取数据与素材。

## Linux / macOS

准备 GCC 或 Clang 及 make 后，在本目录执行：

```bash
make
./build/library
```

Windows 也可以使用 make。背景音乐仅在 Windows 播放。

## CMake 构建

支持 MSVC、GCC 和 Clang。Windows 的 Visual Studio 需安装“使用 C++ 的桌面开发”和 Windows SDK；VS Code 编辑器本身不含编译器。在本目录执行：

```text
cmake -S . -B build/cmake
cmake --build build/cmake --config Release
```

Windows 运行 `.\build\cmake\library.exe`；Linux / macOS 运行 `./build/cmake/library`。Windows 使用 GCC，尤其目录含中文时，推荐 Ninja（w64devkit 已附带），避免使用 MinGW Makefiles 生成器：

```text
cmake -S . -B build/cmake-gcc -G Ninja -DCMAKE_C_COMPILER=gcc
cmake --build build/cmake-gcc
```

切换编译器或移动项目目录后，使用新的 CMake 构建目录。

## 文件分类

- `src/main.c`：登录、菜单与剧情流程。
- `src/book.c` / `book.h`：图书管理。
- `src/user.c` / `user.h`：用户管理。
- `src/loan.c` / `loan.h`：借阅和归还。
- `src/models.h`、`utils.c` / `utils.h`：数据结构和工具函数。
- `assets/`：三段背景音乐和结局字符画。
- `books.txt`、`users.txt`、`loans.txt`：图书、用户和借阅数据，保留现有内容。
- `scripts/`、`Makefile`、`CMakeLists.txt`：构建配置。
- `tests/`：启动与数据读取测试。
- `build/`：可执行程序、对象文件及本机工具链，不上传。

## 测试

安装 Python 3 后，在本目录执行 `python tests/test_console.py build/library.exe`。CMake 构建后也可执行 `ctest --test-dir build/cmake -C Release --output-on-failure`。测试使用临时副本，不改写原有数据。Python 不是编译 C 程序的依赖。
