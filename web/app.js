const STORAGE_KEY = "shiye-library-web-v1";
const CATALOG_VERSION = 2;
const DEMO_BOOKS = [
  { id: 1, title: "小王子", author: "安东尼·德·圣埃克苏佩里", category: "童话", year: 2018, available: true },
  { id: 2, title: "百年孤独", author: "加西亚·马尔克斯", category: "文学", year: 2011, available: false },
  { id: 3, title: "人类简史", author: "尤瓦尔·赫拉利", category: "历史", year: 2020, available: true },
  { id: 4, title: "C程序设计语言", author: "Brian Kernighan", category: "编程", year: 2016, available: true },
  { id: 5, title: "挪威的森林", author: "村上春树", category: "文学", year: 2016, available: true },
  { id: 6, title: "三体", author: "刘慈欣", category: "科幻", year: 2018, available: true },
  { id: 7, title: "时间简史", author: "史蒂芬·霍金", category: "自然科学", year: 2015, available: true },
  { id: 8, title: "围城", author: "钱钟书", category: "文学", year: 2017, available: true }
];
const DEMO_USERS = [
  { id: 1, username: "admin", name: "系统管理员", isAdmin: true, returnedBooks: 0 },
  { id: 2, username: "student", name: "张三", isAdmin: false, returnedBooks: 0 }
];

const state = {
  books: [],
  users: [],
  loans: [],
  activeUserId: 2,
  page: "dashboard",
  query: "",
  category: "全部分类",
  availability: "全部状态",
  editingBookId: null,
  catalogVersion: undefined,
  toastTimer: null
};
let authenticated = false;
let registering = false;
let adminSetupAvailable = false;
let pendingBorrowBookId = null;

const content = document.querySelector("#page-content");
const dialog = document.querySelector("#edit-dialog");
const form = document.querySelector("#edit-form");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function parseBooks(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [id, title, author, category, year, available] = line.split("|");
    return { id: Number(id), title, author, category, year: Number(year), available: available === "1" };
  });
}

async function initialize() {
  let catalog;
  try {
    const response = await fetch("books.json");
    if (!response.ok) throw new Error("读取书目失败");
    catalog = await response.json();
  } catch (error) {
    showNotice("未能读取完整馆藏，暂时使用本地数据。请检查网页服务后刷新。");
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      state.books = data.books;
      state.users = data.users;
      state.loans = data.loans;
      state.activeUserId = data.activeUserId ?? 2;
      if (catalog && data.catalogVersion !== CATALOG_VERSION) {
        const titles = new Set(state.books.map((book) => book.title));
        const ids = new Set(state.books.map((book) => book.id));
        let nextId = Math.max(250, ...ids) + 1;
        for (const book of catalog.filter((item) => item.id > 100)) {
          if (titles.has(book.title)) continue;
          const id = ids.has(book.id) ? nextId++ : book.id;
          state.books.push({ ...book, id });
          titles.add(book.title);
          ids.add(id);
        }
      }
      normalizeInventory(catalog);
      state.catalogVersion = catalog ? CATALOG_VERSION : data.catalogVersion;
      persist();
      render();
      return;
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      showNotice("本地保存的数据无法读取，已重新从项目文本文件初始化。");
    }
  }

  try {
    if (!catalog) throw new Error("完整馆藏不可用");
    state.books = catalog.map((book) => ({ ...book }));
    state.users = DEMO_USERS.map((user) => ({ ...user }));
    state.loans = [];
    normalizeInventory(catalog);
    state.catalogVersion = CATALOG_VERSION;
    persist();
  } catch (error) {
    state.books = DEMO_BOOKS.map((book) => ({ ...book }));
    state.users = DEMO_USERS.map((user) => ({ ...user }));
    state.loans = [{ bookId: 2, userId: 2, borrower: "张三", date: "2026-10-18" }];
    normalizeInventory();
    showNotice("未能读取书目文件，当前使用内置示例数据。请通过本地 HTTP 服务打开网页以加载完整馆藏。");
  }
  render();
}

function normalizeInventory(catalog = []) {
  for (const book of state.books) {
    const seed = catalog?.find((item) => item.title === book.title);
    const quantity = book.quantity ?? seed?.quantity ?? (1 + Math.floor(Math.random() * 3));
    book.quantity = Math.max(1, Math.min(3, Number.isInteger(quantity) ? quantity : 1));
    // Existing loans must remain returnable even if old data exceeds the new stock limit.
    book.available = availableCopies(book) > 0;
  }
}

function availableCopies(book) {
  return Math.max(0, book.quantity - state.loans.filter((loan) => loan.bookId === book.id).length);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    books: state.books, users: state.users, loans: state.loans, activeUserId: state.activeUserId,
    catalogVersion: state.catalogVersion
  }));
}

function currentUser() {
  return state.users.find((user) => user.id === state.activeUserId) ?? state.users[0] ?? DEMO_USERS[1];
}

function isAdmin() {
  return Boolean(currentUser().isAdmin);
}

function showNotice(message) {
  const notice = document.querySelector("#notice");
  notice.textContent = message;
  notice.hidden = false;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function categoryClass(index) {
  return `c${(index % 4) + 1}`;
}

function coverMarkup(book, index) {
  const initial = Array.from(book.title)[0] ?? "书";
  return `<span class="book-cover ${categoryClass(index)}" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

function bookRows(books, options = {}) {
  if (!books.length) return `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⌕</div><strong>没有找到匹配的图书</strong><span>换个关键词试试看吧。</span></div></td></tr>`;
  return books.map((book, index) => {
    const controls = isAdmin()
      ? `<button class="text-button" data-action="edit-book" data-id="${book.id}">编辑</button>
         <button class="text-button" data-action="delete-book" data-id="${book.id}">删除</button>`
      : state.loans.some((loan) => loan.bookId === book.id && loan.userId === currentUser().id)
        ? `<button class="button button-quiet button-small" data-action="return" data-id="${book.id}">归还</button>`
        : availableCopies(book) > 0
        ? `<button class="button button-primary button-small" data-action="borrow" data-id="${book.id}">借阅</button>`
        : `<button class="button button-quiet button-small" disabled>已借完</button>`;
    const actionMarkup = options.showActions === false ? "" : `<td><div class="row-actions">${controls}</div></td>`;
    return `<tr>
      <td><div class="book-cell">${coverMarkup(book, index)}<div><div class="book-title">${escapeHtml(book.title)}</div><div class="book-author">${escapeHtml(book.author)}</div></div></div></td>
      <td><span class="category-tag">${escapeHtml(book.category)}</span></td>
      <td>${book.year || "—"}</td>
      <td><span class="status-tag ${availableCopies(book) > 0 ? "available" : "borrowed"}">${availableCopies(book) > 0 ? "在馆" : "已借完"} · ${availableCopies(book)} / ${book.quantity} 本</span></td>
      ${isAdmin() ? `<td>${escapeHtml(state.loans.filter((loan) => loan.bookId === book.id).map((loan) => loan.borrower).join("、") || "—")}</td>` : ""}
      ${actionMarkup}
    </tr>`;
  }).join("");
}

function tableMarkup(books, options = {}) {
  const showActions = options.showActions !== false;
  const adminHeader = isAdmin() ? "<th>借阅人</th>" : "";
  const actionHeader = showActions ? "<th>操作</th>" : "";
  return `<div class="table-wrap"><table class="catalog-table">
    <thead><tr><th>书名 / 作者</th><th>分类</th><th>出版年份</th><th>馆藏状态</th>${adminHeader}${actionHeader}</tr></thead>
    <tbody>${bookRows(books, options)}</tbody>
  </table></div>`;
}

function progressMarkup(user) {
  const returned = user.returnedBooks ?? 0;
  const percent = Math.min(100, Math.round(returned / 25 * 100));
  return `<section class="panel progress-panel">
    <div class="progress-top"><h2>流川枫心动狙击战</h2><span class="spark">♡</span></div>
    <p class="progress-lead">借一本书，靠近他一点。每成功归还 1 本，好感度 +1；累计 25 本，解锁心动结局。</p>
    <div class="heart-line"><span>流川枫好感度</span><strong>${returned} / 25 本</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <div class="milestone-row"><span>开始阅读</span><span>25 次 · 特别结局</span></div>
    <figure class="character-portrait">
      <img src="assets/rukawa.png" alt="流川枫的黑白漫画肖像" width="981" height="983">
      <figcaption><span>攻略对象 · 流川枫</span><b>♡ ${returned >= 25 ? "心动已被你击中" : returned > 4 ? "目光开始为你停留" : "故事从初遇开始"}</b></figcaption>
    </figure>
    <div class="progress-quote">${returned >= 25 ? "恭喜达成目标！新的故事，正等着你们一起开启。 ✨" : `已完成 <strong>${returned}</strong> 次归还，再读 ${Math.max(0, 25 - returned)} 本，就能抵达下一段故事。`}</div>
    <div class="quick-actions"><button class="button button-primary" data-page="catalog">去挑一本书 <span>→</span></button><button class="button button-quiet" data-page="loans">我的借阅</button></div>
  </section>`;
}

function statCard(label, value, foot, icon, page, availability = "") {
  return `<a class="stat-card" href="#${page}" data-page="${page}" data-availability="${availability}"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div><span class="stat-link">点击查看 →</span></a>`;
}

function dashboardPage() {
  const user = currentUser();
  const borrowed = state.loans.length;
  const totalCopies = state.books.reduce((total, book) => total + book.quantity, 0);
  const remainingCopies = state.books.reduce((total, book) => total + availableCopies(book), 0);
  const onLoan = isAdmin() ? state.loans.length : state.loans.filter((loan) => loan.userId === user.id).length;
  const returned = user.returnedBooks ?? 0;
  const latest = [...state.books].sort((a, b) => b.id - a.id).slice(0, 5);
  const stats = `<div class="stats-grid">
    ${statCard("馆藏种类", state.books.length, `共 <strong>${totalCopies}</strong> 本 · 每种 1–3 本`, "▤", "catalog", "全部状态")}
    ${statCard("当前可借 / 本", remainingCopies, "查看当前有库存的图书", "⌕", "catalog", "在馆")}
    ${statCard(isAdmin() ? "借阅记录" : "我的在借", onLoan, isAdmin() ? "所有读者的在借记录" : "查看在借图书并归还", "↗", "loans")}
    ${statCard(isAdmin() ? "读者人数" : "累计归还", isAdmin() ? state.users.filter((item) => !item.isAdmin).length : returned, isAdmin() ? "查看读者档案" : "查看好感度与攻略进度", "♧", isAdmin() ? "readers" : "progress")}
  </div>`;
  const latestPanel = `<section class="panel">
    <div class="panel-head"><div><h2>新近入藏</h2><p>也许下一本心头好，就在这里</p></div><button class="text-button" data-page="catalog">查看全部 →</button></div>
    ${tableMarkup(latest, { showActions: false })}
  </section>`;
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">A GOOD DAY TO READ</div><h1>${isAdmin() ? "你好，管理员。" : `你好，${escapeHtml(user.name)}。`}</h1><p class="subheading">${isAdmin() ? "今天也来看看，书架与读者们有什么新故事。" : "今天想读点什么？你喜欢的故事，可能就在下一页。"}</p></div><div class="date-tag"><span>✳</span>${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())}</div></div>
    ${stats}
    <section class="panel search-entry"><div><h2>想借什么？先搜一下</h2><p>搜索书名、作者或分类，找到后核对信息再确认借阅。</p></div><form id="catalog-search-form" class="toolbar-left"><label class="search-box"><span class="sr-only">搜索图书</span><input id="book-search" type="search" placeholder="输入书名、作者或分类" value="${escapeHtml(state.query)}"></label><button class="button button-primary" type="submit">搜索图书 →</button></form></section>
    <div class="dashboard-grid">${latestPanel}${!isAdmin() ? progressMarkup(user) : adminActivityPanel(borrowed)}</div>`;
}

function adminActivityPanel(borrowedCount) {
  const recent = [...state.loans].reverse().slice(0, 4);
  const items = recent.length ? recent.map((loan) => {
    const book = state.books.find((item) => item.id === loan.bookId);
    return `<div class="loan-card"><div class="loan-meta"><span class="book-cover c2">阅</span><div class="loan-details"><strong>${escapeHtml(book?.title ?? "图书已删除")}</strong><small>${escapeHtml(loan.borrower)} · ${escapeHtml(loan.date)}</small></div></div><span class="status-tag borrowed">借阅中</span></div>`;
  }).join("") : `<div class="empty-state"><div class="empty-icon">↗</div><strong>还没有借阅记录</strong><span>读者借阅后，记录会显示在这里。</span></div>`;
  return `<section class="panel"><div class="panel-head"><div><h2>最近借阅</h2><p>当前 ${borrowedCount} 本书正在读者手中</p></div><button class="text-button" data-page="loans">全部记录 →</button></div><div class="loan-card-list">${items}</div></section>`;
}

function filteredBooks() {
  const query = state.query.trim().toLocaleLowerCase();
  return state.books.filter((book) => {
    const matchesQuery = !query || [book.title, book.author, book.category, String(book.id)].some((value) => String(value).toLocaleLowerCase().includes(query));
    const matchesCategory = state.category === "全部分类" || book.category === state.category;
    const matchesStatus = state.availability === "全部状态" || (state.availability === "在馆" ? availableCopies(book) > 0 : state.loans.some((loan) => loan.bookId === book.id));
    return matchesQuery && matchesCategory && matchesStatus;
  }).sort((a, b) => a.id - b.id);
}

function catalogPage() {
  const categories = ["全部分类", ...new Set(state.books.map((book) => book.category).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN")))];
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">THE COLLECTION</div><h1>馆藏图书</h1><p class="subheading">在 ${state.books.length} 种藏书里，找到此刻想读的那一本。</p></div>${isAdmin() ? '<button class="button button-primary" data-action="add-book">＋ 添加图书</button>' : ""}</div>
    <section class="panel"><div class="panel-head"><div><h2>所有图书</h2><p>按书名、作者或分类检索</p></div></div>
    <p class="borrow-steps">① 搜索图书 <span>→</span> ② 点击借阅 <span>→</span> ③ 核对并确认 <span>→</span> ④ 借阅成功</p>
    <div class="toolbar" style="padding:0 20px"><form id="catalog-search-form" class="toolbar-left"><label class="search-box"><span class="sr-only">搜索书名、作者或分类</span><input id="book-search" type="search" placeholder="搜索书名、作者或分类…" value="${escapeHtml(state.query)}"></label><button class="button button-primary" type="submit">搜索</button><select id="category-filter" class="select-control" aria-label="分类筛选">${categories.map((item) => `<option ${state.category === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select><select id="status-filter" class="select-control" aria-label="状态筛选">${["全部状态", "在馆", "借出中"].map((item) => `<option ${state.availability === item ? "selected" : ""}>${item}</option>`).join("")}</select></form><span class="result-count" id="result-count">${filteredBooks().length} 种图书</span></div>
    <div id="catalog-results">${tableMarkup(filteredBooks())}</div></section>`;
}

function loansPage() {
  const loans = isAdmin() ? state.loans : state.loans.filter((loan) => loan.userId === currentUser().id);
  const heading = isAdmin() ? "借阅管理" : "我的借阅";
  const cards = loans.length ? [...loans].reverse().map((loan) => {
    const book = state.books.find((item) => item.id === loan.bookId);
    const canReturn = isAdmin() || loan.userId === currentUser().id;
    return `<article class="loan-card"><div class="loan-meta">${coverMarkup(book ?? { title: "书" }, loan.bookId)}<div class="loan-details"><strong>${escapeHtml(book?.title ?? "图书已删除")}</strong><small>${escapeHtml(book?.author ?? "")}${isAdmin() ? ` · 借阅人：${escapeHtml(loan.borrower)}` : ""}</small></div></div><div class="row-actions"><span class="loan-date">借于 ${escapeHtml(loan.date)}</span>${canReturn && !isAdmin() ? `<button class="button button-quiet button-small" data-action="return" data-id="${loan.bookId}">归还</button>` : ""}</div></article>`;
  }).join("") : `<div class="empty-state"><div class="empty-icon">↗</div><strong>这里还空着</strong><span>${isAdmin() ? "目前没有正在借阅的图书。" : "去书架挑一本喜欢的书，开启新的阅读吧。"}</span>${!isAdmin() ? '<p><button class="button button-primary" data-page="catalog">浏览图书 →</button></p>' : ""}</div>`;
  const header = isAdmin() ? `<div class="panel-head"><div><h2>全部在借记录</h2><p>${loans.length} 条正在进行的借阅</p></div></div>` : "";
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">BORROWING HISTORY</div><h1>${heading}</h1><p class="subheading">${isAdmin() ? "查看读者借阅状态，及时完成图书归还管理。" : "正在读的书和每一次借阅，都收录在这里。"}</p></div></div><section class="panel">${header}<div class="loan-card-list">${cards}</div></section>`;
}

function readersPage() {
  const readers = state.users.filter((user) => !user.isAdmin);
  const cards = readers.map((user, index) => {
    const activeLoans = state.loans.filter((loan) => loan.userId === user.id).length;
    return `<article class="reader-card"><div class="reader-card-head"><span class="avatar">${escapeHtml(Array.from(user.name)[0] ?? "读")}</span><div><strong>${escapeHtml(user.name)}</strong><small>@${escapeHtml(user.username)}</small></div></div><div class="reader-stats"><span>当前在借 <strong>${activeLoans}</strong> 本</span><span>累计归还 <strong>${user.returnedBooks ?? 0}</strong> 次</span></div></article>`;
  }).join("");
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">READER COMMUNITY</div><h1>读者档案</h1><p class="subheading">与 ${readers.length} 位读者一起分享阅读。</p></div><button class="button button-primary" data-action="add-reader">＋ 添加读者</button></div><section class="panel"><div class="panel-head"><div><h2>读者列表</h2><p>读者信息保存在当前浏览器的演示数据中</p></div></div><div class="reader-grid">${cards || '<div class="empty-state"><strong>还没有读者</strong><span>添加一位读者，开始使用借阅功能。</span></div>'}</div></section>`;
}

function render() {
  if (!authenticated) return;
  updateMusicStage();
  const user = currentUser();
  document.querySelector("#user-name").textContent = user.name;
  document.querySelector("#user-avatar").textContent = Array.from(user.name)[0] ?? "读";
  document.querySelector("#user-role").textContent = isAdmin() ? "管理员 · 点击退出" : "读者 · 点击退出";
  document.querySelectorAll(".admin-only").forEach((item) => item.classList.toggle("hidden", !isAdmin()));
  const pageLabels = { dashboard: "总览", catalog: "馆藏图书", loans: isAdmin() ? "借阅管理" : "我的借阅", readers: "读者档案", progress: "攻略进度" };
  if (state.page === "readers" && !isAdmin()) state.page = "dashboard";
  document.querySelector("#page-title").textContent = pageLabels[state.page];
  document.querySelectorAll("[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === state.page && item.classList.contains("nav-link")));
  if (state.page === "catalog") catalogPage();
  else if (state.page === "loans") loansPage();
  else if (state.page === "readers") readersPage();
  else if (state.page === "progress") content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">YOUR STORY</div><h1>你的心动攻略进度</h1><p class="subheading">每成功归还 1 本，好感度 +1。累计归还 25 本，解锁特别结局。</p></div><button class="button button-quiet" data-page="dashboard">返回总览</button></div><div class="progress-detail">${progressMarkup(user)}</div>`;
  else dashboardPage();
}

function navigate(page) {
  if (!authenticated) return showLogin();
  state.page = page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openBookDialog(book = null) {
  state.editingBookId = book?.id ?? null;
  document.querySelector("#dialog-title").textContent = book ? "编辑图书" : "添加图书";
  document.querySelector("#dialog-fields").innerHTML = `
    <div class="form-field"><label for="book-title">书名</label><input class="form-control" id="book-title" name="title" required maxlength="120" value="${escapeHtml(book?.title ?? "")}"></div>
    <div class="form-field"><label for="book-author">作者</label><input class="form-control" id="book-author" name="author" required maxlength="120" value="${escapeHtml(book?.author ?? "")}"></div>
    <div class="form-field"><label for="book-category">分类</label><input class="form-control" id="book-category" name="category" required maxlength="40" value="${escapeHtml(book?.category ?? "")}"></div>
    <div class="form-field"><label for="book-year">出版年份</label><input class="form-control" id="book-year" name="year" type="number" min="0" max="9999" required value="${book?.year ?? new Date().getFullYear()}"></div>
    <div class="form-field"><label for="book-quantity">馆藏数量（1–3 本）</label><input class="form-control" id="book-quantity" name="quantity" type="number" min="1" max="3" required value="${book?.quantity ?? (1 + Math.floor(Math.random() * 3))}"></div>`;
  dialog.showModal();
  document.querySelector("#book-title").focus();
}

function openReaderDialog() {
  document.querySelector("#dialog-title").textContent = "添加读者";
  document.querySelector("#dialog-fields").innerHTML = `
    <div class="form-field full"><label for="reader-name">读者姓名</label><input class="form-control" id="reader-name" name="name" required maxlength="80" placeholder="输入读者姓名"></div>`;
  state.editingBookId = null;
  dialog.showModal();
  document.querySelector("#reader-name").focus();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button, a");
  if (!button) return;
  if (button.dataset.page) {
    event.preventDefault();
    if (button.dataset.availability) {
      state.query = "";
      state.category = "全部分类";
      state.availability = button.dataset.availability;
    }
    navigate(button.dataset.page);
    return;
  }
  const action = button.dataset.action;
  if (action && !authenticated) return;
  if (["add-book", "edit-book", "delete-book", "add-reader"].includes(action) && !isAdmin()) return;
  const id = Number(button.dataset.id);
  if (button.matches("[data-close-dialog]")) dialog.close();
  else if (action === "add-book") openBookDialog();
  else if (action === "edit-book") openBookDialog(state.books.find((book) => book.id === id));
  else if (action === "delete-book") {
    const hasLoan = state.loans.some((loan) => loan.bookId === id);
    if (hasLoan) return showToast("这本书仍有未归还记录，暂时不能删除。");
    const book = state.books.find((item) => item.id === id);
    if (book && window.confirm(`确定删除《${book.title}》吗？`)) {
      state.books = state.books.filter((item) => item.id !== id);
      persist(); render(); showToast("图书已删除。");
    }
  } else if (action === "add-reader") openReaderDialog();
  else if (action === "borrow") openBorrowDialog(id);
  else if (action === "cancel-borrow" || action === "continue-search") {
    document.querySelector("#borrow-dialog").close();
    document.querySelector("#book-search")?.focus();
  }
  else if (action === "view-borrowed") {
    document.querySelector("#borrow-dialog").close();
    navigate("loans");
  }
  else if (action === "return") returnBook(id);
});

document.querySelector("#role-switch").addEventListener("click", async () => {
  try {
    await authRequest("/api/logout", {});
    authenticated = false;
    content.innerHTML = "";
    showLogin();
    showToast("已退出，请重新登录。");
  } catch (error) { showToast(error.message); }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "book-search") return;
  state.query = event.target.value;
  refreshCatalogResults();
});
document.addEventListener("change", (event) => {
  if (event.target.id === "category-filter") state.category = event.target.value;
  if (event.target.id === "status-filter") state.availability = event.target.value;
  if (event.target.id === "category-filter" || event.target.id === "status-filter") refreshCatalogResults();
});

function refreshCatalogResults() {
  const results = document.querySelector("#catalog-results");
  if (!results) return;
  const books = filteredBooks();
  results.innerHTML = tableMarkup(books);
  document.querySelector("#result-count").textContent = `${books.length} 种图书`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!authenticated || !isAdmin()) return;
  const values = new FormData(form);
  if (values.has("name")) {
    const name = String(values.get("name")).trim();
    if (!name) return;
    const id = Math.max(0, ...state.users.map((user) => user.id)) + 1;
    state.users.push({ id, username: `reader${id}`, name, isAdmin: false, returnedBooks: 0 });
    persist(); dialog.close(); render(); showToast("读者档案已添加。");
    return;
  }
  const title = String(values.get("title")).trim();
  const author = String(values.get("author")).trim();
  const category = String(values.get("category")).trim();
  const year = Number(values.get("year"));
  const quantity = Number(values.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3) return showToast("馆藏数量必须为 1–3 本。");
  if (state.editingBookId && state.loans.filter((loan) => loan.bookId === state.editingBookId).length > quantity) return showToast("馆藏数量不能小于当前已借出的数量。");
  if (!title || !author || !category || !Number.isInteger(year) || year < 0 || year > 9999) {
    return showToast("请检查图书信息后再保存。");
  }
  if (state.books.some((book) => book.title === title && book.id !== state.editingBookId)) {
    return showToast("馆藏中已有同名图书，请确认后再添加。");
  }
  if (state.editingBookId) {
    const book = state.books.find((item) => item.id === state.editingBookId);
    Object.assign(book, { title, author, category, year, quantity });
    book.available = availableCopies(book) > 0;
  } else {
    const id = Math.max(0, ...state.books.map((book) => book.id)) + 1;
    state.books.push({ id, title, author, category, year, quantity, available: true });
  }
  persist(); dialog.close(); render(); showToast(state.editingBookId ? "图书信息已更新。" : "新书已加入馆藏。");
});

function borrowBook(bookId) {
  if (!authenticated || isAdmin()) return;
  const book = state.books.find((item) => item.id === bookId);
  if (!book || availableCopies(book) < 1) return showToast("这本书目前已借完。");
  const user = currentUser();
  if (state.loans.some((loan) => loan.bookId === bookId && loan.userId === user.id)) return showToast("你已借过这本书，请先归还后再借阅。");
  state.loans.push({ bookId, userId: user.id, borrower: user.name, date: formatDate() });
  book.available = availableCopies(book) > 0;
  persist(); render(); showToast(`《${book.title}》已加入你的借阅。`);
  return true;
}

function openBorrowDialog(bookId) {
  if (!authenticated || isAdmin()) return;
  const book = state.books.find((item) => item.id === bookId);
  if (!book || availableCopies(book) < 1) return showToast("这本书目前已借完，请选择其他图书。");
  if (state.loans.some((loan) => loan.bookId === bookId && loan.userId === currentUser().id)) return showToast("你已借过这本书，可在「我的借阅」中查看。");
  pendingBorrowBookId = bookId;
  document.querySelector("#borrow-form").hidden = false;
  document.querySelector("#borrow-success").hidden = true;
  document.querySelector("#borrow-agreement").checked = false;
  document.querySelector("#confirm-borrow").disabled = true;
  document.querySelector("#borrow-error").hidden = true;
  document.querySelector("#borrow-details").innerHTML = `<div class="borrow-book">${coverMarkup(book, book.id)}<div><h3>《${escapeHtml(book.title)}》</h3><p>${escapeHtml(book.author)} · ${escapeHtml(book.category)}</p></div></div><dl class="borrow-summary"><div><dt>借阅人</dt><dd>${escapeHtml(currentUser().name)}</dd></div><div><dt>借阅数量</dt><dd>1 本</dd></div><div><dt>当前可借</dt><dd>${availableCopies(book)} / ${book.quantity} 本</dd></div><div><dt>借阅日期</dt><dd>${formatDate()}</dd></div></dl><p class="borrow-note">确认后将占用 1 本库存。借阅记录可在「我的借阅」中查看，成功归还后好感度 +1。</p>`;
  document.querySelector("#borrow-dialog").showModal();
}

document.addEventListener("submit", (event) => {
  if (event.target.id !== "catalog-search-form") return;
  event.preventDefault();
  if (!authenticated) return;
  state.query = document.querySelector("#book-search").value.trim();
  if (state.page !== "catalog") {
    state.category = "全部分类";
    state.availability = "全部状态";
  }
  navigate("catalog");
  document.querySelector("#book-search").focus();
});
document.querySelector("#borrow-agreement").addEventListener("change", (event) => {
  document.querySelector("#confirm-borrow").disabled = !event.target.checked;
});
document.querySelector("#borrow-dialog").addEventListener("close", () => {
  pendingBorrowBookId = null;
});
document.querySelector("#borrow-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (pendingBorrowBookId === null || !document.querySelector("#borrow-agreement").checked) return;
  const bookId = pendingBorrowBookId;
  const book = state.books.find((item) => item.id === bookId);
  if (!borrowBook(bookId)) {
    const error = document.querySelector("#borrow-error");
    error.textContent = "借阅未完成，图书库存或借阅状态已变化，请关闭后重新选择。";
    error.hidden = false;
    return;
  }
  pendingBorrowBookId = null;
  document.querySelector("#borrow-form").hidden = true;
  document.querySelector("#borrow-success").hidden = false;
  document.querySelector("#borrow-receipt").textContent = `《${book.title}》已借阅 1 本。你可以继续搜索下一本，或前往「我的借阅」查看。`;
});

function returnBook(bookId) {
  if (!authenticated || isAdmin()) return;
  const loanIndex = state.loans.findIndex((loan) => loan.bookId === bookId && loan.userId === currentUser().id);
  if (loanIndex < 0) return showToast("没有找到这本书的有效借阅记录。");
  const [loan] = state.loans.splice(loanIndex, 1);
  const book = state.books.find((item) => item.id === bookId);
  if (book) book.available = availableCopies(book) > 0;
  const user = state.users.find((item) => item.id === loan.userId);
  if (user) user.returnedBooks = (user.returnedBooks ?? 0) + 1;
  persist(); render(); showToast(`已归还《${book?.title ?? "图书"}》，流川枫好感度 +1。`);
}

const bgm = document.querySelector("#bgm");
const musicToggle = document.querySelector("#music-toggle");
let musicEnabled = false;
let musicStage = "begin";
let musicRequest = 0;
bgm.volume = 0.35;

function updateMusicButton() {
  const playing = musicEnabled && !bgm.paused;
  musicToggle.textContent = playing ? "Ⅱ 暂停 BGM" : "♫ 开启 BGM";
  musicToggle.setAttribute("aria-pressed", String(playing));
}

async function playMusic() {
  const request = ++musicRequest;
  try {
    await bgm.play();
    if (!musicEnabled) bgm.pause();
  } catch (error) {
    if (request !== musicRequest || error.name === "AbortError") return;
    musicEnabled = false;
    showToast("音乐暂未播放，请点击「开启 BGM」重试。");
  }
  updateMusicButton();
}

function updateMusicStage() {
  const atEntrance = !document.querySelector("#welcome-screen").hidden || !document.querySelector("#login-screen").hidden;
  const returned = currentUser().returnedBooks ?? 0;
  const next = atEntrance || isAdmin() || returned <= 4 ? "begin" : returned >= 25 ? "ending" : "middle";
  document.querySelector("#music-stage").textContent = { begin: "初遇 · 开场曲", middle: "靠近 · 攻略曲", ending: "心动 · 结局曲" }[next];
  if (next === musicStage) return;
  musicStage = next;
  bgm.src = `assets/${next}.mp3`;
  if (musicEnabled) void playMusic();
}

musicToggle.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  if (musicEnabled) void playMusic();
  else { ++musicRequest; bgm.pause(); updateMusicButton(); }
});
bgm.addEventListener("play", updateMusicButton);
bgm.addEventListener("pause", updateMusicButton);
bgm.addEventListener("error", () => {
  musicEnabled = false;
  updateMusicButton();
  showToast("BGM 加载失败，请检查音乐文件后重试。");
});
document.querySelector("#music-volume").addEventListener("input", (event) => {
  bgm.volume = Number(event.target.value);
});
document.querySelector("#enter-library").addEventListener("click", () => {
  if (authenticated) enterLibrary();
  else showLogin();
  musicEnabled = true;
  void playMusic();
});
document.querySelector("#show-guide").addEventListener("click", () => {
  document.querySelector("#welcome-screen").hidden = false;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = true;
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#enter-library").focus();
});

async function authRequest(url, values) {
  let response;
  try {
    response = await fetch(url, {
      method: values ? "POST" : "GET",
      headers: values ? { "Content-Type": "application/json" } : {},
      body: values ? JSON.stringify(values) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "登录服务暂时不可用。");
    return data;
  } catch (error) {
    if (!response || !response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("请通过 python server.py 启动网页，并打开 http://localhost:8001。");
    }
    throw error;
  }
}

function updateLoginMode() {
  const role = document.querySelector("#login-role").value;
  document.querySelector("#login-submit").textContent = registering ? "注册并进入图书馆 →" : "登录，进入图书馆 →";
  document.querySelector("#login-password").autocomplete = registering ? "new-password" : "current-password";
  for (const [id, selected] of [["#login-mode", !registering], ["#register-mode", registering]]) {
    const button = document.querySelector(id);
    button.classList.toggle("button-primary", selected);
    button.classList.toggle("button-quiet", !selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  document.querySelector("#account-help").textContent = registering
    ? role === "admin"
      ? adminSetupAvailable ? "首次使用：请设置管理员的姓名、学号和密码，并妥善保管。" : "管理员已设置，请切换到「账号登录」。"
      : "首次来访？填写姓名、学号和至少 6 位密码，创建你的读者账号。"
    : "读者和管理员都需填写注册时的姓名、学号和密码。";
  document.querySelector("#login-error").hidden = true;
}

function showLogin() {
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = false;
  document.querySelector("#library-app").hidden = true;
  document.querySelector("#login-password").value = "";
  updateLoginMode();
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#login-name").focus();
}

function enterLibrary() {
  if (!authenticated) return;
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = false;
  navigate("dashboard");
  document.querySelector(".brand").focus();
}

document.querySelector("#login-mode").addEventListener("click", () => { registering = false; updateLoginMode(); });
document.querySelector("#register-mode").addEventListener("click", () => { registering = true; updateLoginMode(); });
document.querySelector("#login-role").addEventListener("change", updateLoginMode);
document.querySelector("#login-back").addEventListener("click", () => {
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = false;
  document.querySelector("#login-password").value = "";
  updateMusicStage();
  document.querySelector("#enter-library").focus();
});
document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = document.querySelector("#login-submit");
  if (submit.disabled) return;
  const values = Object.fromEntries(new FormData(event.target));
  submit.disabled = true;
  submit.textContent = "正在核对入馆证…";
  try {
    const { user } = await authRequest(registering ? "/api/register" : "/api/login", values);
    let reader = state.users.find((item) => item.studentId === user.studentId);
    if (!reader) {
      reader = { id: Math.max(0, ...state.users.map((item) => item.id)) + 1, returnedBooks: 0 };
      state.users.push(reader);
    }
    Object.assign(reader, user, { username: user.studentId });
    state.activeUserId = reader.id;
    persist();
    authenticated = true;
    if (user.isAdmin) adminSetupAvailable = false;
    document.querySelector("#login-password").value = "";
    enterLibrary();
    musicEnabled = true;
    void playMusic();
    showToast(`欢迎入馆，${user.name} ♡`);
  } catch (error) {
    const message = document.querySelector("#login-error");
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = registering ? "注册并进入图书馆 →" : "登录，进入图书馆 →";
  }
});

initialize().then(async () => {
  try {
    const status = await authRequest("/api/auth-status");
    adminSetupAvailable = status.adminSetupAvailable;
    document.querySelector("#login-submit").disabled = false;
    updateLoginMode();
  } catch (error) {
    const message = document.querySelector("#login-error");
    message.textContent = error.message;
    message.hidden = false;
    document.querySelector("#login-submit").textContent = "请先启动登录服务";
  }
});
