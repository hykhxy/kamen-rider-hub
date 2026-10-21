// owner: codex-home — 全量图库：类别/时代/系列/关键词 + 无限滚动 + 灯箱 + 计数校验
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};

  var BATCH = 120;    // 契约 §8：每批 ≤120
  var MAX_IMG = 400;  // 契约 §8：同时挂载的 img ≤400
  var PAD = 900;      // 视口外多少像素仍算热点（图片保留、不回收）

  var CATS = [
    { key: 'rider', label: '骑士', src: 'riders', lazy: '' },
    { key: 'form', label: '形态', src: 'forms', lazy: '' },
    { key: 'char', label: '人物', src: 'chars', lazy: 'data/img-chars.js' },
    { key: 'monster', label: '怪人', src: 'monsters', lazy: 'data/img-monsters.js' },
    { key: 'item', label: '道具', src: 'items', lazy: 'data/img-items.js' }
  ];
  var ERAS = ['昭和', '平成', '令和', '未归类'];

  var S = null;

  function H() { return global.KRH.apply(global, arguments); }
  function D() { return global.KRD; }
  function IMG() { return global.KRIMG; }
  function str(v) { return String(v == null ? '' : v); }

  function num(n) {
    var d = D();
    return d && d.fmtNum ? d.fmtNum(n) : str(n);
  }

  // 数据里有 28 条只有原名没有中文名，显示层做一次回退，别让格子空标题
  function labelOf(rec) {
    var cn = str(rec.n);
    var jp = str(rec.j);
    return { name: cn || jp || ('#' + str(rec.i)), sub: cn ? jp : '' };
  }

  function pad(n) {
    var s = str(n);
    while (s.length < 4) s = '0' + s;
    return s;
  }

  function imgList(key) {
    var api = global.KR && global.KR.IMG;
    return (api && api[key]) || null;
  }

  function totals() {
    var sum = 0, known = 0;
    for (var i = 0; i < CATS.length; i++) {
      var l = imgList(CATS[i].src);
      if (l) { sum += l.length; known += 1; }
    }
    return { sum: sum, known: known, all: known === CATS.length };
  }

  function catOf(key) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return CATS[i];
    return null;
  }

  function catNow() { return (S && catOf(S.cat)) || CATS[0]; }

  function viewportH() { return Number(global.innerHeight) || 900; }

  function scrollY() {
    var y = global.scrollY;
    if (y == null) y = global.pageYOffset;
    return Number(y) || 0;
  }

  function seriesName(s) {
    var W = global.KR && global.KR.WORLD;
    var list = (W && W.series) || [];
    for (var i = 0; i < list.length; i++) if (Number(list[i].i) === Number(s)) return str(list[i].name);
    return '未归类';
  }

  // ── 顶栏：类别 / 时代 / 系列 / 搜索 / 计数 ───────────────
  function tabHandler(key) { return function () { selectCat(key); }; }

  function eraHandler(era) {
    return function () {
      if (!S || S.dead || S.era === era) return;
      S.era = era;
      paintChips();
      render({});
    };
  }

  function seriesHandler() {
    if (!S || S.dead || !S.sel) return;
    var v = S.sel.value;
    S.series = (v == null || v === '') ? '' : str(v);
    render({});
  }

  function toolbar() {
    var bar = H('div.cx-bar');

    var tabs = H('div.cx-tabs', { role: 'tablist', 'aria-label': '图像类别' });
    S.tabEls = {};
    S.tabCount = {};
    for (var i = 0; i < CATS.length; i++) {
      var c = CATS[i];
      var b = H('button.cx-tab', { type: 'button', role: 'tab', 'data-cat': c.key });
      b.appendChild(H('span.cx-tab-lbl', { text: c.label }));
      var n = H('b.cx-tab-n.tnum');
      n.textContent = '…';
      b.appendChild(n);
      b.addEventListener('click', tabHandler(c.key));
      tabs.appendChild(b);
      S.tabEls[c.key] = b;
      S.tabCount[c.key] = n;
    }
    bar.appendChild(tabs);

    var filters = H('div.cx-filters');

    var chips = H('div.cx-chips', { role: 'group', 'aria-label': '时代筛选' });
    S.chipEls = {};
    var allChip = H('button.cx-chip', { type: 'button', 'data-era': '', 'aria-pressed': 'true' }, '全部');
    allChip.addEventListener('click', eraHandler(''));
    chips.appendChild(allChip);
    S.chipEls[''] = allChip;
    for (var j = 0; j < ERAS.length; j++) {
      var chip = H('button.cx-chip', { type: 'button', 'data-era': ERAS[j], 'aria-pressed': 'false' }, ERAS[j]);
      chip.addEventListener('click', eraHandler(ERAS[j]));
      chips.appendChild(chip);
      S.chipEls[ERAS[j]] = chip;
    }
    filters.appendChild(chips);

    var sel = H('select.sel.cx-sel', { 'aria-label': '系列筛选' });
    sel.appendChild(H('option', { value: '' }, '全部系列'));
    var W = global.KR && global.KR.WORLD;
    var series = (W && W.series) || [];
    for (var k = 0; k < series.length; k++) {
      sel.appendChild(H('option', { value: str(series[k].i) }, str(series[k].name) + '（' + str(series[k].year) + '）'));
    }
    sel.addEventListener('change', seriesHandler);
    filters.appendChild(sel);
    S.sel = sel;

    var q = H('input.ipt.cx-q', { type: 'search', placeholder: '中文名 / 原名 / ID', 'aria-label': '关键词搜索' });
    filters.appendChild(q);
    S.qEl = q;
    S.offs.push(D().on(q, 'input', D().debounce(function () {
      if (!S || S.dead) return;
      S.q = str(q.value).replace(/^\s+/, '').replace(/\s+$/, '');
      render({});
    }, 170)));

    var count = H('div.cx-count');
    filters.appendChild(count);
    S.countEl = count;

    bar.appendChild(filters);
    return bar;
  }

  function paintChips() {
    if (!S || !S.chipEls) return;
    for (var k in S.chipEls) {
      if (!Object.prototype.hasOwnProperty.call(S.chipEls, k)) continue;
      S.chipEls[k].setAttribute('aria-pressed', k === S.era ? 'true' : 'false');
    }
  }

  function paintTabs() {
    if (!S) return;
    for (var i = 0; i < CATS.length; i++) {
      var c = CATS[i];
      var el = S.tabEls && S.tabEls[c.key];
      if (el) el.setAttribute('aria-selected', c.key === S.cat ? 'true' : 'false');
      var n = S.tabCount && S.tabCount[c.key];
      if (!n) continue;
      var list = imgList(c.src);
      n.textContent = list ? num(list.length) : '…';
    }
  }

  function paintCount(cur) {
    if (!S || !S.countEl) return;
    var t = totals();
    D().clear(S.countEl);
    S.countEl.appendChild(H('span', { text: '当前筛选 ' }));
    S.countEl.appendChild(H('b.tnum', { text: num(cur) }));
    S.countEl.appendChild(H('span', { text: ' 张 ／ ' }));
    if (t.all) {
      S.countEl.appendChild(H('span', { text: '全库 ' }));
      S.countEl.appendChild(H('b.tnum', { text: num(t.sum) }));
      S.countEl.appendChild(H('span', { text: ' 张' }));
    } else {
      S.countEl.appendChild(H('span', { text: '已载入 ' }));
      S.countEl.appendChild(H('b.tnum', { text: num(t.sum) }));
      S.countEl.appendChild(H('span', { text: ' 张（其余按需）' }));
    }
    paintVerify();
  }

  // 校验条的数字全部来自数组长度，没有一处写死
  function paintVerify() {
    if (!S || !S.verify) return;
    var t = totals();
    D().clear(S.verify);
    var line = H('span.cx-vline');
    for (var i = 0; i < CATS.length; i++) {
      var list = imgList(CATS[i].src);
      if (i) line.appendChild(H('i.cx-vdot', { text: '·' }));
      var item = H('span.cx-vitem');
      item.appendChild(H('em', { text: CATS[i].label }));
      item.appendChild(H('b.tnum', { text: list ? num(list.length) : '—' }));
      line.appendChild(item);
    }
    S.verify.appendChild(line);

    var eq = H('span.cx-veq');
    eq.appendChild(H('em', { text: '＝' }));
    eq.appendChild(H('b.tnum', { text: num(t.sum) }));
    eq.appendChild(H('span', { text: ' 张' }));
    S.verify.appendChild(eq);

    S.verify.setAttribute('data-sum', str(t.sum));
    S.verify.setAttribute('data-complete', t.all ? '1' : '0');
    if (!t.all) S.verify.appendChild(H('span.cx-vnote', { text: '（' + num(CATS.length - t.known) + ' 张索引按需载入中）' }));
  }

  // ── 网格 ─────────────────────────────────────────────────
  function cellPick(index) { return function () { openLightbox(index); }; }

  function cell(rec, index) {
    var lb = labelOf(rec);
    var btn = H('button.cx-cell', {
      type: 'button', 'data-i': str(index), 'data-id': str(rec.i),
      'aria-label': lb.name + (lb.sub ? ' ' + lb.sub : '')
    });
    // 高密度网格一律 .plate--flat（关光效），比例与 contain 归我这边
    var plate = H('span.plate.plate--flat.cx-slot');
    var cap = H('span.plate-cap.cx-cap');
    cap.appendChild(H('i.cx-no.tnum', { text: pad(index + 1) }));
    cap.appendChild(H('b.cx-name', { text: lb.name }));
    plate.appendChild(cap);
    btn.appendChild(plate);
    var meta = H('span.cx-meta');
    meta.appendChild(H('b', { text: lb.sub || lb.name }));
    meta.appendChild(H('i', { text: str(rec.y) + ' · ' + str(rec.e) }));
    btn.appendChild(meta);
    btn.addEventListener('click', cellPick(index));
    return btn;
  }

  function filter(list) {
    var out = [];
    var era = S.era;
    var ser = S.series === '' ? -1 : Number(S.series);
    var q = S.q.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (era && str(r.e) !== era) continue;
      if (ser >= 0 && Number(r.s) !== ser) continue;
      if (q) {
        if (str(r.n).toLowerCase().indexOf(q) < 0 &&
            str(r.j).toLowerCase().indexOf(q) < 0 &&
            str(r.i) !== S.q) continue;
      }
      out.push(r);
    }
    return out;
  }

  function emptyState() {
    return H('div.empty', { 'data-cx-empty': '1' },
      H('b', { text: '该组合下没有图像' }),
      H('span', { text: '清掉时代或系列筛选，或换个关键词。' })
    );
  }

  function skeleton() {
    var box = H('div.cx-grid-sk', { 'aria-hidden': 'true' });
    for (var i = 0; i < 24; i++) {
      box.appendChild(H('div.cx-cell.is-sk', {}, H('span.cx-slot', {}, H('i.skel'))));
    }
    return box;
  }

  function setSentinel(text) {
    if (!S || !S.sentinel) return;
    D().clear(S.sentinel);
    S.sentinel.appendChild(H('span', { text: text }));
  }

  function batchRect(b) {
    if (!b.cells.length) return null;
    var first = b.cells[0];
    var last = b.cells[b.cells.length - 1];
    if (!first.getBoundingClientRect || !last.getBoundingClientRect) return null;
    var a = first.getBoundingClientRect();
    var z = last.getBoundingClientRect();
    if (!a || !z) return null;
    if (!a.height && !z.height) return null;
    return { top: a.top, bottom: z.bottom };
  }

  function mountBatch(b) {
    if (!S || S.dead) return;
    var list = S.list;
    for (var i = 0; i < b.cells.length; i++) {
      var cellEl = b.cells[i];
      var slot = cellEl.querySelector('.cx-slot');
      // .plate 里已经有 .plate-cap，判空要看有没有 img，不能看 firstChild
      if (!slot || slot.querySelector('img')) continue;
      var rec = list[Number(cellEl.getAttribute('data-i'))];
      if (!rec || !rec.p) continue;
      var im = H('img', {
        'data-kr-img': str(rec.p), 'data-kr-thumb': '1',
        alt: labelOf(rec).name, width: '240', height: '320'
      });
      // 图放在 cap 之前，保持 .plate 的既有 DOM 次序；绝对定位下视觉等价
      if (slot.insertBefore) slot.insertBefore(im, slot.firstChild || null);
      else slot.appendChild(im);
    }
    b.mounted = true;
    S.mounted += b.cells.length;
    IMG().observe(b.el);
    S.root.setAttribute('data-mounted', str(S.mounted));
  }

  function unmountBatch(b) {
    if (!S) return;
    for (var i = 0; i < b.cells.length; i++) {
      var slot = b.cells[i].querySelector('.cx-slot');
      if (!slot) continue;
      // 只拆 img，.plate-cap 是常量说明条，必须留着
      var imgs = slot.querySelectorAll('img');
      for (var k = 0; k < imgs.length; k++) slot.removeChild(imgs[k]);
    }
    b.mounted = false;
    S.mounted = Math.max(0, S.mounted - b.cells.length);
    S.root.setAttribute('data-mounted', str(S.mounted));
  }

  function appendBatch() {
    if (!S || S.dead) return false;
    var from = S.shown;
    var to = Math.min(from + BATCH, S.list.length);
    if (from >= to) return false;

    var el = H('div.cx-batch', { 'data-from': str(from) });
    var cells = [];
    for (var i = from; i < to; i++) {
      var c = cell(S.list[i], i);
      cells.push(c);
      el.appendChild(c);
    }
    S.grid.appendChild(el);
    S.shown = to;

    var b = { el: el, cells: cells, from: from, mounted: false };
    S.batches.push(b);
    // 硬上限：先扣掉命中预算的批次再挂，任何时候都不越过 400 张
    if (S.mounted + cells.length > MAX_IMG) sweep();
    if (S.mounted + cells.length <= MAX_IMG) mountBatch(b);

    setSentinel(S.shown >= S.list.length
      ? '已到末尾 · 共 ' + num(S.list.length) + ' 张'
      : '已载入 ' + num(S.shown) + ' / ' + num(S.list.length) + ' · 继续滚动');
    return true;
  }

  function sweep() {
    if (!S || S.dead) return;
    var vh = viewportH();
    for (var i = 0; i < S.batches.length; i++) {
      var b = S.batches[i];
      if (!b.mounted) continue;
      var box = batchRect(b);
      if (!box) continue;
      if (box.bottom < -PAD || box.top > vh + PAD) unmountBatch(b);
    }
  }

  function hydrate() {
    if (!S || S.dead) return;
    var vh = viewportH();
    for (var i = 0; i < S.batches.length; i++) {
      var b = S.batches[i];
      if (b.mounted) continue;
      if (S.mounted + b.cells.length > MAX_IMG) continue;
      var box = batchRect(b);
      if (box && (box.bottom < -PAD || box.top > vh + PAD)) continue;
      mountBatch(b);
    }
  }

  function maybeMore() {
    if (!S || S.dead || S.shown >= S.list.length) return;
    var sn = S.sentinel;
    if (!sn || !sn.getBoundingClientRect) return;
    var guard = 0;
    while (guard < 4) {
      var r = sn.getBoundingClientRect();
      if (!r) break;
      if (r.top > viewportH() + 700) break;
      if (guard > 0 && r.top > viewportH() + 420) break;
      if (!appendBatch()) break;
      guard += 1;
      if (S.shown >= S.list.length) break;
    }
    hydrate();
  }

  function render(opts) {
    if (!S || S.dead) return;
    opts = opts || {};
    var cat = catNow();
    paintTabs();
    S.root.setAttribute('data-cat', cat.key);
    D().clear(S.grid);
    S.batches = [];
    S.shown = 0;
    S.mounted = 0;
    S.root.setAttribute('data-mounted', '0');

    var src = imgList(cat.src);
    if (!src) {
      S.list = [];
      S.grid.appendChild(skeleton());
      paintCount(0);
      setSentinel('正在载入 ' + cat.label + ' 索引…');
      ensure(cat.key);
      return;
    }

    S.list = filter(src);
    paintCount(S.list.length);

    if (!S.list.length) {
      S.grid.appendChild(emptyState());
      setSentinel('该组合无图像');
      return;
    }

    var want = Math.max(1, opts.batches || 1);
    for (var i = 0; i < want; i++) if (!appendBatch()) break;
    hydrate();
    if (opts.scrollTo != null) {
      try { global.scrollTo(0, opts.scrollTo); } catch (e) {}
    }
  }

  function selectCat(key) {
    if (!S || S.dead || key === S.cat) return;
    var now = S.cat;
    S.mem[now] = { y: scrollY(), shown: S.shown };
    S.cat = key;
    paintTabs();

    var cat = catOf(key) || CATS[0];
    var src = imgList(cat.src);
    if (!src) {
      render({});
      return;
    }
    var mem = S.mem[key] || null;
    var batches = mem ? Math.ceil(mem.shown / BATCH) : 1;
    if (batches < 1) batches = 1;
    if (batches > 40) batches = 40;
    render({ batches: batches, scrollTo: mem ? mem.y : 0 });
  }

  // ── 按需数据 ─────────────────────────────────────────────
  function ensure(key) {
    var cat = catOf(key);
    if (!cat || !cat.lazy) return Promise.resolve(true);
    if (imgList(cat.src)) return Promise.resolve(true);
    if (!S || S.dead) return Promise.resolve(false);
    if (S.loading[key]) return S.loading[key];

    var p;
    try { p = KR.load(cat.lazy); } catch (e) { return Promise.resolve(false); }
    S.loading[key] = p.then(function () {
      return !!imgList(cat.src);
    }, function () {
      return false;
    }).then(function (ok) {
      afterLoad(key, ok);
      return ok;
    });
    return S.loading[key];
  }

  function afterLoad(key) {
    if (!S || S.dead) return;
    paintTabs();
    paintVerify();
    paintCount(S.list.length);
    if (catNow().key === key) render({});
  }

  function loadLazyAll() {
    var keys = ['char', 'monster', 'item'];
    var i = 0;
    function step() {
      if (!S || S.dead || i >= keys.length) return;
      var key = keys[i];
      i += 1;
      ensure(key).then(step, step);
    }
    S.timers.push(setTimeout(step, 420));
  }

  // ── 灯箱 ─────────────────────────────────────────────────
  function closeLightbox() {
    if (S && S.lb) {
      var h = S.lb;
      S.lb = null;
      try { h.close(); } catch (e) {}
    }
  }

  function openLightbox(index) {
    if (!S || S.dead) return;
    closeLightbox();

    var list = S.list;
    var pos = index;

    var wrap = H('div.cx-lb', { role: 'dialog', 'aria-modal': 'true', 'aria-label': '图像灯箱' });
    var stage = H('div.cx-lb-stage');
    var info = H('aside.cx-lb-info');
    wrap.appendChild(stage);
    wrap.appendChild(info);

    var handle = KR.layer(wrap, {
      onClose: function () {
        offKeys();
        if (S) S.lb = null;
      }
    });
    S.lb = handle;

    var offKeys = D().on(document, 'keydown', function (ev) {
      var k = ev.key;
      if (k === 'Escape') { handle.close(); }
      else if (k === 'ArrowLeft') { step(-1); }
      else if (k === 'ArrowRight') { step(1); }
      else return;
      if (ev.preventDefault) ev.preventDefault();
    });

    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) handle.close();
    });

    function step(delta) {
      var n = pos + delta;
      if (n < 0) n = list.length - 1;
      if (n >= list.length) n = 0;
      pos = n;
      paint();
    }

    function paint() {
      var rec = list[pos];
      if (!rec) return;

      var lb = labelOf(rec);
      D().clear(stage);
      var big = H('img.cx-lb-img', { alt: lb.name });
      stage.appendChild(big);
      if (rec.p) IMG().attach(big, str(rec.p), { alt: lb.name, eager: true });

      D().clear(info);
      var head = H('div.cx-lb-head');
      var tt = H('div.grow');
      tt.appendChild(H('h3.cx-lb-name', { text: lb.name }));
      if (lb.sub) tt.appendChild(H('span.cx-lb-jp', { text: lb.sub }));
      head.appendChild(tt);
      var x = H('button.btn.btn-ghost.btn-ico.cx-lb-x', { type: 'button', 'aria-label': '关闭灯箱' }, '×');
      x.addEventListener('click', function () { handle.close(); });
      head.appendChild(x);
      info.appendChild(head);

      var dl = H('dl.cx-lb-dl');
      var rows = [
        ['ID', str(rec.i)],
        ['系列', seriesName(rec.s)],
        ['年份', str(rec.y)],
        ['时代', str(rec.e)]
      ];
      for (var i = 0; i < rows.length; i++) {
        dl.appendChild(H('dt', { text: rows[i][0] }));
        dl.appendChild(H('dd', { text: rows[i][1] }));
      }
      info.appendChild(dl);

      var acts = H('div.cx-lb-acts');
      info.appendChild(acts);

      var nav = H('div.cx-lb-nav');
      var prev = H('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': '上一张' }, '← 上一张');
      var next = H('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': '下一张' }, '下一张 →');
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      nav.appendChild(prev);
      nav.appendChild(H('span.cx-lb-pos.tnum', { text: num(pos + 1) + ' / ' + num(list.length) }));
      nav.appendChild(next);
      info.appendChild(nav);
    }

    paint();
  }

  // ── 事件 ─────────────────────────────────────────────────
  function onScroll() {
    if (!S || S.dead) return;
    sweep();
    hydrate();
    maybeMore();
  }

  function bind() {
    S.offs.push(D().on(global, 'scroll', D().throttle(onScroll, 110), { passive: true }));
    S.offs.push(D().on(global, 'resize', D().debounce(function () {
      if (!S || S.dead) return;
      sweep();
      hydrate();
    }, 160)));

    if (typeof global.IntersectionObserver === 'function' && S.sentinel) {
      var io = new global.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { maybeMore(); return; }
        }
      }, { rootMargin: '700px' });
      io.observe(S.sentinel);
      S.io = io;
    }
  }

  // ── 视图生命周期 ─────────────────────────────────────────
  function mount(el) {
    if (!global.KRH || !global.KRD || !global.KRIMG) return;
    unmount();

    S = {
      view: el, cat: 'rider', era: '', series: '', q: '',
      list: [], batches: [], shown: 0, mounted: 0, mem: {},
      offs: [], timers: [], loading: {}, dead: false,
      lb: null, io: null, tabEls: {}, tabCount: {}, chipEls: {}
    };

    var root = H('div.codex', { 'data-cat': 'rider', 'data-mounted': '0' });
    el.appendChild(root);
    S.root = root;

    root.appendChild(toolbar());

    S.grid = H('div.cx-grid', { 'aria-label': '图库网格' });
    root.appendChild(S.grid);

    S.sentinel = H('div.cx-sentinel', { 'aria-live': 'polite' });
    root.appendChild(S.sentinel);

    S.verify = H('footer.cx-verify', { 'aria-label': '图库计数校验' });
    root.appendChild(S.verify);

    paintChips();
    bind();
    render({});
    loadLazyAll();
  }

  function unmount() {
    if (!S) return;
    var dead = S;
    S = null;
    dead.dead = true;
    for (var i = 0; i < dead.timers.length; i++) clearTimeout(dead.timers[i]);
    for (var j = 0; j < dead.offs.length; j++) {
      try { dead.offs[j](); } catch (e) {}
    }
    if (dead.io) { try { dead.io.disconnect(); } catch (e) {} }
    if (dead.lb) { try { dead.lb.close(); } catch (e) {} }
  }

  KR.views = KR.views || {};
  KR.views.codex = { title: '全量图库', mount: mount, unmount: unmount };
})(window);
