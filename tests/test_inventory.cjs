const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const catalog = JSON.parse(fs.readFileSync('web/books.json', 'utf8'));
const source = fs.readFileSync('web/app.js', 'utf8');
const storageKey = 'shiye-library-web-v1';

async function launch(saved, offline = false) {
  const storage = new Map(saved ? [[storageKey, JSON.stringify(saved)]] : []);
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: id !== '#welcome-screen', value: '', textContent: '', innerHTML: '',
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}, focus() {}, pause() {},
      async play() {}
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: element, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { scrollTo() {} }, setTimeout: () => 0, clearTimeout() {},
    fetch: async url => {
      if (offline && url === 'books.json') throw new Error('offline');
      return { ok: true, json: async () => url === 'books.json' ? structuredClone(catalog) : { adminSetupAvailable: true } };
    }, console
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { run: code => vm.runInContext(code, context), saved: () => JSON.parse(storage.get(storageKey)) };
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
  console.log('PASS: 250 titles, 1–3 copies, stock depletion/recovery, duplicate borrow/return protection, stable refresh and legacy migration');
})().catch(error => { console.error(error); process.exitCode = 1; });
