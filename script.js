/* =========================================================
   1. ХРАНИЛИЩЕ
   ========================================================= */
const KEY = 'blogapp_v1';
const blank = () => ({ users: [], posts: [], comments: [], session: null, seq: 1 });

let state = (() => {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return blank(); }
})();

const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const nid  = () => state.seq++;

/* =========================================================
   2. УТИЛИТЫ
   ========================================================= */
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const userbox = document.getElementById('userbox');

const me        = () => state.users.find(u => u.id === state.session) || null;
const userById  = id => state.users.find(u => u.id === id);
const esc       = s => String(s).replace(/[&<>"']/g, c =>
                    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl2br     = s => esc(s).replace(/\n/g, '<br>');
const fmt       = ts => new Date(ts).toLocaleString('ru-RU',
                    {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
const go        = h => location.hash = h;
const countComments = pid => state.comments.filter(c => c.postId === pid).length;

/* «Хеш» пароля. ВНИМАНИЕ: демонстрационный, не для продакшена! */
function hashPwd(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16);
}

/* Глобальное UI-состояние (сортировка/фильтр) */
const ui = { sort: 'new', tagFilter: '' };

function sortPosts(arr, mode) {
  const a = arr.slice();
  if (mode === 'old')      a.sort((x, y) => x.createdAt - y.createdAt);
  else if (mode === 'title')   a.sort((x, y) => x.title.localeCompare(y.title, 'ru'));
  else if (mode === 'comments') a.sort((x, y) => countComments(y.id) - countComments(x.id));
  else                     a.sort((x, y) => y.createdAt - x.createdAt);
  return a;
}

/* =========================================================
   3. РОУТЕР
   ========================================================= */
function router() {
  const seg = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);
  const u = me();
  renderNav(u);
  renderUserbox(u);
  window.scrollTo(0, 0);

  const v = seg[0] || 'feed';
  switch (v) {
    case 'feed':   return viewFeed();
    case 'public': return viewPublic(seg[1] !== undefined ? decodeURIComponent(seg[1]) : null);
    case 'tag':    return viewPublic(decodeURIComponent(seg[1] || ''));
    case 'my':     return viewMy();
    case 'users':  return viewUsers();
    case 'user':   return viewUser(+seg[1]);
    case 'post':   return viewPost(+seg[1]);
    case 'new':    return viewEditor(null);
    case 'edit':   return viewEditor(+seg[1]);
    case 'login':  return viewAuth();
    default:       return viewFeed();
  }
}

function renderNav(u) {
  const items = [
    ['#/feed',   'Лента'],
    ['#/public', 'Публичные'],
    ['#/users',  'Пользователи']
  ];
  if (u) items.push(['#/my', 'Мои посты'], ['#/new', '+ Пост']);
  const cur = location.hash || '#/feed';
  nav.innerHTML = items.map(([h, t]) =>
    `<a href="${h}" class="${cur.startsWith(h) ? 'active' : ''}">${t}</a>`).join('');
}

function renderUserbox(u) {
  userbox.innerHTML = u
    ? `<a href="#/user/${u.id}">@${esc(u.username)}</a>
       <button class="ghost" data-act="logout">Выйти</button>`
    : `<a class="btn" href="#/login">Войти / Регистрация</a>`;
}

/* =========================================================
   4. КАРТОЧКА ПОСТА
   ========================================================= */
function postCard(p) {
  const author = userById(p.authorId) || { username: 'удалён', id: 0 };
  const u = me();
  const own = u && u.id === p.authorId;
  const tags = (p.tags || []).map(t =>
    `<a class="tag" href="#/tag/${encodeURIComponent(t)}">#${esc(t)}</a>`).join('');

  return `
  <article class="card">
    <div class="post-head">
      <a href="#/user/${author.id}">@${esc(author.username)}</a>
      <span>· ${fmt(p.createdAt)}</span>
      ${p.updatedAt ? '<span>· изменён</span>' : ''}
      ${p.visibility === 'hidden' ? '<span class="badge">🔒 только по запросу</span>' : ''}
    </div>
    <h3><a href="#/post/${p.id}">${esc(p.title)}</a></h3>
    <div>${nl2br(p.content.length > 400 ? p.content.slice(0, 400) + '…' : p.content)}</div>
    <div style="margin-top:8px">${tags}</div>
    <div class="post-foot">
      <a href="#/post/${p.id}">💬 ${countComments(p.id)}</a>
      ${own ? `<button class="mini ghost" data-act="edit" data-id="${p.id}">✏️ Изменить</button>
               <button class="mini danger" data-act="del" data-id="${p.id}">🗑 Удалить</button>` : ''}
    </div>
  </article>`;
}

/* =========================================================
   5. АВТОРИЗАЦИЯ
   ========================================================= */
let authMode = 'login';

function viewAuth() {
  app.innerHTML = `
  <div class="card" style="max-width:420px;margin:30px auto">
    <h2>${authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
    <form id="authForm" autocomplete="on">
      <label>Логин (3–20 символов, латиница/цифры/_)</label>
      <input name="username" required minlength="3" maxlength="20" autocomplete="username">
      <label>Пароль (минимум 4 символа)</label>
      <input name="password" type="password" required minlength="4" autocomplete="current-password">
      ${authMode === 'register' ? `
        <label>Повторите пароль</label>
        <input name="password2" type="password" required minlength="4">` : ''}
      <div id="authErr" class="err" style="margin-top:10px"></div>
      <div class="row" style="margin-top:14px">
        <button type="submit">${authMode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
        <button type="button" class="ghost" data-act="toggle-auth">
          ${authMode === 'login' ? 'Регистрация' : 'У меня есть аккаунт'}
        </button>
      </div>
    </form>
  </div>`;

  document.getElementById('authForm').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const username = f.username.value.trim();
    const password = f.password.value;
    const errBox = document.getElementById('authErr');
    errBox.textContent = '';

    if (authMode === 'register') {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
        return errBox.textContent = 'Логин: 3–20 символов, только латиница, цифры и _';
      if (password !== f.password2.value)
        return errBox.textContent = 'Пароли не совпадают';
      if (state.users.some(u => u.username.toLowerCase() === username.toLowerCase()))
        return errBox.textContent = 'Такой логин уже занят';

      const user = { id: nid(), username, pwd: hashPwd(password), follows: [],
                     createdAt: Date.now() };
      state.users.push(user);
      state.session = user.id;
      save();
      go('#/feed');
    } else {
      const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user || user.pwd !== hashPwd(password))
        return errBox.textContent = 'Неверный логин или пароль';
      state.session = user.id;
      save();
      go('#/feed');
    }
    router();
  };
}

/* =========================================================
   6. ЛЕНТА ПОДПИСОК
   ========================================================= */
function viewFeed() {
  const u = me();
  if (!u) {
    app.innerHTML = `<div class="card empty">
      <h2>Лента подписок</h2>
      <p>Войдите, чтобы видеть посты пользователей, на которых вы подписаны.</p>
      <a class="btn" href="#/login">Войти</a></div>`;
    return;
  }

  const ids = new Set([...u.follows, u.id]);
  let posts = state.posts.filter(p => p.visibility === 'public' && ids.has(p.authorId));
  posts = sortPosts(posts, ui.sort);

  app.innerHTML = `
    <div class="card">
      <h2>Лента подписок</h2>
      <div class="muted">Вы подписаны на ${u.follows.length} польз. · постов в ленте: ${posts.length}</div>
      <div class="row" style="margin-top:10px">
        <select id="sortSel" style="max-width:260px">
          <option value="new">Новые сначала</option>
          <option value="old">Старые сначала</option>
          <option value="title">По заголовку</option>
          <option value="comments">По комментариям</option>
        </select>
      </div>
    </div>
    ${posts.length ? posts.map(postCard).join('')
                   : '<div class="card empty">Пока пусто. Подпишитесь на кого-нибудь в разделе «Пользователи».</div>'}`;

  const sel = document.getElementById('sortSel');
  sel.value = ui.sort;
  sel.onchange = e => { ui.sort = e.target.value; router(); };
}

/* =========================================================
   7. ПУБЛИЧНЫЕ ПОСТЫ + ФИЛЬТР ПО ТЕГАМ
   ========================================================= */
function viewPublic(tag) {
  if (tag !== null && tag !== undefined) ui.tagFilter = tag;

  const allTags = [...new Set(state.posts
    .filter(p => p.visibility === 'public')
    .flatMap(p => p.tags || []))].sort((a, b) => a.localeCompare(b, 'ru'));

  let posts = state.posts.filter(p => p.visibility === 'public');
  if (ui.tagFilter) posts = posts.filter(p => (p.tags || []).includes(ui.tagFilter));
  posts = sortPosts(posts, ui.sort);

  app.innerHTML = `
    <div class="card">
      <h2>Публичные посты</h2>
      <div class="row">
        <div style="flex:1;min-width:200px">
          <label>Сортировка</label>
          <select id="sortSel">
            <option value="new">Новые сначала</option>
            <option value="old">Старые сначала</option>
            <option value="title">По заголовку (А–Я)</option>
            <option value="comments">По числу комментариев</option>
          </select>
        </div>
        <div style="flex:1;min-width:200px">
          <label>Поиск по заголовку/тексту</label>
          <input id="q" placeholder="например: javascript" value="${esc(ui.q || '')}">
        </div>
      </div>
      <div style="margin-top:12px">
        <span class="muted">Теги:</span>
        <a class="tag" href="#/public" ${!ui.tagFilter ? 'style="background:#6c8cff;color:#fff"' : ''}>все</a>
        ${allTags.map(t => `<a class="tag" href="#/tag/${encodeURIComponent(t)}"
            ${ui.tagFilter === t ? 'style="background:#6c8cff;color:#fff"' : ''}>#${esc(t)}</a>`).join('')}
      </div>
    </div>
    ${posts.length ? posts.map(postCard).join('')
                   : '<div class="card empty">Постов не найдено</div>'}`;

  const sel = document.getElementById('sortSel');
  sel.value = ui.sort;
  sel.onchange = e => { ui.sort = e.target.value; router(); };

  const q = document.getElementById('q');
  q.oninput = e => { ui.q = e.target.value; };
  q.onkeydown = e => { if (e.key === 'Enter') applySearch(); };
  q.onblur = applySearch;

  function applySearch() {
    const term = (ui.q || '').trim().toLowerCase();
    if (!term) return;
    let found = state.posts.filter(p => p.visibility === 'public' &&
      (p.title.toLowerCase().includes(term) || p.content.toLowerCase().includes(term)));
    found = sortPosts(found, ui.sort);
    document.querySelectorAll('#app article.card').forEach(n => n.remove());
    const holder = document.createElement('div');
    holder.innerHTML = found.length ? found.map(postCard).join('')
                                    : '<div class="card empty">Ничего не найдено</div>';
    app.appendChild(holder);
  }
}

/* =========================================================
   8. МОИ ПОСТЫ (включая скрытые)
   ========================================================= */
function viewMy() {
  const u = me();
  if (!u) { go('#/login'); return; }

  const mine = sortPosts(state.posts.filter(p => p.authorId === u.id), ui.sort);
  const hiddenCount = mine.filter(p => p.visibility === 'hidden').length;

  app.innerHTML = `
    <div class="card">
      <h2>Мои посты</h2>
      <div class="muted">Всего: ${mine.length} · скрытых («только по запросу»): ${hiddenCount}</div>
      <div class="row" style="margin-top:10px">
        <a class="btn" href="#/new">+ Новый пост</a>
        <select id="sortSel" style="max-width:240px">
          <option value="new">Новые сначала</option>
          <option value="old">Старые сначала</option>
          <option value="title">По заголовку</option>
          <option value="comments">По комментариям</option>
        </select>
      </div>
    </div>
    ${mine.length ? mine.map(postCard).join('') : '<div class="card empty">Вы ещё не написали ни одного поста</div>'}`;

  const sel = document.getElementById('sortSel');
  sel.value = ui.sort;
  sel.onchange = e => { ui.sort = e.target.value; router(); };
}

/* =========================================================
   9. ПОЛЬЗОВАТЕЛИ И ПОДПИСКИ
   ========================================================= */
function viewUsers() {
  const u = me();
  const list = state.users.slice().sort((a, b) => a.username.localeCompare(b.username, 'ru'));

  app.innerHTML = `
    <div class="card"><h2>Пользователи (${list.length})</h2>
      <div class="muted">Подпишитесь, чтобы посты попадали в вашу ленту.</div>
    </div>
    <div class="users-grid">
      ${list.map(x => {
        const posts = state.posts.filter(p => p.authorId === x.id && p.visibility === 'public').length;
        const followers = state.users.filter(y => y.follows.includes(x.id)).length;
        const isMe = u && u.id === x.id;
        const followed = u && u.follows.includes(x.id);
        return `<div class="card" style="margin:0">
          <h3><a href="#/user/${x.id}">@${esc(x.username)}</a></h3>
          <div class="muted">Публичных постов: ${posts} · Подписчиков: ${followers}</div>
          <div style="margin-top:10px">
            ${isMe ? '<span class="muted">это вы</span>' :
              !u ? `<a class="btn" href="#/login">Войти</a>` :
              followed
                ? `<button class="ghost" data-act="unfollow" data-id="${x.id}">Отписаться</button>`
                : `<button data-act="follow" data-id="${x.id}">Подписаться</button>`}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function viewUser(id) {
  const user = userById(id);
  if (!user) { app.innerHTML = '<div class="card empty">Пользователь не найден</div>'; return; }

  const u = me();
  const isMe = u && u.id === user.id;
  const followed = u && u.follows.includes(user.id);
  const followers = state.users.filter(x => x.follows.includes(user.id)).length;
  const following = user.follows.length;

  const posts = sortPosts(state.posts.filter(p => p.authorId === user.id &&
    (p.visibility === 'public' || isMe)), 'new');

  app.innerHTML = `
    <div class="card">
      <h2>@${esc(user.username)}</h2>
      <div class="muted">Подписчиков: ${followers} · Подписок: ${following} · Постов: ${posts.length}</div>
      <div class="row" style="margin-top:12px">
        ${isMe ? '<a class="btn" href="#/my">Мои посты</a>' :
          !u ? '<a class="btn" href="#/login">Войти, чтобы подписаться</a>' :
          followed
            ? `<button class="ghost" data-act="unfollow" data-id="${user.id}">Отписаться</button>`
            : `<button data-act="follow" data-id="${user.id}">Подписаться</button>`}
      </div>
    </div>
    ${posts.length ? posts.map(postCard).join('')
                   : '<div class="card empty">Публичных постов нет</div>'}`;
}

/* =========================================================
   10. ПРОСМОТР ПОСТА + КОММЕНТАРИИ
   ========================================================= */
function viewPost(id) {
  const p = state.posts.find(x => x.id === id);
  const u = me();

  if (!p) { app.innerHTML = '<div class="card empty">Пост не найден</div>'; return; }

  const isAuthor = u && u.id === p.authorId;

  /* Скрытый пост: в списках не отображается, доступен только по прямой ссылке
     («по запросу»). Автор видит его всегда. */
  if (p.visibility === 'hidden' && !isAuthor) {
    app.innerHTML = `<div class="card">
      <h2>🔒 Пост «только по запросу»</h2>
      <p>Этот пост скрыт из лент и списков. Он доступен только по прямой ссылке.</p>
      <p class="muted">Ссылка-запрос: <code>${location.origin + location.pathname}#/post/${p.id}</code></p>
    </div>`;
    return;
  }

  const author = userById(p.authorId) || { username: 'удалён', id: 0 };
  const comments = state.comments
    .filter(c => c.postId === p.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  app.innerHTML = `
    <article class="card">
      <div class="post-head">
        <a href="#/user/${author.id}">@${esc(author.username)}</a>
        <span>· ${fmt(p.createdAt)}</span>
        ${p.updatedAt ? `<span>· изменён ${fmt(p.updatedAt)}</span>` : ''}
        ${p.visibility === 'hidden' ? '<span class="badge">🔒 только по запросу</span>' : ''}
      </div>
      <h2>${esc(p.title)}</h2>
      <div>${nl2br(p.content)}</div>
      <div style="margin-top:10px">
        ${(p.tags || []).map(t => `<a class="tag" href="#/tag/${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}
      </div>
      ${isAuthor ? `<div class="row" style="margin-top:14px">
        <a class="btn ghost" href="#/edit/${p.id}">✏️ Редактировать</a>
        <button class="danger" data-act="del" data-id="${p.id}">🗑 Удалить</button>
      </div>` : ''}
    </article>

    <div class="card">
      <h3>Комментарии (${comments.length})</h3>
      ${u ? `<form id="cForm">
          <textarea name="text" required placeholder="Ваш комментарий…" style="min-height:80px"></textarea>
          <div style="margin-top:8px"><button type="submit">Отправить</button></div>
        </form>`
        : `<p class="muted">Чтобы комментировать, <a href="#/login">войдите</a>.</p>`}

      <div style="margin-top:14px">
        ${comments.length ? comments.map(c => {
          const cu = userById(c.authorId) || { username: 'удалён', id: 0 };
          const canDel = u && (u.id === c.authorId || u.id === p.authorId);
          return `<div class="comment">
            <div class="meta">
              <a href="#/user/${cu.id}">@${esc(cu.username)}</a>
              <span>${fmt(c.createdAt)}</span>
              ${canDel ? `<button class="mini ghost" data-act="del-comment" data-id="${c.id}">удалить</button>` : ''}
            </div>
            <div>${nl2br(c.text)}</div>
          </div>`;
        }).join('') : '<div class="muted">Комментариев пока нет.</div>'}
      </div>
    </div>`;

  const cf = document.getElementById('cForm');
  if (cf) cf.onsubmit = e => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;
    state.comments.push({ id: nid(), postId: p.id, authorId: u.id,
                          text, createdAt: Date.now() });
    save();
    router();
  };
}

/* =========================================================
   11. РЕДАКТОР ПОСТА
   ========================================================= */
function viewEditor(id) {
  const u = me();
  if (!u) { go('#/login'); return; }

  const p = id ? state.posts.find(x => x.id === id) : null;
  if (id && (!p || p.authorId !== u.id)) {
    app.innerHTML = '<div class="card empty">Пост не найден или нет прав на редактирование</div>';
    return;
  }

  app.innerHTML = `
    <div class="card">
      <h2>${p ? 'Редактирование поста' : 'Новый пост'}</h2>
      <form id="postForm">
        <label>Заголовок</label>
        <input name="title" required maxlength="120" value="${p ? esc(p.title) : ''}">

        <label>Текст</label>
        <textarea name="content" required>${p ? esc(p.content) : ''}</textarea>

        <label>Теги (через запятую или пробел, максимум 8)</label>
        <input name="tags" placeholder="javascript, web, заметки"
               value="${p ? esc((p.tags || []).join(', ')) : ''}">

        <label>Видимость</label>
        <select name="visibility">
          <option value="public" ${!p || p.visibility === 'public' ? 'selected' : ''}>
            Публичный — виден всем в лентах</option>
          <option value="hidden" ${p && p.visibility === 'hidden' ? 'selected' : ''}>
            Скрытый «только по запросу» — доступен только по прямой ссылке</option>
        </select>

        <div id="postErr" class="err" style="margin-top:10px"></div>

        <div class="row" style="margin-top:16px">
          <button type="submit">${p ? 'Сохранить' : 'Опубликовать'}</button>
          <a class="btn ghost" href="${p ? '#/post/' + p.id : '#/feed'}">Отмена</a>
        </div>
      </form>
    </div>`;

  document.getElementById('postForm').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const title = f.title.value.trim();
    const content = f.content.value.trim();
    const visibility = f.visibility.value;
    const tags = [...new Set(f.tags.value
      .split(/[,\s]+/)
      .map(t => t.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean))].slice(0, 8);

    if (title.length < 3) {
      document.getElementById('postErr').textContent = 'Заголовок слишком короткий';
      return;
    }

    if (p) {
      Object.assign(p, { title, content, tags, visibility, updatedAt: Date.now() });
      save();
      go('#/post/' + p.id);
    } else {
      const np = { id: nid(), authorId: u.id, title, content, tags, visibility,
                   createdAt: Date.now(), updatedAt: null };
      state.posts.push(np);
      save();
      go('#/post/' + np.id);
    }
    router();
  };
}

/* =========================================================
   12. ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
   ========================================================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = +el.dataset.id;
  const u = me();

  if (act === 'logout') {
    state.session = null; save(); go('#/feed'); router();
  }
  else if (act === 'toggle-auth') {
    authMode = authMode === 'login' ? 'register' : 'login';
    viewAuth();
  }
  else if (act === 'follow' && u) {
    if (!u.follows.includes(id)) u.follows.push(id);
    save(); router();
  }
  else if (act === 'unfollow' && u) {
    u.follows = u.follows.filter(x => x !== id);
    save(); router();
  }
  else if (act === 'edit') {
    go('#/edit/' + id);
  }
  else if (act === 'del') {
    if (!confirm('Удалить пост вместе с комментариями?')) return;
    state.posts = state.posts.filter(p => p.id !== id);
    state.comments = state.comments.filter(c => c.postId !== id);
    save();
    go('#/my'); router();
  }
  else if (act === 'del-comment') {
    state.comments = state.comments.filter(c => c.id !== id);
    save(); router();
  }
});

window.addEventListener('hashchange', router);

/* Старт */
router();