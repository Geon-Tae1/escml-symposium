/* ============================================================
   표시 기록을 GitHub 비공개 Gist 에 저장한다.

   왜 Gist 인가 —
   이 사이트는 GitHub Pages 정적 호스팅이라 서버 코드를 돌릴 수 없다.
   저장소에 직접 커밋하면 클릭 한 번마다 커밋이 쌓여 이력이 지저분해지고,
   참석 여부 같은 기록이 공개 저장소에 그대로 남는다.
   Gist 는 비공개로 만들 수 있고 API 로 바로 덮어쓸 수 있어 둘 다 피한다.

   쓰는 사람이 한 명뿐이라 충돌 처리는 두지 않았다. 나중에 저장한 쪽이 이긴다.
   토큰은 이 브라우저에만 남으며, gist 권한만 가진 토큰을 쓰도록 안내한다.
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var T_KEY = 'escml_gh_token';
  var G_KEY = 'escml_gist_id';
  var A_KEY = 'escml_sync_at';
  var FILE = 'escml-state.json';
  var DESC = 'ESCML symposium — roster state (do not delete)';

  /* 함께 묶어 저장할 localStorage 키 */
  var KEYS = ['escml_att', 'escml_ctok', 'escml_cal'];

  var listeners = [];
  var onPull = null;
  var timer = null;
  var busy = false;
  var again = false;
  var last = '';

  function ls(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function ldel(k) { try { localStorage.removeItem(k); } catch (_) {} }

  function token() { return ls(T_KEY) || ''; }
  function gistId() { return ls(G_KEY) || ''; }

  function status(kind, text) {
    last = kind;
    listeners.forEach(function (f) { f(kind, text || ''); });
  }

  function hhmm(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function req(path, opt) {
    opt = opt || {};
    opt.cache = 'no-store';
    opt.headers = {
      'Authorization': 'Bearer ' + token(),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opt.body) opt.headers['Content-Type'] = 'application/json';
    return fetch(API + path, opt).then(function (r) {
      if (r.status === 401) throw new Error('토큰이 올바르지 않거나 만료되었습니다');
      if (r.status === 403) throw new Error('GitHub 가 요청을 막았습니다 (권한 또는 횟수 제한)');
      if (!r.ok) throw new Error('GitHub 응답 ' + r.status);
      return r.json();
    });
  }

  /* ---------- 로컬 기록 ---------- */
  function snap() {
    var o = { v: 1, updatedAt: ls(A_KEY) || '', data: {} };
    KEYS.forEach(function (k) {
      var raw = ls(k);
      try { o.data[k] = raw == null ? null : JSON.parse(raw); } catch (_) { o.data[k] = null; }
    });
    return o;
  }

  function apply(s) {
    if (!s || !s.data) return;
    KEYS.forEach(function (k) {
      if (s.data[k] == null) return;
      lset(k, JSON.stringify(s.data[k]));
    });
    lset(A_KEY, s.updatedAt || '');
  }

  function body(s) {
    var f = {};
    f[FILE] = { content: JSON.stringify(s, null, 2) };
    return JSON.stringify({ description: DESC, files: f });
  }

  function parse(g) {
    try {
      var f = g && g.files && g.files[FILE];
      if (!f || f.truncated || !f.content) return null;
      return JSON.parse(f.content);
    } catch (_) { return null; }
  }

  /* ---------- Gist 찾기 / 만들기 ---------- */
  function findGist() {
    var pages = [1, 2];
    var i = 0;
    function step() {
      if (i >= pages.length) return null;
      return req('/gists?per_page=100&page=' + pages[i++]).then(function (list) {
        if (!list || !list.length) return null;
        for (var j = 0; j < list.length; j++) {
          if (list[j].description === DESC) return list[j].id;
        }
        return step();
      });
    }
    return step();
  }

  function ensureGist() {
    var id = gistId();
    if (id) return Promise.resolve(id);
    return findGist().then(function (found) {
      if (found) { lset(G_KEY, found); return found; }
      var s = snap();
      s.updatedAt = s.updatedAt || new Date().toISOString();
      return req('/gists', { method: 'POST', body: body(s) }).then(function (g) {
        lset(G_KEY, g.id);
        lset(A_KEY, s.updatedAt);
        return g.id;
      });
    });
  }

  /* ---------- 올리기 ---------- */
  function upload() {
    if (busy) { again = true; return Promise.resolve(); }
    busy = true;
    status('saving');
    var s = snap();
    s.updatedAt = new Date().toISOString();
    return ensureGist().then(function (id) {
      return req('/gists/' + id, { method: 'PATCH', body: body(s) });
    }).then(function () {
      lset(A_KEY, s.updatedAt);
      busy = false;
      if (again) { again = false; return upload(); }
      status('ok', hhmm(s.updatedAt));
    }).catch(function (e) {
      busy = false; again = false;
      status('err', e.message || '저장하지 못했습니다');
    });
  }

  /* ---------- 공개 API ---------- */
  var SYNC = {
    on: function () { return !!token(); },

    watch: function (fn) { listeners.push(fn); fn(last || (token() ? 'loading' : 'off'), ''); },

    /* 화면을 다시 그려야 할 때 부를 함수 */
    bind: function (fn) { onPull = fn; },

    /* 켜져 있으면 원격을 읽어 최신 쪽을 따른다 */
    start: function () {
      if (!token()) { status('off'); return Promise.resolve(); }
      status('loading');
      return ensureGist().then(function (id) {
        return req('/gists/' + id);
      }).then(function (g) {
        var remote = parse(g);
        var mine = snap();
        if (remote && (remote.updatedAt || '') > (mine.updatedAt || '')) {
          apply(remote);
          if (onPull) onPull();
          status('ok', hhmm(remote.updatedAt));
        } else if (!remote || JSON.stringify(remote.data) !== JSON.stringify(mine.data)) {
          return upload();
        } else {
          status('ok', hhmm(mine.updatedAt));
        }
      }).catch(function (e) {
        status('err', e.message || '불러오지 못했습니다');
      });
    },

    /* 바뀔 때마다 부른다. 연달아 눌러도 한 번만 올라간다. */
    push: function () {
      if (!token()) return;
      status('saving');
      clearTimeout(timer);
      timer = setTimeout(upload, 900);
    },

    retry: function () { clearTimeout(timer); return upload(); },

    connect: function (tok) {
      tok = String(tok || '').trim();
      if (!tok) return Promise.reject(new Error('토큰을 넣어 주십시오'));
      lset(T_KEY, tok);
      ldel(G_KEY);
      return SYNC.start().then(function () {
        if (last === 'err') { ldel(T_KEY); throw new Error('연결하지 못했습니다'); }
      });
    },

    disconnect: function () {
      ldel(T_KEY); ldel(G_KEY);
      status('off');
    },

    /* 기록을 지우지 않고 이 브라우저에서만 끊는다 */
    where: function () { return gistId(); },

    /* ---------- 화면 ---------- */
    mount: function (id) {
      var el = window.SYMUI && window.SYMUI.el;
      var box = document.getElementById(id);
      if (!el || !box) return;

      function panel(msg) {
        box.className = 'sync s-setup';
        box.innerHTML = '';
        var inp = el('input', { type: 'password', autocomplete: 'off', spellcheck: 'false',
          placeholder: 'ghp_ 로 시작하는 토큰을 붙여넣으십시오', 'aria-label': 'GitHub 토큰' });
        var go = el('button', { class: 'btn btn-sym btn-sm', type: 'submit' }, ['연결']);
        box.appendChild(el('div', { class: 'h' }, ['기기 간 저장 켜기']));
        box.appendChild(el('p', { class: 'd', html:
          '표시한 기록을 <b>교수님 GitHub 계정의 비공개 Gist</b> 한 곳에 저장합니다. ' +
          '노트북에서 체크한 내용이 휴대폰에서도 그대로 보입니다.<br>' +
          '<a href="' + TOKURL + '" target="_blank" rel="noopener">여기를 눌러 토큰을 만든 뒤</a> ' +
          '— gist 권한만 미리 선택되어 있습니다 — 맨 아래 <b>Generate token</b> 을 누르고, ' +
          '나오는 문자열을 아래에 붙여넣으십시오. 이 토큰으로는 Gist 말고는 아무것도 할 수 없고, ' +
          '토큰은 이 브라우저에만 남습니다.' }));
        box.appendChild(el('form', { onsubmit: function (e) {
          e.preventDefault();
          go.disabled = true; go.textContent = '연결 중…';
          SYNC.connect(inp.value).catch(function (ex) {
            panel(ex && ex.message ? ex.message : '연결하지 못했습니다');
          });
        } }, [inp, go]));
        box.appendChild(el('div', { class: 'e' }, [msg || '']));
        inp.focus();
      }

      SYNC.watch(function (kind, text) {
        box.className = 'sync s-' + kind;
        box.innerHTML = '';
        var msg, act = null;
        if (kind === 'off') {
          msg = '표시한 내용이 이 브라우저에만 저장되고 있습니다. 다른 기기에서는 보이지 않습니다.';
          act = el('button', { class: 'btn btn-sym btn-sm', type: 'button',
            onclick: function () { panel(''); } }, ['기기 간 저장 켜기']);
        } else if (kind === 'loading') {
          msg = '저장해 둔 기록을 불러오는 중입니다…';
        } else if (kind === 'saving') {
          msg = '저장하는 중…';
        } else if (kind === 'ok') {
          msg = '저장됨 · ' + text + ' — 다른 기기에서 열어도 그대로 보입니다.';
          act = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () {
            if (confirm('이 브라우저에서만 연결을 끊습니다. 저장해 둔 기록은 지워지지 않습니다.'))
              SYNC.disconnect();
          } }, ['이 브라우저에서 끄기']);
        } else {
          msg = '저장하지 못했습니다 — ' + text;
          act = SYNC.on()
            ? el('button', { class: 'btn btn-sym btn-sm', type: 'button',
                onclick: function () { SYNC.retry(); } }, ['다시 시도'])
            : el('button', { class: 'btn btn-sym btn-sm', type: 'button',
                onclick: function () { panel(''); } }, ['토큰 다시 넣기']);
        }
        box.appendChild(el('span', { class: 'dot' }));
        box.appendChild(el('span', { class: 'm' }, [msg]));
        if (act) box.appendChild(act);
      });
    }
  };

  var TOKURL = 'https://github.com/settings/tokens/new?scopes=gist&description=ESCML+symposium';

  window.SYMSYNC = SYNC;
})();
