/* owner: roster-rider */
/* 骑士图鉴：左筛选与缩略列表 / 中大立绘 / 右资料面板
   只有「查看角色数值」「查看骑士数值」两个入口——这本图鉴不做培养，只做读档。 */
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRH = global.KRH, KRD = global.KRD, KRIMG = global.KRIMG, KRSTAT = global.KRSTAT;

  var BATCH = 120;
  var CHAR_TAKE = 8;

  var S = { era: '', series: '', q: '', shown: BATCH, sel: null, mode: '', charId: null };
  var UI = null;
  var offKey = null, offDoc = null;
  var charsPromise = null;

  // ── 小工具 ──────────────────────────────────────────────
  function txt(v) { return v == null ? '' : String(v); }

  function riders() { return (KR.RIDERS || []); }

  function findRider(id) {
    var list = riders();
    for (var i = 0; i < list.length; i++) if (list[i].i === id) return list[i];
    return null;
  }

  function seriesName(s) {
    var W = KR.WORLD;
    if (W && W.series && W.series[s]) return W.series[s].name;
    return '';
  }

  function norm(s) {
    return txt(s).toLowerCase().replace(/\s+/g, '');
  }

  function match(r) {
    if (S.era && txt(r.e) !== S.era) return false;
    if (S.series !== '' && String(r.s) !== String(S.series)) return false;
    if (S.q) {
      var q = norm(S.q);
      if (norm(r.n).indexOf(q) < 0 && norm(r.j).indexOf(q) < 0 && norm(r.work).indexOf(q) < 0) return false;
    }
    return true;
  }

  function filtered() {
    var out = [], list = riders();
    for (var i = 0; i < list.length; i++) if (match(list[i])) out.push(list[i]);
    return out;
  }

  function img(path, alt, thumb) {
    var el = KRH('img', { 'data-kr-img': path, alt: alt || '' });
    if (thumb) el.setAttribute('data-kr-thumb', '1');
    return el;
  }

  /* 整树一次扫描：逐容器手写 observe 漏一处就是一格破图 */
  function scan() {
    if (UI && UI.root) KRIMG.observe(UI.root);
  }

  function itemImg(id, alt) {
    // 图像路径满足 {kind}/{id}.webp 不变式，所以不加载道具索引也能出图
    var el = KRH('img.rk-mini', { 'data-kr-img': 'item/' + id + '.webp', alt: alt || '' });
    el.setAttribute('data-kr-thumb', '1');
    return el;
  }

  // ── 数值：条形 / 雷达 / 评级 ────────────────────────────
  function barsEl(stats) {
    var wrap = KRH('div.bars');
    for (var i = 0; i < stats.bars.length; i++) {
      var b = stats.bars[i];
      wrap.appendChild(KRH('div.bar-row', {},
        KRH('span.bar-k', { text: b.k }),
        KRH('div.bar-track', {}, KRH('div.bar-fill', { style: { '--v': b.v } })),
        KRH('span.bar-v', { text: b.v })
      ));
    }
    return wrap;
  }

  function radarEl(stats) {
    var vals = [stats.pow, stats.spd, stats.skl, stats.def];
    var labels = stats.axisLabels || KRSTAT.AXIS;
    var CX = 50, CY = 50, R = 34;
    var N = 4;

    function pt(i, r) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
    }
    function ring(scale) {
      var s = [];
      for (var i = 0; i < N; i++) {
        var p = pt(i, R * scale);
        s.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
      }
      return s.join(' ');
    }

    var svg = KRH('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': '四维数值雷达' });
    var web = KRH('g');
    [0.25, 0.5, 0.75, 1].forEach(function (s) {
      web.appendChild(KRH('polygon.radar-web' + (s === 1 ? '.radar-web--out' : ''), { points: ring(s) }));
    });
    for (var i = 0; i < N; i++) {
      var e = pt(i, R);
      web.appendChild(KRH('line.radar-axis', { x1: CX, y1: CY, x2: e[0].toFixed(1), y2: e[1].toFixed(1) }));
    }
    svg.appendChild(web);

    var shape = [];
    for (var j = 0; j < N; j++) {
      var q = pt(j, R * Math.max(4, vals[j]) / 100);
      shape.push(q[0].toFixed(1) + ',' + q[1].toFixed(1));
    }
    svg.appendChild(KRH('polygon.radar-shape', { points: shape.join(' ') }));

    var dots = KRH('g');
    for (var k = 0; k < N; k++) {
      var d = pt(k, R * Math.max(4, vals[k]) / 100);
      dots.appendChild(KRH('circle.radar-dot', { cx: d[0].toFixed(1), cy: d[1].toFixed(1), r: '1.8' }));
    }
    svg.appendChild(dots);

    for (var m = 0; m < N; m++) {
      var lp = pt(m, R + 13);
      var anchor = Math.abs(lp[0] - CX) < 1 ? 'middle' : (lp[0] > CX ? 'start' : 'end');
      svg.appendChild(KRH('text.radar-label', {
        x: lp[0].toFixed(1), y: lp[1].toFixed(1), 'text-anchor': anchor, 'dominant-baseline': 'middle'
      }, txt(labels[m])));
      svg.appendChild(KRH('text.radar-val', {
        x: lp[0].toFixed(1), y: (lp[1] + 11).toFixed(1), 'text-anchor': anchor, 'dominant-baseline': 'middle'
      }, String(vals[m])));
    }
    return KRH('div.radar.rk-radar', {}, svg);
  }

  function rankCls(rank) {
    if (rank === 'SSS' || rank === 'SS') return '.rank.rank--max';
    if (rank === 'S' || rank === 'A') return '.rank.rank--hi';
    return '.rank';
  }

  function statBoxEl(stats, opts) {
    opts = opts || {};
    var box = KRH('div.rk-stat');
    box.appendChild(KRH('div.rk-stat-hd', {},
      KRH('div.rk-stat-total', {}, KRH('b', { text: String(stats.total) }), KRH('span', { text: 'TOTAL' })),
      KRH(rankCls(stats.rank), { text: stats.rank }),
      KRH('span.rk-stat-cap', { text: opts.cap === 'char' ? '人类口径' : '骑士口径' })
    ));
    box.appendChild(barsEl(stats));
    box.appendChild(radarEl(stats));
    box.appendChild(KRH('div.rk-note', { text: stats.note }));
    if (stats.tags && stats.tags.length) {
      var tags = KRH('div.tags');
      for (var i = 0; i < stats.tags.length; i++) tags.appendChild(KRH('span.tag.tag--dim', { text: stats.tags[i] }));
      box.appendChild(tags);
    }
    return box;
  }

  // ── 左栏 ────────────────────────────────────────────────
  function buildFilters() {
    var wrap = KRH('div.rk-filters');

    var eraSel = KRH('select.sel', { 'aria-label': '按时代筛选' });
    eraSel.appendChild(KRH('option', { value: '' }, '全部时代'));
    var eras = (KR.WORLD && KR.WORLD.eras) || [{ name: '昭和' }, { name: '平成' }, { name: '令和' }, { name: '未归类' }];
    for (var i = 0; i < eras.length; i++) {
      eraSel.appendChild(KRH('option', { value: eras[i].name }, eras[i].name));
    }
    eraSel.addEventListener('change', function () { S.era = txt(eraSel.value); S.shown = BATCH; renderList(); });
    wrap.appendChild(eraSel);

    var srSel = KRH('select.sel', { 'aria-label': '按系列筛选' });
    srSel.appendChild(KRH('option', { value: '' }, '全部系列'));
    var sers = (KR.WORLD && KR.WORLD.series) || [];
    for (var j = 0; j < sers.length; j++) {
      srSel.appendChild(KRH('option', { value: String(sers[j].i) }, txt(sers[j].year) + ' · ' + sers[j].name));
    }
    srSel.addEventListener('change', function () { S.series = txt(srSel.value); S.shown = BATCH; renderList(); });
    wrap.appendChild(srSel);

    var search = KRH('input.ipt', {
      type: 'search', placeholder: '搜骑士名 / 原名 / 作品', 'aria-label': '搜索骑士', value: ''
    });
    var run = KRD.debounce(function () { S.q = txt(search.value); S.shown = BATCH; renderList(); }, 150);
    search.addEventListener('input', run);
    wrap.appendChild(search);

    return wrap;
  }

  function rowEl(r) {
    var btn = KRH('button.rk-row', {
      type: 'button', role: 'option', 'data-id': r.i, 'aria-selected': 'false', title: txt(r.n)
    },
      KRH('div.plate.plate--flat.rk-thumb', {}, img(r.img, txt(r.n), true)),
      KRH('span.rk-row-n', { text: txt(r.n) }),
      KRH('span.rk-row-y', { text: txt(r.y) })
    );
    return btn;
  }

  function renderList() {
    if (!UI || !UI.list) return;
    var list = filtered();
    var take = Math.min(S.shown, list.length);

    KRD.clear(UI.list);
    for (var i = 0; i < take; i++) UI.list.appendChild(rowEl(list[i]));

    if (take < list.length) {
      UI.list.appendChild(KRH('div.rk-more', {},
        KRH('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          onclick: function () { S.shown += BATCH; renderList(); }
        }, '再列 ' + Math.min(BATCH, list.length - take) + ' 位 · 余 ' + (list.length - take))
      ));
    } else if (!list.length) {
      UI.list.appendChild(KRH('div.empty', {}, KRH('b', { text: '没有符合条件的骑士' }), KRH('span', { text: '清空筛选或换个关键词' })));
    }

    if (UI.count) UI.count.textContent = KRD.fmtNum(take) + ' / ' + KRD.fmtNum(list.length);
    if (UI.total) UI.total.textContent = KRD.fmtNum(riders().length);

    scan();
    paintSelection();
  }

  function paintSelection() {
    if (!UI || !UI.list) return;
    var rows = KRD.qa('.rk-row', UI.list);
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i].getAttribute('data-id') === S.sel;
      rows[i].classList.toggle('is-on', on);
      rows[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  // ── 中栏：立绘 ──────────────────────────────────────────
  function renderStage(r) {
    var art = KRH('div.rk-art.plate', {},
      img(r.img, txt(r.n)),
      KRH('div.rk-grid-tex'),
      KRH('div.rk-scan'),
      KRH('i.rk-tick.rk-tick--tl'),
      KRH('i.rk-tick.rk-tick--br'),
      KRH('div.plate-cap', { text: 'NO.' + txt(r.i) + ' · ' + txt(r.j) })
    );

    KRD.clear(UI.stage);
    UI.stage.appendChild(art);
    UI.stage.appendChild(KRH('div.rk-stage-meta', {},
      KRH('div.row.between', {},
        KRH('h2.rk-title', { text: txt(r.n) }),
        KRH('span.rk-forms-badge', {}, KRH('b', { text: String((r.forms || []).length) }), KRH('span', { text: '形态' }))
      ),
      KRH('div.row', { style: { flexWrap: 'wrap' } },
        KRH('span.tag.tag--gold', { text: txt(r.e) || '未归类' }),
        KRH('span.tag', { text: seriesName(r.s) || txt(r.work) || '未归类' }),
        KRH('span.tag.tag--dim', { text: txt(r.y) + ' 年' })
      )
    ));

    scan();
    // 160–240ms 过渡：只在换人时触发，首帧不闪
    if (UI.swapping) {
      art.classList.add('is-swap');
      setTimeout(function () { art.classList.remove('is-swap'); }, 260);
    }
    UI.art = art;
  }

  // ── 右栏：资料 ──────────────────────────────────────────
  function fact(k, v, miss) {
    return KRH('div.rk-fact' + (miss ? '.is-miss' : ''), {}, KRH('dt', { text: k }), KRH('dd', {}, v));
  }

  function renderFacts(r) {
    var body = KRH('dl.rk-facts');

    var tags = KRH('div.tags');
    for (var i = 0; i < (r.tags || []).length; i++) tags.appendChild(KRH('span.tag.tag--gold', { text: r.tags[i] }));
    if (!(r.tags || []).length) tags.appendChild(KRH('span.tag.tag--dim', { text: '无标签' }));
    body.appendChild(fact('档案标签', tags));

    var chars = charsOf(r);
    if (chars === null) {
      body.appendChild(fact('变身者', KRH('span.muted', { text: '人物图鉴按需加载…' })));
    } else if (!chars.length) {
      body.appendChild(fact('变身者', KRH('span', { text: '该系列暂无人物档案' }), true));
    } else {
      var names = [];
      for (var c = 0; c < Math.min(4, chars.length); c++) names.push(chars[c].n);
      body.appendChild(fact('变身者', names.join(' · ')));
    }

    if (r.belt) {
      body.appendChild(fact('变身器', KRH('span', {}, txt(r.belt.n), KRH('em', { text: txt(r.belt.j) }))));
    } else {
      // belt 可能尚未收录：给道具首项作替代位，连道具都没有就说明这条记录本身是空的
      var first = (r.items && r.items[0]) || '';
      var altKids = [];
      if (first) altKids.push(itemImg(first, '替代位道具'));
      altKids.push('变身器未收录');
      body.appendChild(fact('变身器', KRH('span', {}, altKids), true));
    }

    if (r.bike) body.appendChild(fact('摩托车', KRH('span', {}, txt(r.bike.n), KRH('em', { text: txt(r.bike.j) }))));
    else body.appendChild(fact('摩托车', KRH('span', { text: '无搭载记录' }), true));

    body.appendChild(fact('关联道具', KRH('span', {}, KRH('b.tnum', { text: String((r.items || []).length) }), ' 件')));
    body.appendChild(fact('所属作品', KRH('span', { text: txt(r.work) || seriesName(r.s) || '—' })));

    var acts = KRH('div.rk-actions', {},
      KRH('button.btn.btn-ghost', {
        type: 'button', 'data-act': 'stat-rider', 'aria-pressed': S.mode === 'rider' ? 'true' : 'false'
      }, '查看骑士数值'),
      KRH('button.btn.btn-ghost', {
        type: 'button', 'data-act': 'stat-char', 'aria-pressed': S.mode === 'char' ? 'true' : 'false'
      }, '查看角色数值')
    );

    var slot = KRH('div');
    KRD.clear(UI.info);
    UI.info.appendChild(body);
    UI.info.appendChild(acts);
    UI.info.appendChild(slot);
    UI.slot = slot;

    acts.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      S.mode = (S.mode === (act === 'stat-rider' ? 'rider' : 'char')) ? '' : (act === 'stat-rider' ? 'rider' : 'char');
      var all = KRD.qa('[data-act]', acts);
      for (var i = 0; i < all.length; i++) {
        var on = all[i].getAttribute('data-act') === 'stat-' + S.mode;
        all[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      renderStat();
    });

    renderStat();
  }

  // ── 数值槽 ──────────────────────────────────────────────
  function charsOf(r) {
    var C = KR.IMG && KR.IMG.chars;
    if (!C || !C.length) return null;
    var out = [];
    for (var i = 0; i < C.length && out.length < CHAR_TAKE; i++) if (C[i].s === r.s) out.push(C[i]);
    return out;
  }

  function ensureChars(after) {
    if (KR.IMG && KR.IMG.chars && KR.IMG.chars.length) { after(); return; }
    if (charsPromise) { charsPromise.then(after, function () {}); return; }
    charsPromise = KR.load('data/img-chars.js');
    charsPromise.then(after, function (err) {
      KR.report && KR.report('roster/chars', err);
      after();
    });
  }

  function findChar(r, id) {
    var list = charsOf(r) || [];
    if (!list.length) return null;
    if (id) for (var i = 0; i < list.length; i++) if (list[i].i === id) return list[i];
    return list[0];
  }

  function renderStat() {
    if (!UI || !UI.slot) return;
    var r = findRider(S.sel);
    KRD.clear(UI.slot);
    if (!r || !S.mode) return;

    if (S.mode === 'rider') {
      UI.slot.appendChild(statBoxEl(KRSTAT.of('rider', r), { cap: 'rider' }));
      return;
    }

    var chars = charsOf(r);
    if (chars === null) {
      UI.slot.appendChild(KRH('div.rk-stat', {},
        KRH('div.skel', { style: { height: '120px' } }),
        KRH('div.rk-stat-cap', { text: '人物档案按需加载 · data/img-chars.js' })
      ));
      ensureChars(function () { if (S.mode === 'char') renderStat(); });
      return;
    }
    if (!chars.length) {
      UI.slot.appendChild(KRH('div.empty', {}, KRH('b', { text: '该系列没有人物档案' }), KRH('span', { text: '换一位骑士，或改看骑士数值' })));
      return;
    }

    var cur = findChar(r, S.charId);
    if (!cur) { S.charId = chars[0].i; cur = chars[0]; }

    UI.slot.appendChild(KRH('div.rk-stat-cap', { text: '变身者 · ' + seriesName(r.s) + '／' + chars.length + ' 位在档' }));

    var strip = KRH('div.rk-chars', { role: 'listbox', 'aria-label': '该系列人物' });
    for (var i = 0; i < chars.length; i++) {
      (function (c) {
        var on = c.i === cur.i;
        var b = KRH('button.rk-char' + (on ? '.is-on' : ''), {
          type: 'button', role: 'option', 'data-cid': c.i, 'aria-selected': on ? 'true' : 'false', title: c.n
        }, img('char/' + c.i + '.webp', c.n, true), KRH('span', { text: c.n }));
        b.addEventListener('click', function () { S.charId = c.i; renderStat(); });
        strip.appendChild(b);
      })(chars[i]);
    }
    UI.slot.appendChild(strip);
    UI.slot.appendChild(statBoxEl(KRSTAT.of('char', cur), { cap: 'char' }));
    scan();
  }

  // ── 选择 ────────────────────────────────────────────────
  function select(id, opts) {
    var r = findRider(id);
    if (!r) return;
    UI.swapping = !!(opts && opts.swap);
    S.sel = id;
    S.charId = null;
    renderStage(r);
    renderFacts(r);
    paintSelection();
    UI.swapping = false;
  }

  function step(delta) {
    var list = filtered();
    if (!list.length) return;
    var at = -1;
    for (var i = 0; i < list.length; i++) if (list[i].i === S.sel) { at = i; break; }
    var next = at < 0 ? 0 : (at + delta + list.length) % list.length;
    if (next >= S.shown) { S.shown = Math.min(list.length, next + BATCH); renderList(); }
    select(list[next].i, { swap: true });
    var row = KRD.q('[data-id="' + list[next].i + '"]', UI.list);
    if (row && row.scrollIntoView) { try { row.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }

  function onKey(ev) {
    if (!ev || ev.__rkKey) return;
    var tag = ev.target && ev.target.tagName ? String(ev.target.tagName).toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    var k = ev.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp') return;
    ev.__rkKey = 1;
    if (ev.preventDefault) ev.preventDefault();
    step(k === 'ArrowDown' ? 1 : -1);
  }

  // ── 生命周期 ────────────────────────────────────────────
  function mount(el, params) {
    var want = params && params.params && params.params[0];

    var head = KRH('header.row.between', {},
      KRH('div.col', { style: { gap: '4px' } },
        KRH('div.rk-no', {},
          KRH('span', { text: 'KR ARCHIVE' }),
          KRH('i.rk-ruler'),
          KRH('b', { text: '443' })
        ),
        KRH('h1.rk-title', { text: '骑士图鉴' })
      ),
      KRH('div.tags', {},
        KRH('span.tag.tag--dim', { text: '只读档案 · 原著口径' }),
        KRH('span.tag.tag--cyan', { text: '力／速／技／防' })
      )
    );

    var listPanel = KRH('aside.panel.panel--quiet.rk-col', {},
      KRH('div.panel-hd', {},
        KRH('h3', { text: '名录' }),
        KRH('span.rk-no', { style: { marginLeft: 'auto' } }, KRH('b', { text: '0 / 0', 'data-bind': 'count' }))
      ),
      buildFilters(),
      KRH('div.rk-list', { role: 'listbox', 'aria-label': '骑士名录', tabindex: '0' })
    );

    var stagePanel = KRH('section.panel.rk-col.rk-col--stage', {}, KRH('div.rk-stage'));

    var infoPanel = KRH('aside.panel.panel--quiet.rk-col.rk-col--info', {},
      KRH('div.panel-hd', {}, KRH('h3', { text: '档案' })),
      KRH('div.panel-bd', { style: { paddingTop: '4px' } })
    );

    var grid = KRH('div.rk-grid', {}, listPanel, stagePanel, infoPanel);
    var root = KRH('section.rk', {}, head, grid);
    KRD.clear(el);
    el.appendChild(root);

    UI = {
      root: root,
      list: KRD.q('.rk-list', listPanel),
      stage: KRD.q('.rk-stage', stagePanel),
      info: KRD.q('.panel-bd', infoPanel),
      count: KRD.q('[data-bind="count"]', listPanel),
      total: KRD.q('b', KRD.q('.rk-no', head)),
      slot: null,
      swapping: false,
      art: null
    };

    UI.list.addEventListener('click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('.rk-row') : null;
      if (!row) return;
      select(row.getAttribute('data-id'), { swap: true });
    });

    offKey = KRD.on(el, 'keydown', onKey);
    offDoc = KRD.on(document, 'keydown', onKey);

    S.mode = '';
    renderList();

    var pick = want && findRider(want) ? want : (riders()[0] ? riders()[0].i : null);
    if (pick) select(pick, { swap: false });

    scan();   // 名录 + 大立绘已在文档内，收口再扫一次

    if (!KR.IMG || !KR.IMG.chars) ensureChars(function () {
      if (!UI) return;
      var r = findRider(S.sel);
      if (r) renderFacts(r);
    });
    return true;
  }

  function unmount() {
    if (offKey) { offKey(); offKey = null; }
    if (offDoc) { offDoc(); offDoc = null; }
    S.mode = '';
    S.sel = null;
    S.charId = null;
    S.shown = BATCH;
    UI = null;
  }

  KR.views = KR.views || {};
  KR.views.roster = {
    title: '骑士图鉴',
    css: 'assets/css/roster.css',
    mount: mount,
    unmount: unmount
  };
})(window);
