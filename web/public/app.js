const STORAGE_KEY = "shiye-library-web-v1";
const CATALOG_VERSION = 2;
const LOAN_DAYS = 30;
const MAX_ACTIVE_LOANS = 10;
const CHARACTERS = {
  rukawa: { name: "流川枫", title: "流川枫心动狙击战", image: "assets/rukawa.png", alt: "流川枫的黑白漫画肖像", width: 981, height: 983, greeting: "借一本书，让故事和他的目光，都向你靠近一点。" },
  nailong: { name: "奶龙", title: "奶龙心动大冒险", image: "assets/nailong.png", alt: "黄色的奶龙，配文惊鸿一瞥", width: 224, height: 195, greeting: "借一本书，和奶龙一起收集暖乎乎的快乐！" }
};
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
  loanHistory: [],
  activeUserId: 2,
  page: "dashboard",
  character: "rukawa",
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
let milestoneReaderId = null;
let milestoneStoryKey = null;
let openingReturnPage = null;
let endingReturnPage = null;

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
      state.loanHistory = Array.isArray(data.loanHistory) ? data.loanHistory : [];
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
    books: state.books, users: state.users, loans: state.loans, loanHistory: state.loanHistory, activeUserId: state.activeUserId,
    catalogVersion: state.catalogVersion
  }));
}

function currentUser() {
  return state.users.find((user) => user.id === state.activeUserId) ?? state.users[0] ?? DEMO_USERS[1];
}

function characterReturns(user = currentUser(), character = state.character) {
  return user.characterProgress?.[character] ?? (character === "rukawa" ? user.returnedBooks ?? 0 : 0);
}

function overduePenalty(user = currentUser(), character = state.character, today = formatDate()) {
  const matches = (loan) => loan.userId === user.id && (CHARACTERS[loan.character] ? loan.character : "rukawa") === character;
  return state.loans.filter(matches).reduce((sum, loan) => sum + overdueDays(loan, today), 0)
    + state.loanHistory.filter(matches).reduce((sum, loan) => sum + (loan.overdueDays ?? 0), 0);
}

function characterProgress(user = currentUser()) {
  return Math.max(0, characterReturns(user) - overduePenalty(user));
}

function activeLoanCount(user = currentUser()) {
  return state.loans.filter((loan) => loan.userId === user.id).length;
}

function selectCharacter(id) {
  if (!CHARACTERS[id]) return;
  openingReturnPage = null;
  document.querySelector("#story-screen").hidden = true;
  state.character = id;
  const character = CHARACTERS[id];
  document.documentElement?.setAttribute("data-character", id);
  document.title = `${character.title} · 图书馆心动大作战`;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", id === "nailong" ? "#fff9e6" : "#fff3f8");
  document.querySelector("#welcome-title").innerHTML = `${character.name}<br><span>${id === "nailong" ? "心动大冒险" : "心动狙击战"}</span>`;
  document.querySelector("#welcome-character-description").textContent = character.greeting;
  document.querySelector("#login-character-label").textContent = `STEP 03 · ${character.name}篇 · 领取你的入馆证`;
  document.querySelector("#library-route-name").textContent = `${character.name}的图书馆`;
  document.querySelector("#character-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = false;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = true;
  document.querySelector("#login-password").value = "";
  window.history?.replaceState(null, "", `?character=${id}`);
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#enter-library").focus();
}

function showCharacterSelection() {
  document.querySelector("#story-screen").hidden = true;
  document.querySelector("#character-screen").hidden = false;
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = true;
  document.querySelector("#login-password").value = "";
  document.documentElement?.removeAttribute("data-character");
  document.title = "图书馆心动大作战";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", "#fff3f8");
  window.history?.replaceState(null, "", window.location?.pathname || "/");
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#character-title").focus();
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

function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return NaN;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp / 86400000 : NaN;
}

function dueDate(loan) {
  if (Number.isFinite(calendarDay(loan.dueDate))) return loan.dueDate;
  const borrowed = calendarDay(loan.date);
  return Number.isFinite(borrowed) ? new Date((borrowed + LOAN_DAYS) * 86400000).toISOString().slice(0, 10) : "待核对";
}

function overdueDays(loan, today = formatDate()) {
  const days = calendarDay(today) - calendarDay(dueDate(loan));
  return Number.isFinite(days) ? Math.max(0, days) : 0;
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

function unlockedStories(user = currentUser()) {
  const stories = ["opening"];
  const flags = user.storyFlags || {};
  if (state.character === "rukawa" && (characterReturns(user) > 4 || flags.rukawaFirstPass)) stories.push("rukawaFirstPass");
  if (state.character === "rukawa" && (characterProgress(user) >= 25 || flags.rukawaEnding)) stories.push("rukawaEnding");
  if (state.character === "nailong") {
    if (characterReturns(user) > 4 || flags.nailongTrust) stories.push("nailongTrust");
    if (characterProgress(user) >= 25 || flags.nailongFrog) stories.push("nailongFrog");
  }
  return stories;
}

function progressMarkup(user) {
  const returned = characterProgress(user);
  const character = CHARACTERS[state.character];
  const stories = unlockedStories(user);
  const latestStory = stories[stories.length - 1];
  const percent = Math.max(0, Math.min(100, Math.round(returned / 25 * 100)));
  return `<section class="panel progress-panel">
    <div class="progress-top"><h2>${character.title}</h2><span class="spark">♡</span></div>
    <p class="progress-lead">借期 30 天，最多同时借 10 本。每成功归还 1 本，好感度 +1；每本逾期每天扣 1 点，好感度达到 25 解锁心动结局。</p>
    <div class="heart-line"><span>${character.name}好感度</span><strong>${returned} / 25 点</strong></div>
    ${overduePenalty(user) > 0 ? `<p class="overdue-warning">本角色累计逾期扣分：${overduePenalty(user)} 点，含在借与已归还图书；好感度最低为 0。</p>` : ""}
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <div class="milestone-row"><span>开始阅读</span><span>25 点 · 特别结局</span></div>
    <figure class="character-portrait">
      <button class="portrait-replay" type="button" data-action="replay-story" data-story="${latestStory}" aria-label="点击重看${character.name}已解锁剧情">
      <img src="${character.image}" alt="${character.alt}" width="${character.width}" height="${character.height}">
      <span class="portrait-caption"><span>攻略对象 · ${character.name}</span><b>♡ ${latestStory === "nailongFrog" || latestStory === "rukawaEnding" ? "心动已被你击中" : latestStory !== "opening" ? "目光开始为你停留" : "故事从初遇开始"}</b><small>点击图片，重温这段剧情 →</small></span>
      </button>
    </figure>
    <div class="story-replay-links" aria-label="已解锁剧情">${stories.map((story) => `<button type="button" class="text-button" data-action="replay-story" data-story="${story}">${story === "opening" ? "重看初遇" : story === "nailongFrog" || story === "rukawaEnding" ? "重看结局" : "重看中期"}</button>`).join("")}</div>
    <div class="progress-quote">${returned >= 25 ? "恭喜达成目标！新的故事，正等着你们一起开启。 ✨" : `本角色已完成 <strong>${characterReturns(user)}</strong> 次归还，还需积累 ${Math.max(0, 25 - characterReturns(user) + overduePenalty(user))} 点好感度，就能抵达下一段故事。`}</div>
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
  const returned = characterReturns(user);
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

function borrowingTabs(history = false) {
  const visible = (items) => isAdmin() ? items : items.filter((loan) => loan.userId === currentUser().id);
  return `<nav class="borrowing-tabs" aria-label="借阅记录分类"><a class="button ${history ? "button-quiet" : "button-primary"}" href="#loans" data-page="loans" ${history ? "" : 'aria-current="page"'}>当前在借 · ${visible(state.loans).length}</a><a class="button ${history ? "button-primary" : "button-quiet"}" href="#loan-history" data-page="loan-history" ${history ? 'aria-current="page"' : ""}>历史记录 · ${visible(state.loanHistory).length}</a></nav>`;
}

function loanHistoryPage() {
  const history = isAdmin() ? state.loanHistory : state.loanHistory.filter((loan) => loan.userId === currentUser().id);
  const rows = [...history].reverse().map((loan) => `<tr><td><div class="book-cell">${coverMarkup({ title: loan.title || "图书" }, loan.bookId)}<div><div class="book-title">${escapeHtml(loan.title || "图书已删除")}</div><div class="book-author">${escapeHtml(loan.author || "")}</div></div></div></td>${isAdmin() ? `<td>${escapeHtml(loan.borrower)}</td>` : ""}<td>${escapeHtml(loan.date)}</td><td>${escapeHtml(loan.returnedDate)}</td><td>${loan.dueDate ? escapeHtml(loan.dueDate) : "—"}</td><td>${loan.overdueDays ?? 0} 天 / ${loan.overdueDays ?? 0} 点</td><td>${CHARACTERS[loan.character]?.name || "流川枫"}</td><td><span class="status-tag available">已归还</span></td></tr>`).join("");
  const table = `<div class="table-wrap"><table><thead><tr><th>书名 / 作者</th>${isAdmin() ? "<th>借阅人</th>" : ""}<th>借阅日期</th><th>归还日期</th><th>应还日期</th><th>逾期 / 扣分</th><th>攻略角色</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">RETURNED BOOKS</div><h1>${isAdmin() ? "全部借阅历史" : "我的借阅历史"}</h1><p class="subheading">每一本读过的书，都为你留下一段故事。共 ${history.length} 条已归还记录。</p></div></div>${borrowingTabs(true)}<section class="panel">${history.length ? table : '<div class="empty-state"><div class="empty-icon">📖</div><strong>还没有历史记录</strong><span>从现在起，成功归还的图书会自动保存在这里；之前的累计归还进度仍然保留。</span></div>'}</section>`;
}

function loansPage() {
  const loans = isAdmin() ? state.loans : state.loans.filter((loan) => loan.userId === currentUser().id);
  const heading = isAdmin() ? "借阅管理" : "我的借阅";
  const cards = loans.length ? [...loans].reverse().map((loan) => {
    const book = state.books.find((item) => item.id === loan.bookId);
    const canReturn = isAdmin() || loan.userId === currentUser().id;
    return `<article class="loan-card"><div class="loan-meta">${coverMarkup(book ?? { title: "书" }, loan.bookId)}<div class="loan-details"><strong>${escapeHtml(book?.title ?? "图书已删除")}</strong><small>${escapeHtml(book?.author ?? "")}${isAdmin() ? ` · 借阅人：${escapeHtml(loan.borrower)}` : ""}</small></div></div><div class="row-actions"><div class="loan-timing"><span class="loan-date">借于 ${escapeHtml(loan.date)} · 应还 ${escapeHtml(dueDate(loan))}</span><span class="status-tag ${overdueDays(loan) ? "borrowed" : "available"}">${overdueDays(loan) ? `已逾期 ${overdueDays(loan)} 天 · 扣 ${overdueDays(loan)} 点好感度` : "30 天内归还"}</span></div>${canReturn && !isAdmin() ? `<button class="button button-quiet button-small" data-action="return" data-id="${loan.bookId}">归还</button>` : ""}</div></article>`;
  }).join("") : `<div class="empty-state"><div class="empty-icon">↗</div><strong>这里还空着</strong><span>${isAdmin() ? "目前没有正在借阅的图书。" : "去书架挑一本喜欢的书，开启新的阅读吧。"}</span>${!isAdmin() ? '<p><button class="button button-primary" data-page="catalog">浏览图书 →</button></p>' : ""}</div>`;
  const header = isAdmin() ? `<div class="panel-head"><div><h2>全部在借记录</h2><p>${loans.length} 条正在进行的借阅</p></div></div>` : "";
  content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">BORROWING HISTORY</div><h1>${heading}</h1><p class="subheading">${isAdmin() ? "查看读者借阅状态，及时完成图书归还管理。" : "正在读的书和每一次借阅，都收录在这里。"}</p></div></div>${borrowingTabs()}<p class="loan-rules">借期 30 天（到期当天可归还）；每本逾期每天扣 1 点对应角色好感度，最低为 0。每位读者最多同时借 10 本，两条角色路线合并计数。${!isAdmin() ? `你当前在借 ${activeLoanCount()} / 10 本。` : ""}</p><section class="panel">${header}<div class="loan-card-list">${cards}</div></section>`;
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
  const pageLabels = { dashboard: "总览", catalog: "馆藏图书", loans: isAdmin() ? "借阅管理" : "我的借阅", "loan-history": "借阅历史", readers: "读者档案", progress: "攻略进度" };
  if (state.page === "readers" && !isAdmin()) state.page = "dashboard";
  document.querySelector("#page-title").textContent = pageLabels[state.page];
  document.querySelectorAll("[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === (state.page === "loan-history" ? "loans" : state.page) && item.classList.contains("nav-link")));
  if (state.page === "catalog") catalogPage();
  else if (state.page === "loans") loansPage();
  else if (state.page === "loan-history") loanHistoryPage();
  else if (state.page === "readers") readersPage();
  else if (state.page === "progress") content.innerHTML = `<div class="welcome-row"><div class="welcome-copy"><div class="eyebrow">YOUR STORY</div><h1>你的心动攻略进度</h1><p class="subheading">成功归还 +1 点，每本逾期每天 -1 点；好感度达到 25 点解锁特别结局。</p></div><button class="button button-quiet" data-page="dashboard">返回总览</button></div><div class="progress-detail">${progressMarkup(user)}</div>`;
  else dashboardPage();
  maybeShowFirstPassStory();
}

function maybeShowFirstPassStory() {
  if (!authenticated || isAdmin() || document.querySelector("#library-app").hidden) return;
  const user = currentUser();
  const flags = user.storyFlags || {};
  let event;
  if (state.character === "rukawa") {
    if (characterReturns(user) > 4 && !flags.rukawaFirstPass) event = "rukawaFirstPass";
    else if (characterProgress(user) >= 25 && !flags.rukawaEnding) event = "rukawaEnding";
  }
  if (state.character === "nailong") {
    if (characterReturns(user) > 4 && !flags.nailongTrust) event = "nailongTrust";
    else if (characterProgress(user) >= 25 && !flags.nailongFrog) event = "nailongFrog";
  }
  if (!event) return;
  if (event === "rukawaEnding") return showRukawaEnding();
  showMilestoneStory(event);
}

function showMilestoneStory(event) {
  if (!authenticated || isAdmin() || document.querySelector("#library-app").hidden || !unlockedStories().includes(event) || event === "opening") return;
  const user = currentUser();
  const milestone = document.querySelector("#milestone-dialog");
  if (milestone.open || document.querySelector("#borrow-dialog").open || dialog.open) return;
  milestoneReaderId = user.id;
  milestoneStoryKey = event;
  const nailong = state.character === "nailong";
  document.querySelector("#rukawa-milestone").hidden = nailong;
  document.querySelector("#nailong-milestone").hidden = !nailong;
  milestone.setAttribute("aria-labelledby", nailong ? "nailong-milestone-title" : "milestone-title");
  if (nailong) {
    const ending = event === "nailongFrog";
    document.querySelector("#nailong-event-chapter").textContent = ending ? "奶龙篇 · 只给你看的模样" : "奶龙篇 · 信任渐近";
    document.querySelector("#nailong-event-label").textContent = ending ? "好感度达到 25 点 · 专属结局" : "累计归还超过 4 本 · 悄悄靠近";
    document.querySelector("#nailong-milestone-title").textContent = ending ? "这个模样，只给你看。" : "它开始，愿意相信你。";
    document.querySelector("#nailong-event-prose").innerHTML = ending
      ? '<p>奶龙始终不愿意在其他人面前露出奶蛙形态，那是它一直介意、害怕被调侃的样子。</p><p>可在你面前，它愿意放下心底所有的不安与别扭，主动化作奶蛙模样。</p><p class="story-thought">只把这个模样，展现给你一个人看。</p>'
      : '<p>奶龙依旧对人类心存戒备，悄悄观察着来往的人。</p><p>直到它看见你办理图书借还时，小心翼翼地护着书页，轻拿轻放，细心爱惜每一本书。</p><p class="story-thought">它慢慢放下防备，对你的信任一点点多了起来。</p>';
    document.querySelector("#nailong-milestone-continue").textContent = ending ? "收下这份独一无二的信任 ♡" : "珍惜这份信任，继续 →";
  }
  document.querySelector("#milestone-reader-name").textContent = user.name;
  milestone.showModal();
}

document.querySelector("#milestone-continue").addEventListener("click", () => {
  document.querySelector("#milestone-dialog").close();
});
document.querySelector("#nailong-milestone-continue").addEventListener("click", () => {
  document.querySelector("#milestone-dialog").close();
});
document.querySelector("#milestone-dialog").addEventListener("close", () => {
  const user = state.users.find((item) => item.id === milestoneReaderId);
  if (user && milestoneStoryKey) {
    user.storyFlags ??= {};
    user.storyFlags[milestoneStoryKey] = true;
    persist();
  }
  milestoneReaderId = null;
  milestoneStoryKey = null;
  maybeShowFirstPassStory();
});

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
  if (button.dataset.character) {
    selectCharacter(button.dataset.character);
    return;
  }
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
  else if (action === "replay-story") {
    if (isAdmin() || !unlockedStories().includes(button.dataset.story)) return;
    if (button.dataset.story === "opening") {
      openingReturnPage = state.page;
      showOpeningStory();
    } else if (button.dataset.story === "rukawaEnding") showRukawaEnding(state.page);
    else showMilestoneStory(button.dataset.story);
  }
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
  if (activeLoanCount() >= MAX_ACTIVE_LOANS) return showToast("每位读者最多同时借阅 10 本，请先归还后再借。");
  const book = state.books.find((item) => item.id === bookId);
  if (!book || availableCopies(book) < 1) return showToast("这本书目前已借完。");
  const user = currentUser();
  if (state.loans.some((loan) => loan.bookId === bookId && loan.userId === user.id)) return showToast("你已借过这本书，请先归还后再借阅。");
  const date = formatDate();
  state.loans.push({ bookId, userId: user.id, borrower: user.name, date, dueDate: dueDate({ date }), character: state.character, title: book.title, author: book.author });
  book.available = availableCopies(book) > 0;
  persist(); render(); showToast(`《${book.title}》已加入你的借阅。`);
  return true;
}

function openBorrowDialog(bookId) {
  if (!authenticated || isAdmin()) return;
  if (activeLoanCount() >= MAX_ACTIVE_LOANS) return showToast("每位读者最多同时借阅 10 本，请先归还后再借。");
  const book = state.books.find((item) => item.id === bookId);
  if (!book || availableCopies(book) < 1) return showToast("这本书目前已借完，请选择其他图书。");
  if (state.loans.some((loan) => loan.bookId === bookId && loan.userId === currentUser().id)) return showToast("你已借过这本书，可在「我的借阅」中查看。");
  pendingBorrowBookId = bookId;
  document.querySelector("#borrow-form").hidden = false;
  document.querySelector("#borrow-success").hidden = true;
  document.querySelector("#borrow-agreement").checked = false;
  document.querySelector("#confirm-borrow").disabled = true;
  document.querySelector("#borrow-error").hidden = true;
  document.querySelector("#borrow-details").innerHTML = `<div class="borrow-book">${coverMarkup(book, book.id)}<div><h3>《${escapeHtml(book.title)}》</h3><p>${escapeHtml(book.author)} · ${escapeHtml(book.category)}</p></div></div><dl class="borrow-summary"><div><dt>借阅人</dt><dd>${escapeHtml(currentUser().name)}</dd></div><div><dt>借阅数量</dt><dd>1 本</dd></div><div><dt>当前可借</dt><dd>${availableCopies(book)} / ${book.quantity} 本</dd></div><div><dt>借阅日期</dt><dd>${formatDate()}</dd></div><div><dt>应还日期</dt><dd>${dueDate({ date: formatDate() })}（30 天）</dd></div><div><dt>本次借阅后</dt><dd>${activeLoanCount() + 1} / 10 本</dd></div></dl><p class="borrow-note">请在应还日期当天或之前归还。每本逾期每天扣 1 点 ${CHARACTERS[state.character].name} 好感度，成功归还 +1。最多同时借 10 本。</p>`;
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
  maybeShowFirstPassStory();
});
document.querySelector("#borrow-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (pendingBorrowBookId === null || !document.querySelector("#borrow-agreement").checked) return;
  const bookId = pendingBorrowBookId;
  const book = state.books.find((item) => item.id === bookId);
  if (!borrowBook(bookId)) {
    const error = document.querySelector("#borrow-error");
    error.textContent = "借阅未完成：库存、借阅状态可能已变化，或已达 10 本上限。请关闭后检查。";
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
  const target = CHARACTERS[loan.character] ? loan.character : "rukawa";
  const penalty = overdueDays(loan);
  state.loanHistory.push({ ...loan, title: loan.title ?? book?.title ?? "图书已删除", author: loan.author ?? book?.author ?? "", character: target, dueDate: dueDate(loan), overdueDays: penalty, returnedDate: formatDate(), returnedAt: new Date().toISOString() });
  if (user) {
    user.characterProgress ??= { rukawa: user.returnedBooks ?? 0, nailong: 0 };
    user.characterProgress[target] = (user.characterProgress[target] ?? 0) + 1;
    user.returnedBooks = (user.returnedBooks ?? 0) + 1;
  }
  persist(); render(); showToast(`已归还《${book?.title ?? "图书"}》，${CHARACTERS[target].name}好感度 +1。${penalty ? `本次逾期 ${penalty} 天，累计扣 ${penalty} 点，不重复扣分。` : ""}`);
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
  const atEntrance = !document.querySelector("#character-screen").hidden || !document.querySelector("#welcome-screen").hidden || !document.querySelector("#story-screen").hidden || !document.querySelector("#login-screen").hidden;
  const inEnding = !document.querySelector("#rukawa-ending-screen").hidden;
  const returned = characterProgress();
  const next = atEntrance || isAdmin() || returned <= 4 ? "begin" : inEnding || returned >= 25 ? "ending" : "middle";
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
function continueFromOpening() {
  if (authenticated) {
    const page = openingReturnPage || "dashboard";
    openingReturnPage = null;
    enterLibrary(page);
  }
  else showLogin();
}

function showOpeningStory() {
  const nailong = state.character === "nailong";
  document.querySelector("#rukawa-opening").hidden = nailong;
  document.querySelector("#nailong-opening").hidden = !nailong;
  const title = nailong ? "nailong-story-title" : "story-title";
  document.querySelector("#story-screen").setAttribute("aria-labelledby", title);
  document.querySelector("#character-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = true;
  document.querySelector("#story-screen").hidden = false;
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector(`#${title}`).focus();
}

function showRukawaEndingStage(stage) {
  const storyStage = stage === "story";
  document.querySelector("#rukawa-ending-story").hidden = !storyStage;
  document.querySelector("#rukawa-ending-image").hidden = storyStage;
  const title = storyStage ? "rukawa-ending-title" : "rukawa-ending-result-title";
  document.querySelector("#rukawa-ending-screen").setAttribute("aria-labelledby", title);
  window.scrollTo({ top: 0 });
  document.querySelector(`#${title}`).focus();
}

function showRukawaEnding(returnPage) {
  if (!authenticated || isAdmin() || state.character !== "rukawa" || document.querySelector("#library-app").hidden) return;
  if (document.querySelector("#milestone-dialog").open || document.querySelector("#borrow-dialog").open || dialog.open) return;
  endingReturnPage = returnPage || null;
  document.querySelector("#character-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = true;
  document.querySelector("#story-screen").hidden = true;
  document.querySelector("#rukawa-ending-screen").hidden = false;
  showRukawaEndingStage("story");
  updateMusicStage();
}

document.querySelector("#rukawa-ending-next").addEventListener("click", () => showRukawaEndingStage("image"));
document.querySelector("#rukawa-ending-done").addEventListener("click", () => {
  const user = currentUser();
  user.storyFlags ??= {};
  user.storyFlags.rukawaEnding = true;
  persist();
  document.querySelector("#rukawa-ending-screen").hidden = true;
  const page = endingReturnPage || "dashboard";
  endingReturnPage = null;
  enterLibrary(page);
});

document.querySelector("#story-continue").addEventListener("click", continueFromOpening);
document.querySelector("#nailong-story-continue").addEventListener("click", continueFromOpening);
document.querySelector("#nailong-story-back").addEventListener("click", () => {
  document.querySelector("#story-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = false;
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#enter-library").focus();
});
document.querySelector("#story-back").addEventListener("click", () => {
  document.querySelector("#story-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = false;
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#enter-library").focus();
});
document.querySelector("#enter-library").addEventListener("click", () => {
  openingReturnPage = null;
  showOpeningStory();
  musicEnabled = true;
  void playMusic();
});
document.querySelector("#show-guide").addEventListener("click", () => {
  document.querySelector("#story-screen").hidden = true;
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
  document.querySelector("#story-screen").hidden = true;
  document.querySelector("#character-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = false;
  document.querySelector("#library-app").hidden = true;
  document.querySelector("#login-password").value = "";
  updateLoginMode();
  updateMusicStage();
  window.scrollTo({ top: 0 });
  document.querySelector("#login-name").focus();
}

function enterLibrary(page = "dashboard") {
  if (!authenticated) return;
  document.querySelector("#story-screen").hidden = true;
  document.querySelector("#character-screen").hidden = true;
  document.querySelector("#welcome-screen").hidden = true;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#library-app").hidden = false;
  navigate(page);
  if (!document.querySelector("#milestone-dialog").open) document.querySelector(".brand").focus();
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
function validateLoginValues(values) {
  const name = String(values.name ?? "").trim();
  const studentId = String(values.studentId ?? "").trim();
  if (name.length > 80 || !/^\p{L}+(?:[ ·'’\-]\p{L}+)*$/u.test(name)) return { field: "login-name", error: "姓名请填写文字，可含空格、间隔号、短横线或撇号，不能包含数字。" };
  if (!/^[0-9]{1,32}$/.test(studentId)) return { field: "login-student-id", error: "学号只能填写 1–32 位数字，不能包含字母、空格或其他符号。" };
  const length = Array.from(String(values.password ?? "")).length;
  if (length < 6 || length > 128) return { field: "login-password", error: "密码至少 6 位，最多 128 位。" };
  return null;
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = document.querySelector("#login-submit");
  if (submit.disabled) return;
  const values = Object.fromEntries(new FormData(event.target));
  const invalid = validateLoginValues(values);
  if (invalid) {
    const message = document.querySelector("#login-error");
    message.textContent = invalid.error;
    message.hidden = false;
    document.querySelector(`#${invalid.field}`).focus();
    return;
  }
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

document.querySelector("#welcome-change-character").addEventListener("click", showCharacterSelection);
// Recalculate the displayed score when a tab is reopened or crosses midnight.
let lastPolicyDate = formatDate();
function refreshLoanPolicy() {
  lastPolicyDate = formatDate();
  if (authenticated) render();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshLoanPolicy();
});
window.setInterval?.(() => {
  if (formatDate() !== lastPolicyDate) refreshLoanPolicy();
}, 60000);
document.querySelector("#change-character").addEventListener("click", showCharacterSelection);
const routeCharacter = new URLSearchParams(window.location?.search || "").get("character");
if (CHARACTERS[routeCharacter]) selectCharacter(routeCharacter);
else showCharacterSelection();

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
