const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const catalog = JSON.parse(fs.readFileSync('web/books.json', 'utf8'));
const source = fs.readFileSync('web/app.js', 'utf8');
const storageKey = 'shiye-library-web-v1';

async function launch(saved, offline = false, route = '', now = null) {
  let clock = now;
  const storage = new Map(saved ? [[storageKey, JSON.stringify(saved)]] : []);
  const nodes = new Map();
  const documentHandlers = {};
  const rootAttributes = {};
  const location = { search: route, pathname: '/' };
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: id !== '#welcome-screen', value: '', textContent: '', innerHTML: '',
      classList: { add() {}, remove() {}, toggle() {} },
      handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      showModal() { this.open = true; },
      close() { this.open = false; this.handlers.close?.(); },
      setAttribute() {}, focus() {}, pause() {},
      async play() {}
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: {
      documentElement: { setAttribute: (key, value) => { rootAttributes[key] = value; }, removeAttribute: key => { delete rootAttributes[key]; } },
      querySelector: element, querySelectorAll: () => [], addEventListener: (name, handler) => { documentHandlers[name] = handler; }
    },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { location, history: { replaceState: (_state, _title, url) => { location.search = url.startsWith('?') ? url : ''; } }, scrollTo() {} },
    URLSearchParams, setTimeout: () => 0, clearTimeout() {},
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock || Date.now()])); }
      static now() { return clock ? new Date(clock).getTime() : Date.now(); }
    },
    fetch: async url => {
      if (offline && url === 'books.json') throw new Error('offline');
      return { ok: true, json: async () => url === 'books.json' ? structuredClone(catalog) : { adminSetupAvailable: true } };
    }, console
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return {
    run: code => vm.runInContext(code, context), saved: () => JSON.parse(storage.get(storageKey)), element, rootAttributes, location,
    setToday: value => { clock = value; },
    click: dataset => documentHandlers.click({ preventDefault() {}, target: { closest: () => ({ dataset, matches: () => false }) } }),
    submitSearch: () => documentHandlers.submit({ preventDefault() {}, target: { id: 'catalog-search-form' } })
  };
}

(async () => {
  assert.equal(catalog.length, 250);
  assert.equal(new Set(catalog.map(book => book.title)).size, 250);
  assert.equal(new Set(catalog.map(book => book.id)).size, 250);
  assert.ok(catalog.every(book => Number.isInteger(book.quantity) && book.quantity >= 1 && book.quantity <= 3));
  assert.deepEqual([...new Set(catalog.map(book => book.quantity))].sort(), [1, 2, 3]);

  const fresh = await launch();
  assert.equal(fresh.run('state.books.length'), 250);
  assert.equal(fresh.run('state.books.reduce((sum, book) => sum + availableCopies(book), 0)'), catalog.reduce((sum, book) => sum + book.quantity, 0));
  fresh.run('authenticated = true; state.activeUserId = 2; state.books[0].quantity = 2;');
  fresh.run('borrowBook(1); borrowBook(1);');
  assert.equal(fresh.run('state.loans.length'), 1, 'same reader cannot borrow duplicate copies');
  assert.equal(fresh.run('availableCopies(state.books[0])'), 1);
  fresh.run('state.users.push({ id: 3, name: "Reader 2", returnedBooks: 0 }); state.activeUserId = 3; borrowBook(1);');
  assert.equal(fresh.run('availableCopies(state.books[0])'), 0);
  fresh.run('state.users.push({ id: 4, name: "Reader 3", returnedBooks: 0 }); state.activeUserId = 4; borrowBook(1);');
  assert.equal(fresh.run('state.loans.length'), 2, 'stock cannot go below zero');
  fresh.run('returnBook(1)');
  assert.equal(fresh.run('state.loans.length'), 2, 'another reader cannot return this loan');
  fresh.run('state.activeUserId = 2; returnBook(1); returnBook(1);');
  assert.equal(fresh.run('availableCopies(state.books[0])'), 1);
  assert.equal(fresh.run('currentUser().returnedBooks'), 1, 'duplicate return cannot grant more progress');
  fresh.run('state.activeUserId = 3; returnBook(1)');
  assert.equal(fresh.run('availableCopies(state.books[0])'), 2);
  const refreshed = await launch(fresh.saved());
  assert.equal(refreshed.run('state.books[0].quantity'), 2, 'refresh must keep stock unchanged');

  const legacy = {
    books: catalog.slice(0, 100).map(({ quantity, ...book }) => book),
    users: [{ id: 2, name: 'Existing reader', returnedBooks: 17 }],
    loans: [{ bookId: 1, userId: 2, borrower: 'Existing reader', date: '2026-10-21' }], activeUserId: 2
  };
  legacy.books.push({ id: 101, title: 'Custom title', quantity: 3 });
  const migrated = await launch(legacy);
  assert.equal(migrated.run('state.books.length'), 251, 'custom book is retained alongside 250 seed titles');
  assert.equal(migrated.run('new Set(state.books.map(book => book.id)).size'), 251, 'colliding seed ID must be reassigned');
  assert.equal(migrated.run('currentUser().returnedBooks'), 17);
  assert.equal(migrated.run('state.loans.length'), 1);
  assert.equal(migrated.run('availableCopies(state.books[0])'), catalog[0].quantity - 1);
  const twice = await launch(migrated.saved());
  assert.equal(twice.run('state.books.length'), 251, 'migration must not duplicate new titles');
  const offline = await launch(legacy, true);
  assert.equal(offline.run('state.books.length'), 101);
  assert.equal(offline.saved().catalogVersion, undefined);
  const recovered = await launch(offline.saved());
  assert.equal(recovered.run('state.books.length'), 251, 'migration retries after network recovery');

  const flow = await launch();
  flow.run('authenticated = true; state.activeUserId = 2; navigate("dashboard");');
  assert.equal((flow.element('#page-content').innerHTML.match(/class="stat-card" href=/g) || []).length, 4);
  flow.click({ page: 'catalog', availability: '在馆' });
  assert.equal(flow.run('state.page'), 'catalog');
  assert.equal(flow.run('state.availability'), '在馆');
  flow.click({ page: 'catalog', availability: '全部状态' });
  assert.equal(flow.run('state.availability'), '全部状态');
  flow.click({ page: 'loans' });
  assert.equal(flow.run('state.page'), 'loans');
  flow.click({ page: 'progress' });
  assert.equal(flow.run('state.page'), 'progress');
  flow.click({ page: 'dashboard' });
  flow.element('#book-search').value = catalog[0].title;
  flow.submitSearch();
  assert.equal(flow.run('state.page'), 'catalog');
  assert.ok(flow.run('filteredBooks().some(book => book.id === 1)'));
  flow.click({ action: 'borrow', id: '1' });
  assert.equal(flow.element('#borrow-dialog').open, true);
  assert.equal(flow.run('state.loans.length'), 0, 'opening confirmation must not borrow the book');
  assert.equal(flow.element('#confirm-borrow').disabled, true);
  flow.element('#borrow-form').handlers.submit({ preventDefault() {} });
  assert.equal(flow.run('state.loans.length'), 0, 'unchecked confirmation cannot borrow');
  flow.click({ action: 'cancel-borrow' });
  assert.equal(flow.run('pendingBorrowBookId'), null);
  assert.equal(flow.run('state.loans.length'), 0, 'cancel must keep stock unchanged');
  flow.click({ action: 'borrow', id: '1' });
  flow.element('#borrow-agreement').checked = true;
  flow.element('#borrow-agreement').handlers.change({ target: { checked: true } });
  assert.equal(flow.element('#confirm-borrow').disabled, false);
  flow.element('#borrow-form').handlers.submit({ preventDefault() {} });
  flow.element('#borrow-form').handlers.submit({ preventDefault() {} });
  assert.equal(flow.run('state.loans.length'), 1, 'double submit creates only one loan');
  assert.equal(flow.element('#borrow-success').hidden, false);
  assert.equal(flow.run('state.query'), catalog[0].title, 'search is preserved after borrowing');
  flow.click({ action: 'view-borrowed' });
  assert.equal(flow.run('state.page'), 'loans');
  assert.equal(flow.element('#borrow-dialog').open, false);
  // Stock changes while a confirmation is open must be rechecked on submission.
  flow.run('returnBook(1); state.books[0].quantity = 1;');
  flow.click({ action: 'borrow', id: '1' });
  flow.run('state.loans.push({ bookId: 1, userId: 99 });');
  flow.element('#borrow-agreement').checked = true;
  flow.element('#borrow-form').handlers.submit({ preventDefault() {} });
  assert.equal(flow.run('state.loans.length'), 1);
  assert.equal(flow.element('#borrow-error').hidden, false);
  flow.click({ action: 'cancel-borrow' });
  flow.run('state.activeUserId = 1; navigate("dashboard");');
  flow.click({ page: 'readers' });
  assert.equal(flow.run('state.page'), 'readers');
  console.log('PASS: dashboard links, search, confirmation, cancel, explicit agreement, duplicate submit, success navigation and stock recheck');

  const chooser = await launch();
  assert.equal(chooser.element('#character-screen').hidden, false, 'first page is character selection');
  assert.equal(chooser.element('#welcome-screen').hidden, true);
  chooser.click({ character: 'nailong' });
  assert.equal(chooser.rootAttributes['data-character'], 'nailong');
  assert.equal(chooser.location.search, '?character=nailong');
  assert.equal(chooser.element('#character-screen').hidden, true);
  assert.equal(chooser.element('#welcome-screen').hidden, false);
  chooser.run('authenticated = true; state.activeUserId = 2; enterLibrary();');
  assert.match(chooser.element('#page-content').innerHTML, /assets\/nailong.png/);
  chooser.run('borrowBook(1); returnBook(1);');
  assert.equal(chooser.run('characterProgress()'), 1);
  chooser.click({ character: 'rukawa' });
  chooser.run('enterLibrary()');
  assert.equal(chooser.rootAttributes['data-character'], 'rukawa');
  assert.equal(chooser.run('characterProgress()'), 0, 'nailong progress does not transfer to rukawa');
  assert.match(chooser.element('#page-content').innerHTML, /assets\/rukawa.png/);
  chooser.run('borrowBook(1); selectCharacter("nailong"); enterLibrary(); returnBook(1);');
  assert.equal(chooser.run('characterProgress()'), 1, 'returns credit the character selected when borrowing');
  assert.equal(chooser.run('currentUser().characterProgress.rukawa'), 1);
  chooser.run('currentUser().characterProgress.rukawa = 25; currentUser().characterProgress.nailong = 5; selectCharacter("rukawa"); enterLibrary();');
  assert.equal(chooser.run('musicStage'), 'ending');
  chooser.run('selectCharacter("nailong"); enterLibrary();');
  assert.equal(chooser.run('musicStage'), 'middle');
  chooser.run('currentUser().characterProgress.rukawa = 1; currentUser().characterProgress.nailong = 1; persist();');
  chooser.element('#change-character').handlers.click();
  assert.equal(chooser.element('#character-screen').hidden, false);
  assert.equal(chooser.rootAttributes['data-character'], undefined);
  const yellowRoute = await launch(chooser.saved(), false, '?character=nailong');
  assert.equal(yellowRoute.rootAttributes['data-character'], 'nailong');
  assert.equal(yellowRoute.element('#welcome-screen').hidden, false);
  assert.equal(yellowRoute.element('#library-app').hidden, true, 'a direct role link still requires login');
  assert.equal(yellowRoute.run('state.users.find(user => user.id === 2).characterProgress.nailong'), 1);
  const invalidRoute = await launch(undefined, false, '?character=invalid');
  assert.equal(invalidRoute.element('#character-screen').hidden, false);
  assert.ok(fs.statSync('web/assets/nailong.png').size > 0);
  console.log('PASS: character choice, pink/yellow routes, portrait switching, separate persisted progress and return attribution');

  const historyFlow = await launch();
  historyFlow.run('authenticated = true; state.activeUserId = 2; navigate("loans");');
  assert.match(historyFlow.element('#page-content').innerHTML, /href="#loan-history"/);
  historyFlow.click({ page: 'loan-history' });
  assert.equal(historyFlow.run('state.page'), 'loan-history');
  assert.equal(historyFlow.run('state.loanHistory.length'), 0);
  historyFlow.run('selectCharacter("nailong"); borrowBook(1); state.books[0].title = "Edited title"; returnBook(1); returnBook(1);');
  assert.equal(historyFlow.run('state.loanHistory.length'), 1, 'duplicate return cannot duplicate history');
  assert.equal(historyFlow.run('state.loanHistory[0].title'), catalog[0].title, 'history retains title from the time of borrowing');
  assert.equal(historyFlow.run('state.loanHistory[0].character'), 'nailong');
  assert.match(historyFlow.run('state.loanHistory[0].returnedDate'), /^\d{4}-\d{2}-\d{2}$/);
  historyFlow.run('state.users.push({ id: 3, name: "Other reader" }); state.activeUserId = 3; borrowBook(2); returnBook(2); navigate("loan-history");');
  assert.equal(historyFlow.run('state.loanHistory.length'), 2);
  assert.ok(!historyFlow.element('#page-content').innerHTML.includes(catalog[0].title), 'reader history excludes other readers');
  assert.ok(historyFlow.element('#page-content').innerHTML.includes(catalog[1].title));
  historyFlow.run('state.activeUserId = 1; navigate("loan-history");');
  assert.ok(historyFlow.element('#page-content').innerHTML.includes(catalog[0].title));
  assert.ok(historyFlow.element('#page-content').innerHTML.includes(catalog[1].title));
  historyFlow.run('state.books = state.books.filter(book => book.id !== 1); persist();');
  const historyReload = await launch(historyFlow.saved());
  historyReload.run('authenticated = true; state.activeUserId = 2; navigate("loan-history");');
  assert.equal(historyReload.run('state.loanHistory.length'), 2);
  assert.ok(historyReload.element('#page-content').innerHTML.includes(catalog[0].title), 'deleted book remains in persisted history');
  historyReload.click({ page: 'loans' });
  assert.equal(historyReload.run('state.page'), 'loans');
  assert.equal(migrated.run('state.loanHistory.length'), 0, 'legacy data receives an empty history without inventing records');
  console.log('PASS: history navigation, empty state, return snapshots, role visibility, duplicate protection and persistence');

  const policy = await launch(undefined, false, '', '2026-10-21T12:00:00');
  policy.run('authenticated = true; state.activeUserId = 2; currentUser().returnedBooks = 20; borrowBook(1);');
  assert.equal(policy.run('state.loans[0].dueDate'), '2026-11-20');
  assert.equal(policy.run('dueDate({ date: "2028-02-01" })'), '2028-03-02', 'calendar arithmetic handles leap years');
  policy.setToday('2026-11-20T23:59:00');
  assert.equal(policy.run('overdueDays(state.loans[0])'), 0, 'due date itself is still on time');
  assert.equal(policy.run('characterProgress()'), 20);
  policy.setToday('2026-11-21T00:01:00');
  assert.equal(policy.run('characterProgress()'), 19);
  policy.run('render(); render(); persist();');
  assert.equal(policy.run('characterProgress()'), 19, 'rerender does not charge twice');
  const policyReload = await launch(policy.saved(), false, '', '2026-11-21T12:00:00');
  assert.equal(policyReload.run('characterProgress()'), 19, 'refresh does not charge twice');
  policy.run('borrowBook(2)');
  policy.setToday('2026-11-23T12:00:00');
  assert.equal(policy.run('characterProgress()'), 17);
  policy.run('returnBook(1)');
  assert.equal(policy.run('state.loanHistory[0].overdueDays'), 3);
  assert.equal(policy.run('characterProgress()'), 18, 'return grants one point and retains prior penalty');
  policy.setToday('2026-11-24T12:00:00');
  policy.run('returnBook(1)');
  assert.equal(policy.run('characterProgress()'), 18, 'returned books stop accruing penalties');
  policy.run('state.character = "nailong";');
  assert.equal(policy.run('overduePenalty()'), 0, 'penalties apply only to the loan character');
  policy.setToday('2026-12-23T12:00:00');
  policy.run('state.character = "rukawa";');
  assert.equal(policy.run('overduePenalty()'), 5, 'active and settled late days are added per book');
  assert.equal(policy.run('dueDate({ date: "2026-10-21" })'), '2026-11-20', 'legacy loans infer the same deadline');
  policy.run('state.character = "rukawa"; currentUser().characterProgress.rukawa = 0;');
  assert.equal(policy.run('characterProgress()'), 0, 'affection never falls below zero');

  const limit = await launch(undefined, false, '', '2026-10-21T12:00:00');
  limit.run('authenticated = true; state.activeUserId = 2; for (let id = 1; id <= 10; id++) { state.character = id <= 5 ? "rukawa" : "nailong"; borrowBook(id); }');
  assert.equal(limit.run('activeLoanCount()'), 10);
  limit.run('openBorrowDialog(11)');
  assert.equal(limit.element('#borrow-dialog').open, undefined, 'limit blocks confirmation dialog');
  limit.run('borrowBook(11)');
  assert.equal(limit.run('state.loans.length'), 10, 'both routes share the ten book limit');
  limit.run('returnBook(1); borrowBook(11);');
  assert.equal(limit.run('activeLoanCount()'), 10, 'return frees a slot');
  limit.run('state.users.push({ id: 3, name: "Another reader" }); state.activeUserId = 3; borrowBook(12);');
  assert.equal(limit.run('activeLoanCount()'), 1, 'limit is per reader');
  const recheck = await launch(undefined, false, '', '2026-10-21T12:00:00');
  recheck.run('authenticated = true; state.activeUserId = 2; for (let id = 1; id <= 9; id++) borrowBook(id); openBorrowDialog(11); borrowBook(10);');
  recheck.element('#borrow-agreement').checked = true;
  recheck.element('#borrow-form').handlers.submit({ preventDefault() {} });
  assert.equal(recheck.run('activeLoanCount()'), 10, 'confirmation rechecks the limit');
  assert.equal(recheck.element('#borrow-error').hidden, false);
  console.log('PASS: 30 day deadline, leap year, overdue boundaries, stable penalties, return settlement and ten-book limit across routes');
  console.log('PASS: 250 titles, 1–3 copies, stock depletion/recovery, duplicate borrow/return protection, stable refresh and legacy migration');
})().catch(error => { console.error(error); process.exitCode = 1; });
