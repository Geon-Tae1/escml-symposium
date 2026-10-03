(function () {
  var NAV = [
    { id: 'index',       label: '홈' },
    { id: 'schedule',    label: '준비 일정표' },
    { id: 'alumni',      label: '동문 명단' },
    { id: 'calendar',    label: '달력' },
    { id: 'program',     label: '프로그램' }
  ];

  /* 층상 산화물 결정을 본뜬 인장(印章) — 선양국 교수님의 평생 연구 주제 */
  var SEAL =
    '<svg class="seal" viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
    '<rect x="1" y="1" width="38" height="38" rx="9" fill="var(--sym)"/>' +
    '<g stroke="#fff" stroke-width="1.2" stroke-linecap="round">' +
    '<path d="M8 13.5h24M8 20h24M8 26.5h24" opacity=".42"/>' +
    '<path d="M11 10.6l3.4 2.9-3.4 2.9-3.4-2.9z" opacity=".9"/>' +
    '<path d="M20 17.1l3.4 2.9-3.4 2.9-3.4-2.9z" opacity=".9"/>' +
    '<path d="M29 23.6l3.4 2.9-3.4 2.9-3.4-2.9z" opacity=".9"/>' +
    '</g>' +
    '<circle cx="20" cy="13.5" r="1.5" fill="#fff"/><circle cx="29" cy="20" r="1.5" fill="#fff"/>' +
    '<circle cx="11" cy="26.5" r="1.5" fill="#fff"/></svg>';

  var BARS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  var cur = document.body.getAttribute('data-page') || 'index';

  var links = NAV.map(function (n) {
    return '<a href="' + n.id + '.html" data-nav="' + n.id + '"' +
      (n.id === cur ? ' class="active"' : '') + '>' + n.label + '</a>';
  }).join('');

  var head = document.getElementById('site-header');
  if (head) head.innerHTML =
    '<header class="nav"><div class="nav-in">' +
    '<a class="brand" href="index.html">' + SEAL +
    '<span class="bt"><b>선양국 교수님 정년퇴임 기념 심포지엄</b>' +
    '<span>Hanyang University · ESCML</span></span></a>' +
    '<nav class="nav-links" id="menu">' + links + '</nav>' +
    '<div class="nav-right"><button class="icon-btn menu-btn" id="menu-btn" aria-label="메뉴" ' +
    'aria-expanded="false">' + BARS + '</button></div>' +
    '</div></header>';

  var foot = document.getElementById('site-footer');
  if (foot) foot.innerHTML =
    '<footer><div class="wrap foot-in">' +
    '<div class="fl">선양국 교수님 정년퇴임 기념 심포지엄</div>' +
    '<div class="fr">한양대학교 서울캠퍼스 · 2027</div>' +
    '</div></footer>';

  /* 모바일 메뉴 — 연구실 홈페이지와 같은 동작 */
  var mb = document.getElementById('menu-btn'), menu = document.getElementById('menu');
  function placeMenu() {
    if (!menu) return;
    var h = document.querySelector('header.nav');
    var top = h ? Math.round(h.getBoundingClientRect().bottom) + 8 : 74;
    menu.style.setProperty('--menu-top', Math.max(8, top) + 'px');
  }
  if (mb) mb.addEventListener('click', function () {
    var open = !menu.classList.contains('open');
    if (open) { placeMenu(); menu.classList.add('open'); menu.scrollTop = 0; }
    else menu.classList.remove('open');
    mb.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  if (menu) menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) { menu.classList.remove('open'); if (mb) mb.setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('resize', function () {
    if (menu && menu.classList.contains('open')) placeMenu();
  }, { passive: true });

  /* 스크롤 등장 효과
     threshold 는 반드시 0 이어야 한다. 0.1 로 두면 화면보다 긴 요소 — 동문 명단처럼
     카드가 100장 넘게 쌓인 표 — 는 10%가 한 번도 보이지 않아 영영 나타나지 않는다. */
  function revealAll() {
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { el.classList.add('in'); });
  }
  var els = document.querySelectorAll('.reveal:not(.in)');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
    /* 안전장치 — 무슨 이유로든 관찰이 동작하지 않으면 그냥 보여 준다 */
    setTimeout(revealAll, 1500);
  } else {
    revealAll();
  }
  window.SYMUI_revealAll = revealAll;

  /* ---- 공통 도우미 ---- */
  var W = window;
  W.SYMUI = {
    el: function (t, a, k) {
      var e = document.createElement(t);
      if (a) for (var q in a) {
        if (q === 'class') e.className = a[q];
        else if (q === 'html') e.innerHTML = a[q];
        else if (q.slice(0, 2) === 'on') e.addEventListener(q.slice(2), a[q]);
        else if (a[q] != null) e.setAttribute(q, a[q]);
      }
      (k || []).forEach(function (c) {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
      return e;
    },
    fmt: function (iso) {
      var p = String(iso).split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
      return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'[d.getDay()] + ')';
    }
  };
})();
