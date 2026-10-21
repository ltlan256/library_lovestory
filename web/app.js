const STORAGE_KEY = "shiye-library-web-v1";
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
  toastTimer: null
};

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
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      state.books = data.books;
      state.users = data.users;
      state.loans = data.loans;
      state.activeUserId = data.activeUserId ?? 2;
      render();
      return;
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      showNotice("本地保存的数据无法读取，已重新从项目文本文件初始化。");
    }
  }

  try {
    const response = await fetch("books.json");
    if (!response.ok) throw new Error(`读取书目失败（${response.status}）`);
    const books = await response.json();
    state.books = books.map((book) => ({ ...book, available: Boolean(book.available) }));
    state.users = DEMO_USERS.map((user) => ({ ...user }));
    state.loans = [];
    persist();
  } catch (error) {
    state.books = DEMO_BOOKS.map((book) => ({ ...book }));
    state.users = DEMO_USERS.map((user) => ({ ...user }));
    state.loans = [{ bookId: 2, userId: 2, borrower: "张三", date: "2026-10-18" }];
    showNotice("未能读取书目文件，当前使用内置示例数据。请通过本地 HTTP 服务打开网页以加载完整馆藏。");
  }
  render();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    books: state.books, users: state.users, loans: state.loans, activeUserId: state.activeUserId
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
      : book.available
        ? `<button class="button button-primary button-small" data-action="borrow" data-id="${book.id}">借阅</button>`
        : `<button class="button button-quiet button-small" data-action="return" data-id="${book.id}" ${!state.loans.some((loan) => loan.bookId === book.id && loan.userId === currentUser().id) ? "disabled" : ""}>归还</button>`;
    const actionMarkup = options.showActions === false ? "" : `<td><div class="row-actions">${controls}</div></td>`;
    return `<tr>
      <td><div class="book-cell">${coverMarkup(book, index)}<div><div class="book-title">${escapeHtml(book.title)}</div><div class="book-author">${escapeHtml(book.author)}</div></div></div></td>
      <td><span class="category-tag">${escapeHtml(book.category)}</span></td>
      <td>${book.year}</td>
      <td><span class="status-tag ${book.available ? "available" : "borrowed"}">${book.available ? "在馆" : "借出中"}</span></td>
      ${isAdmin() ? `<td>${escapeHtml(state.loans.find((loan) => loan.bookId === book.id)?.borrower ?? "—")}</td>` : ""}
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
    <div class="progress-top"><h2>阅读同行计划</h2><span class="spark">✳</span></div>
    <p class="progress-lead">每一次按时归还，都是认真阅读的温柔注脚。完成 25 次归还，解锁特别结局。</p>
    <div class="heart-line"><span>流川枫好感度</span><strong>${returned} / 25 本</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <div class="milestone-row"><span>开始阅读</span><span>25 次 · 特别结局</span></div>
    <div class="progress-quote">${returned >= 25 ? "恭喜达成目标！新的故事，正等着你们一起开启。 ✨" : `已完成 <strong>${returned}</strong> 次归还，再读 ${Math.max(0, 25 - returned)} 本，就能抵达下一段故事。`}</div>
    <div class="quick-actions"><button class="button button-primary" data-page="catalog">去挑一本书 <span>→</span></button><button class="button button-quiet" data-page="loans">我的借阅</button></div>
  </section>`;
}

function statCard(label, value, foot, icon) {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
}

function dashboardPage() {
  const user = currentUser();
  const borrowed = state.books.length - state.books.filter((book) => book.available).length;
  const onLoan = isAdmin() ? state.loans.length : state.loans.filter((loan) => loan.userId === user.id).length;
  const returned = user.returnedBooks ?? 0;
  const latest = [...state.books].sort((a, b) => b.id - a.id).slice(0, 5);
  const stats = `<div class="stats-grid">
    ${statCard("馆藏总量", state.books.length, "<strong>持续更新</strong> · 精选藏书", "▤")}
    ${statCard("当前可借", state.books.filter((book) => book.available).length, "<strong>欢迎</strong>来发现下一本", "⌕")}
    ${statCard(isAdmin() ? "借阅记录" : "我的在借", onLoan, isAdmin() ? "所有读者的在借记录" : "记得按时归还哦", "↗")}
    ${statCard(isAdmin() ? "读者人数" : "累计归还", isAdmin() ? state.users.filter((item) => !item.isAdmin).length : returned, isAdmin() ? "一起分享阅读" : "<strong>阅读同行</strong>计划进度", "♧")}
  </div>`;
  const latestPanel = `<section class="panel">
    <div class="panel-head"><div><h2>新近入藏</h2><p>也许下一本心头好，就在这里</p></div><button class="text-button" data-page="catalog">查看全部 →</button></div>
    ${tableMarkup(latest, { showActions: false })}
  </section>`;
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">A GOOD DAY TO READ</div><h1>${isAdmin() ? "你好，管理员。" : `你好，${escapeHtml(user.name)}。`}</h1><p class="subheading">${isAdmin() ? "今天也来看看，书架与读者们有什么新故事。" : "今天想读点什么？你喜欢的故事，可能就在下一页。"}</p></div><div class="date-tag"><span>✳</span>${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())}</div></div>
    ${stats}
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
    const matchesStatus = state.availability === "全部状态" || (state.availability === "在馆" ? book.available : !book.available);
    return matchesQuery && matchesCategory && matchesStatus;
  }).sort((a, b) => a.id - b.id);
}

function catalogPage() {
  const categories = ["全部分类", ...new Set(state.books.map((book) => book.category).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN")))];
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">THE COLLECTION</div><h1>馆藏图书</h1><p class="subheading">在 ${state.books.length} 本藏书里，找到此刻想读的那一本。</p></div>${isAdmin() ? '<button class="button button-primary" data-action="add-book">＋ 添加图书</button>' : ""}</div>
    <section class="panel"><div class="panel-head"><div><h2>所有图书</h2><p>按书名、作者或分类检索</p></div></div>
    <div class="toolbar" style="padding:0 20px"><div class="toolbar-left"><label class="search-box"><input id="book-search" type="search" placeholder="搜索书名、作者或分类…" value="${escapeHtml(state.query)}"></label><select id="category-filter" class="select-control" aria-label="分类筛选">${categories.map((item) => `<option ${state.category === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select><select id="status-filter" class="select-control" aria-label="状态筛选">${["全部状态", "在馆", "借出中"].map((item) => `<option ${state.availability === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><span class="result-count" id="result-count">${filteredBooks().length} 本图书</span></div>
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
  const user = currentUser();
  document.querySelector("#user-name").textContent = user.name;
  document.querySelector("#user-avatar").textContent = Array.from(user.name)[0] ?? "读";
  document.querySelector("#user-role").textContent = isAdmin() ? "管理员模式 · 点击切换" : "读者模式 · 点击切换";
  document.querySelectorAll(".admin-only").forEach((item) => item.classList.toggle("hidden", !isAdmin()));
  const pageLabels = { dashboard: "总览", catalog: "馆藏图书", loans: isAdmin() ? "借阅管理" : "我的借阅", readers: "读者档案" };
  if (state.page === "readers" && !isAdmin()) state.page = "dashboard";
  document.querySelector("#page-title").textContent = pageLabels[state.page];
  document.querySelectorAll("[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === state.page && item.classList.contains("nav-link")));
  if (state.page === "catalog") catalogPage();
  else if (state.page === "loans") loansPage();
  else if (state.page === "readers") readersPage();
  else dashboardPage();
}

function navigate(page) {
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
    <div class="form-field"><label for="book-year">出版年份</label><input class="form-control" id="book-year" name="year" type="number" min="0" max="9999" required value="${book?.year ?? new Date().getFullYear()}"></div>`;
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
    navigate(button.dataset.page);
    return;
  }
  const action = button.dataset.action;
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
  else if (action === "borrow") borrowBook(id);
  else if (action === "return") returnBook(id);
});

document.querySelector("#role-switch").addEventListener("click", () => {
  const admin = state.users.find((user) => user.isAdmin);
  const reader = state.users.find((user) => !user.isAdmin);
  if (!admin || !reader) return showToast("需要同时有管理员和读者账号才能切换演示身份。");
  state.activeUserId = isAdmin() ? reader.id : admin.id;
  persist();
  if (!isAdmin() && state.page === "readers") state.page = "dashboard";
  render();
  showToast(`已切换为${isAdmin() ? "管理员" : "读者"}演示身份。`);
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
  document.querySelector("#result-count").textContent = `${books.length} 本图书`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
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
  if (!title || !author || !category || !Number.isInteger(year) || year < 0 || year > 9999) {
    return showToast("请检查图书信息后再保存。");
  }
  if (state.books.some((book) => book.title === title && book.id !== state.editingBookId)) {
    return showToast("馆藏中已有同名图书，请确认后再添加。");
  }
  if (state.editingBookId) {
    const book = state.books.find((item) => item.id === state.editingBookId);
    Object.assign(book, { title, author, category, year });
  } else {
    const id = Math.max(0, ...state.books.map((book) => book.id)) + 1;
    state.books.push({ id, title, author, category, year, available: true });
  }
  persist(); dialog.close(); render(); showToast(state.editingBookId ? "图书信息已更新。" : "新书已加入馆藏。");
});

function borrowBook(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book || !book.available) return showToast("这本书目前不可借阅。");
  const user = currentUser();
  book.available = false;
  state.loans.push({ bookId, userId: user.id, borrower: user.name, date: formatDate() });
  persist(); render(); showToast(`《${book.title}》已加入你的借阅。`);
}

function returnBook(bookId) {
  const loanIndex = state.loans.findIndex((loan) => loan.bookId === bookId && loan.userId === currentUser().id);
  if (loanIndex < 0) return showToast("没有找到这本书的有效借阅记录。");
  const [loan] = state.loans.splice(loanIndex, 1);
  const book = state.books.find((item) => item.id === bookId);
  if (book) book.available = true;
  const user = state.users.find((item) => item.id === loan.userId);
  if (user) user.returnedBooks = (user.returnedBooks ?? 0) + 1;
  persist(); render(); showToast(`已归还《${book?.title ?? "图书"}》，阅读同行进度 +1。`);
}

initialize();
