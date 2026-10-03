(function () {
  var D = window.SYM, el = window.SYMUI.el;
  if (!D) return;

  /* 인원 수 */
  var al = D.people.filter(function (p) { return p.kind === '동문'; }).length;
  var cu = D.people.length - al;
  var a = document.getElementById('n-alumni'), c = document.getElementById('n-current');
  if (a) a.textContent = al + '명';
  if (c) c.textContent = cu + '명';

  /* 날짜 후보 */
  var box = document.getElementById('pick');
  if (!box) return;
  D.cands.forEach(function (k, i) {
    box.appendChild(el('div', { class: 'row' + (i === 0 ? ' top' : '') }, [
      el('div', { class: 'sytag' }, [k.tag]),
      el('div', {}, [
        el('div', { class: 'd' }, [k.label, el('span', { class: 'dow' }, [k.dow])]),
        el('div', { class: 'why' }, [k.why]),
        el('div', { class: 'risk' }, [el('b', {}, ['살펴볼 점 — ']), k.risk])
      ])
    ]));
  });
})();
