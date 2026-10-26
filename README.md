# 心动图书馆

项目按版本分为两个独立目录，代码、素材、数据、测试和使用说明分别存放。

```text
程序设计plus/
├── web/                  # 网页版
│   ├── start-web.bat     # Windows 双击启动网页
│   ├── server.py         # Python 网页与登录服务
│   ├── public/           # HTML、CSS、JavaScript、书目与素材
│   ├── tests/            # 网页与登录服务测试
│   ├── local-data/       # 本机账号库，自动生成，不上传
│   └── README.md         # 网页版使用说明
├── console/              # C 终端版
│   ├── build.bat         # Windows 编译入口
│   ├── src/              # C 源码与头文件
│   ├── assets/           # 音乐与结局字符画
│   ├── books.txt         # 图书数据
│   ├── users.txt         # 用户数据
│   ├── loans.txt         # 借阅记录
│   ├── scripts/          # 构建脚本
│   ├── tests/            # 终端程序测试
│   ├── build/            # 编译产物，不上传
│   ├── Makefile          # GCC / Clang 构建配置
│   ├── CMakeLists.txt    # 通用构建配置
│   └── README.md         # 终端版使用说明
├── .github/              # 自动检查
├── .vscode/              # 编辑器编译与调试配置
├── AGENTS.md             # 项目维护规则
└── README.md             # 本页：两个版本的入口
```

## 打开网页版

安装 Python 3.8 或更新版本后，双击 **`web/start-web.bat`**。浏览器会自动打开 http://localhost:8001；保持启动窗口运行，按 Ctrl+C 停止。

也可以在项目根目录执行：

```powershell
python web/server.py --open
```

macOS / Linux 使用 `python3 web/server.py --open`。网页版无需编译 C，也无需安装第三方 Python 包。完整说明见 [网页版说明](web/README.md)。

## 编译运行终端版

在项目根目录的 Windows 终端执行：

```powershell
cd console
.\build.bat
.\build\library.exe
```

需要 GCC；本机已准备免安装工具链。同学可以安装 MinGW-w64 / w64devkit，或使用 CMake。完整说明见 [终端版说明](console/README.md)。

## 发给同学

推送源码后，同学拉取仓库即可按上述步骤运行。只使用某个版本时，可以完整复制对应的 `web/` 或 `console/` 目录；不要漏掉该目录中的素材、脚本和演示数据。编译器和 Python 需在各自电脑准备。

两个版本的账号、馆藏和借阅进度分别保存，不会同步。`build/`、`local-data/` 和缓存不纳入 Git；旧版本遗留的根目录 `build/` 也是本机临时文件，不影响这两个入口。
