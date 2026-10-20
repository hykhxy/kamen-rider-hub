/* owner: roster-rider */
/* 骑士详情：左变身器与摩托 / 中当前形态与形态条 / 右判定
   形态切换是本页唯一的重交互：大图淡入、条形 600ms、评级跳档、差值挂 2 秒。 */
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRH = global.KRH, KRD = global.KRD, KRIMG = global.KRIMG, KRSTAT = global.KRSTAT, KRA = global.KRA;

  var HOLD_DELTA = 2000;
  var DUR_MOVE = 600;

  var S = { id: '', idx: 0, formRecs: [] };
  var UI = null;
  var TIMERS = [];
  var lorePromise = null, itemPromise = null;

  function txt(v) { return v == null ? '' : String(v); }
  function later(fn, ms) {
    var t = setTimeout(function () { fn(); }, ms);
    TIMERS.push(t);
    return t;
  }
  function clearTimers() {
    for (var i = 0; i < TIMERS.length; i++) clearTimeout(TIMERS[i]);
    TIMERS.length = 0;
  }

  function riders() { return KR.RIDERS || []; }
  function findRider(id) {
    var list = riders();
    for (var i = 0; i < list.length; i++) if (list[i].i === id) return list[i];
    return null;
  }

  // ── KR.FORMS 索引（契约写对象键，数据实际是数组，两样都吃） ──
  var FSRC = null, FIDX = null;
  function formOf(id) {
    var F = KR.FORMS;
    if (!F || !id) return null;
    if (!FIDX || FSRC !== F) {
      var map = {};
      if (Object.prototype.toString.call(F) === '[object Array]') {
        for (var i = 0; i < F.length; i++) if (F[i] && F[i].i) map[F[i].i] = F[i];
      } else {
        for (var k in F) if (Object.prototype.hasOwnProperty.call(F, k)) map[k] = F[k];
      }
      FSRC = F; FIDX = map;
    }
    return FIDX[id] || null;
  }

  function formsOf(r) {
    var out = [], ids = (r && r.forms) || [];
    for (var i = 0; i < ids.length; i++) {
      var f = formOf(ids[i]);
      if (f) out.push(f);
    }
    // baseForm 不在 forms 里也要进来，否则「本体」点不到
    if (!out.length) {
      var b = formOf(r && r.baseForm);
      if (b) out.push(b);
    }
    return out;
  }

  function seriesName(s) {
    var W = KR.WORLD;
    return W && W.series && W.series[s] ? W.series[s].name : '';
  }

  function img(path, alt, thumb) {
    var el = KRH('img', { 'data-kr-img': path, alt: alt || '' });
    if (thumb) el.setAttribute('data-kr-thumb', '1');
    return el;
  }

  /* 扫描只对已在文档里的节点有意义：IntersectionObserver 不会命中游离节点。
     所以调用点一律排在 appendChild 之后，本函数自己绝不扫。 */
  function scan() {
    if (UI && UI.root) KRIMG.observe(UI.root);
  }

  /* 出图位统一走 shell-core 的 .plate（暗底/底光/金框在 base.css），这里只管往框里放图。
     框本身不重建，只换框里的内容——切形态时整块不闪。
     opts.eager：首屏必见图位直接 attach，跳过 IO。 */
  function paintPlate(box, path, alt, cap, opts) {
    opts = opts || {};
    KRD.clear(box);
    if (opts.animate) box.classList.add('is-swap');
    if (path) {
      var el = img(path, alt, false);
      box.appendChild(el);
      box.appendChild(KRH('div.rk-grid-tex'));
      box.appendChild(KRH('div.rk-scan'));
      box.appendChild(KRH('i.rk-tick.rk-tick--tl'));
      box.appendChild(KRH('i.rk-tick.rk-tick--br'));
      if (cap) box.appendChild(KRH('div.plate-cap', { text: cap }));
      // attach 对游离节点也生效：src 立刻就位，不等挂载也不等相交
      if (opts.eager && KRIMG.attach) KRIMG.attach(el, path, { eager: true, alt: alt || '' });
    } else {
      box.appendChild(KRH('div.empty', {},
        KRH('b', { text: alt || '未收录' }),
        KRH('span', { text: '档案里没有对应的图像' })));
    }
    if (opts.animate) later(function () { box.classList.remove('is-swap'); }, DUR_MOVE + 40);
    return box;
  }

  // ── 数值呈现 ────────────────────────────────────────────
  function rankCls(rank) {
    if (rank === 'SSS' || rank === 'SS') return '.rank.rank--max';
    if (rank === 'S' || rank === 'A') return '.rank.rank--hi';
    return '.rank';
  }

  function radarEl(stats) {
    var vals = [stats.pow, stats.spd, stats.skl, stats.def];
    var labels = stats.axisLabels || KRSTAT.AXIS;
    var CX = 50, CY = 50, R = 34, N = 4;
    function pt(i, r) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
    }
    var svg = KRH('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': '四维数值雷达' });
    var web = KRH('g');
    [0.25, 0.5, 0.75, 1].forEach(function (s) {
      var pts = [];
      for (var i = 0; i < N; i++) { var p = pt(i, R * s); pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      web.appendChild(KRH('polygon.radar-web' + (s === 1 ? '.radar-web--out' : ''), { points: pts.join(' ') }));
    });
    for (var a = 0; a < N; a++) {
      var e = pt(a, R);
      web.appendChild(KRH('line.radar-axis', { x1: CX, y1: CY, x2: e[0].toFixed(1), y2: e[1].toFixed(1) }));
    }
    svg.appendChild(web);

    var shape = KRH('polygon.radar-shape', { points: '' });
    svg.appendChild(shape);
    var dots = [];
    for (var d = 0; d < N; d++) {
      var c = KRH('circle.radar-dot', { cx: CX, cy: CY, r: '1.8' });
      dots.push(c); svg.appendChild(c);
    }
    for (var m = 0; m < N; m++) {
      var lp = pt(m, R + 13);
      var anchor = Math.abs(lp[0] - CX) < 1 ? 'middle' : (lp[0] > CX ? 'start' : 'end');
      svg.appendChild(KRH('text.radar-label', {
        x: lp[0].toFixed(1), y: lp[1].toFixed(1), 'text-anchor': anchor, 'dominant-baseline': 'middle'
      }, txt(labels[m])));
      var vt = KRH('text.radar-val', {
        x: lp[0].toFixed(1), y: (lp[1] + 11).toFixed(1), 'text-anchor': anchor, 'dominant-baseline': 'middle'
      }, String(vals[m]));
      svg.appendChild(vt);
    }

    var box = KRH('div.radar.rk-radar', {}, svg);
    box.__paint = function (st) {
      var v = [st.pow, st.spd, st.skl, st.def];
      var pts = [];
      for (var i = 0; i < N; i++) {
        var p = pt(i, R * Math.max(4, v[i]) / 100);
        pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
        dots[i].setAttribute('cx', p[0].toFixed(1));
        dots[i].setAttribute('cy', p[1].toFixed(1));
      }
      shape.setAttribute('points', pts.join(' '));
      var valsEls = KRD.qa('.radar-val', svg);
      for (var j = 0; j < valsEls.length && j < N; j++) valsEls[j].textContent = String(v[j]);
    };
    box.__paint(stats);
    return box;
  }

  function barRow(k) {
    var delta = KRH('span.rd-delta');
    var v = KRH('span.bar-v', { text: '0' });
    var fill = KRH('div.bar-fill', { style: { '--v': 0 } });
    var row = KRH('div.bar-row', {},
      KRH('span.bar-k', { text: k }),
      KRH('div.bar-track', {}, fill),
      v, delta
    );
    row.__fill = fill; row.__v = v; row.__d = delta;
    return row;
  }

  function paintBars(rows, stats, delta, animate) {
    var vals = [stats.pow, stats.spd, stats.skl, stats.def];
    for (var i = 0; i < rows.length && i < 4; i++) {
      (function (row, from, to, dv) {
        if (animate && !KRA.reduced) {
          row.__fill.style.setProperty('--v', String(to));
          KRA.tweenValue(from, to, DUR_MOVE, function (v) { row.__v.textContent = String(Math.round(v)); });
        } else {
          row.__fill.style.setProperty('--v', String(to));
          row.__v.textContent = String(to);
        }
        if (dv == null || dv === 0) {
          row.__d.classList.remove('is-on');
          row.__d.textContent = '';
          return;
        }
        row.__d.textContent = (dv > 0 ? '▲' : '▼') + Math.abs(dv);
        row.__d.setAttribute('class', 'rd-delta is-on ' + (dv > 0 ? 'rd-delta--up' : 'rd-delta--dn'));
      })(rows[i], vals[i] - (delta ? [delta.pow, delta.spd, delta.skl, delta.def][i] : 0), vals[i],
        delta ? [delta.pow, delta.spd, delta.skl, delta.def][i] : 0);
    }
  }

  // ── 左：装备 ────────────────────────────────────────────
  function gearPanel(title, path, cap, name, miss) {
    var body = KRH('div.panel-bd.rd-card');
    var box = KRH('div.rd-big.plate');
    paintPlate(box, path, name || title, cap, { eager: true });
    body.appendChild(box);
    body.appendChild(KRH('span.rd-gear-name', { text: name || title }));
    if (miss) body.appendChild(KRH('div.rk-note', { text: miss }));
    return KRH('section.panel', {},
      KRH('div.panel-hd', {}, KRH('h3', { text: title })),
      body
    );
  }

  function gearPanels(r) {
    var belt = r.belt, bike = r.bike;
    var beltPath = '', beltName = '', beltCap = '', beltMiss = '';
    if (belt && belt.i) {
      beltPath = 'item/' + belt.i + '.webp';
      beltName = belt.n;
      beltCap = 'NO.' + belt.i + (belt.j ? ' · ' + belt.j : '');
    } else if (r.items && r.items[0]) {
      // belt 可能尚未收录：拿关联道具首项占位，并在图下写清楚这是替代位
      beltPath = 'item/' + r.items[0] + '.webp';
      beltName = '未收录';
      beltCap = 'NO.' + r.items[0];
      beltMiss = '变身器未收录 · 此图为关联道具首项替代位';
    } else {
      beltName = '未收录';
      beltMiss = '变身器未收录，且这条记录没有关联道具';
    }

    var bikePath = bike && bike.i ? 'item/' + bike.i + '.webp' : '';
    var bikeCap = bike && bike.i ? 'NO.' + bike.i + (bike.j ? ' · ' + bike.j : '') : '';
    return [
      gearPanel('变身器', beltPath, beltCap, beltName, beltMiss),
      gearPanel('摩托车', bikePath, bikeCap, bike ? bike.n : '无搭载记录', bike ? '' : '这部作品里没有登记摩托车')
    ];
  }

  // ── 中：形态 ────────────────────────────────────────────
  function currentForm(r) {
    return S.formRecs[S.idx] || null;
  }

  function currentStats(r) {
    var f = currentForm(r);
    return KRSTAT.of(f ? 'form' : 'rider', f || r);
  }

  // 中栏只搭一次骨架：形态图换的是 plate 里的内容，不是整块面板
  function buildMid(r) {
    UI.plate = KRH('div.rd-big.plate');
    UI.formName = KRH('span.rd-form-name');
    UI.formNote = KRH('div.rd-form-lore');
    UI.formYear = KRH('span.rd-cap');
    UI.strip = KRH('div.rd-strip', { role: 'listbox', 'aria-label': '形态条' });

    var hint = '';
    if (!S.formRecs.length) hint = '该骑士没有登记形态，此处按本体计算。';
    else if (S.formRecs.length === 1) hint = '只有一条形态记录，切换位置会停住。';

    var btn = KRH('button.btn.btn-gold.btn-block', { type: 'button', 'data-act': 'next-form' }, '切换形态');
    btn.addEventListener('click', function () { goForm(S.idx + 1); });

    UI.mid.appendChild(KRH('section.panel.rd-col--mid', {},
      KRH('div.panel-hd', {},
        KRH('h3', { text: '形态' }),
        KRH('span.rk-no', { style: { marginLeft: 'auto' } },
          KRH('b', { text: String(S.formRecs.length || 1) }), KRH('span', { text: '形态在档' }))
      ),
      KRH('div.panel-bd.rd-card', {},
        UI.plate,
        KRH('div.row.between', {}, UI.formName, UI.formYear),
        UI.formNote,
        UI.strip,
        KRH('div.rd-switch', {}, btn, hint ? KRH('div.field-hint', { text: hint }) : null)
      )
    ));
  }

  function paintStage(r, animate) {
    var f = currentForm(r);
    var name = f ? (f.name || '默认形态') : (r.n || '本体');
    paintPlate(UI.plate, f ? f.img : r.img, name,
      'NO.' + txt(f ? f.i : r.i) + (f ? ' · ' + name : ''), { animate: animate });
    UI.formName.textContent = name;
    UI.formYear.textContent = txt(f ? f.y : r.y);
    UI.formNote.textContent = f && f.lore ? shortLore(f.lore) : txt(r.j);
    paintStrip();
  }

  function paintStrip() {
    KRD.clear(UI.strip);
    for (var i = 0; i < S.formRecs.length; i++) {
      (function (form, idx) {
        var on = idx === S.idx;
        var label = form.name || '默认形态';
        var b = KRH('button.rd-form' + (on ? '.is-on' : ''), {
          type: 'button', role: 'option', 'data-fi': String(idx),
          'aria-selected': on ? 'true' : 'false', title: label
        },
          KRH('div.plate.plate--flat', {}, img(form.img, label, true)),
          KRH('span', { text: label })
        );
        b.addEventListener('click', function () { goForm(idx); });
        UI.strip.appendChild(b);
      })(S.formRecs[i], i);
    }
    scan();
  }

  function shortLore(s) {
    var t = plainText(s);
    return t.length > 84 ? t.slice(0, 84) + '…' : t;
  }

  // ── 右：判定 ────────────────────────────────────────────
  function renderStat(r, delta, animate) {
    var stats = currentStats(r);
    var body = KRH('div.panel-bd.rd-stat');

    var fromEl = KRH('span.rd-grade-from', {
      text: delta && delta.rank.from !== delta.rank.to ? '●' + delta.rank.from : ''
    });
    if (!delta || delta.rank.from === delta.rank.to) fromEl.style.setProperty('display', 'none');
    var rankEl = KRH(rankCls(stats.rank), { text: stats.rank });
    var totalEl = KRH('b', { text: String(stats.total) });

    body.appendChild(KRH('div.rd-grade-row', {},
      KRH('div.rd-totals', {}, totalEl, KRH('span.rk-stat-cap', { text: 'TOTAL' })),
      fromEl,
      rankEl
    ));

    var rows = [];
    var bars = KRH('div.bars');
    for (var i = 0; i < stats.bars.length; i++) {
      var row = barRow(stats.bars[i].k);
      rows.push(row);
      bars.appendChild(row);
    }
    body.appendChild(bars);
    var radar = radarEl(stats);
    body.appendChild(radar);
    body.appendChild(KRH('div.rk-note', { text: stats.note }));

    var tags = KRH('div.tags');
    for (var t = 0; t < (stats.tags || []).length; t++) tags.appendChild(KRH('span.tag.tag--dim', { text: stats.tags[t] }));
    body.appendChild(tags);

    KRD.clear(UI.stat);
    UI.stat.appendChild(KRH('section.panel.rd-col--stat', {},
      KRH('div.panel-hd', {},
        KRH('h3', { text: '判定' }),
        KRH('span.rk-no', { style: { marginLeft: 'auto' } }, KRH('b', { text: 'NO.' + txt(r.i) }))
      ),
      body
    ));

    paintBars(rows, stats, delta, animate);

    if (animate && !KRA.reduced) {
      if (delta && delta.total) {
        KRA.tweenValue(stats.total - delta.total, stats.total, DUR_MOVE, function (v) {
          totalEl.textContent = String(Math.round(v));
        });
      }
    } else {
      totalEl.textContent = String(stats.total);
    }

    if (delta && delta.rank.from !== delta.rank.to) {
      rankEl.classList.add('rd-jump');
      later(function () { rankEl.classList.remove('rd-jump'); }, DUR_MOVE + 60);
    }

    // 差值保持 2 秒后收回，避免页面上永远挂着上次比较
    if (delta) {
      later(function () {
        var ds = KRD.qa('.rd-delta', body);
        for (var i = 0; i < ds.length; i++) ds[i].classList.remove('is-on');
      }, HOLD_DELTA);
    }
    UI.stats = stats;
  }

  // ── 形态切换 ────────────────────────────────────────────
  function goForm(idx) {
    var r = findRider(S.id);
    if (!r || !UI) return;
    var n = Math.max(1, S.formRecs.length);
    var next = ((idx % n) + n) % n;
    if (next === S.idx) return;   // 只有一条形态时循环会立刻回到自己

    var before = currentStats(r);
    S.idx = next;
    var after = currentStats(r);
    var delta = KRSTAT.delta(before, after);

    paintStage(r, true);
    renderStat(r, delta, true);
    scan();   // UI.plate / UI.strip 都在文档里了
  }

  // ── 文本清洗 ────────────────────────────────────────────
  function plainText(md) {
    return String(md || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^\s*[-*·]\s+/gm, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function paras(md, max) {
    var t = plainText(md);
    if (!t) return [];
    var parts = t.split(/\n{2,}/);
    var out = [];
    for (var i = 0; i < parts.length && out.length < max; i++) {
      var p = parts[i].replace(/\s*\n\s*/g, ' ').trim();
      if (p) out.push(p);
    }
    return out;
  }

  // ── 原著剧情 ────────────────────────────────────────────
  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s·・,，.。/／()（）\[\]【】《》\-—_]/g, '').toLowerCase();
  }

  function loreEntry(r) {
    var L = KR.LORE;
    if (!L || !L.__index) return null;
    var key = norm(r.n);
    if (!key) return null;
    var order = { '形态': 0, '骑士': 1, '剧情': 2, '作品': 3 };
    var best = null, bestScore = 99;
    for (var i = 0; i < L.__index.length; i++) {
      var e = L.__index[i];
      var cat = order[e.cat];
      if (cat == null) continue;
      if (norm(e.name).indexOf(key) < 0) continue;
      var score = cat * 100 + norm(e.name).length;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best && L[best.key] ? L[best.key] : null;
  }

  function renderLore(r) {
    if (!UI || !UI.lore) return;
    KRD.clear(UI.lore);
    var body = '';
    var entry = loreEntry(r);
    if (entry) body = entry.body;
    if (!body && r.lore) body = r.lore;
    if (!body) {
      var f = S.formRecs[0];
      if (f && f.lore) body = f.lore;
    }

    var list = body ? paras(body, 4) : [];
    if (!list.length) {
      UI.lore.appendChild(KRH('div.empty', {},
        KRH('b', { text: '世界书里还没有这一位的条目' }),
        KRH('span', { text: '剧情节选按需加载 · data/lore.js' })
      ));
      return;
    }

    var box = KRH('div.rd-lore.is-clip');
    for (var i = 0; i < list.length; i++) box.appendChild(KRH('p', { text: list[i] }));
    UI.lore.appendChild(box);

    if (list.length > 1) {
      var fold = KRH('button.rd-fold', { type: 'button', 'aria-expanded': 'false' }, '展开全文');
      fold.addEventListener('click', function () {
        var open = box.classList.contains('is-clip');
        box.classList.toggle('is-clip', !open);
        fold.setAttribute('aria-expanded', open ? 'true' : 'false');
        fold.textContent = open ? '收起诉' : '展开全文';
      });
      UI.lore.appendChild(fold);
    }
  }

  function ensureLore(r) {
    if (KR.LORE && KR.LORE.__index) { renderLore(r); return; }
    if (lorePromise) { lorePromise.then(function () { if (UI) renderLore(findRider(S.id)); }, function () {}); return; }
    lorePromise = KR.load('data/lore.js');
    lorePromise.then(function () { if (UI) renderLore(findRider(S.id)); }, function (e) {
      KR.report && KR.report('rider/lore', e);
      if (UI) renderLore(findRider(S.id));
    });
  }

  // ── 关联道具 ────────────────────────────────────────────
  function itemName(id) {
    var I = KR.IMG && KR.IMG.items;
    if (!I) return '';
    for (var i = 0; i < I.length; i++) if (I[i].i === id) return I[i].n;
    return '';
  }

  function renderItems(r) {
    if (!UI || !UI.items) return;
    KRD.clear(UI.items);
    var ids = (r.items || []).slice(0, 12);
    if (!ids.length) {
      UI.items.appendChild(KRH('div.empty', {}, KRH('b', { text: '没有关联道具' }), KRH('span', { text: '这条记录的 items 是空的' })));
      return;
    }
    var grid = KRH('div.rd-items');
    for (var i = 0; i < ids.length; i++) {
      var nm = itemName(ids[i]) || ('道具 ' + ids[i]);
      grid.appendChild(KRH('div.rd-item', { title: nm },
        KRH('div.plate.plate--flat', {}, img('item/' + ids[i] + '.webp', nm, true)),
        KRH('span', { text: nm })
      ));
    }
    UI.items.appendChild(grid);
    scan();
  }

  function ensureItems(r) {
    if (KR.IMG && KR.IMG.items) { renderItems(r); return; }
    if (itemPromise) { itemPromise.then(function () { if (UI) renderItems(findRider(S.id)); }, function () {}); return; }
    itemPromise = KR.load('data/img-items.js');
    itemPromise.then(function () { if (UI) renderItems(findRider(S.id)); }, function () {});
  }

  // ── 同系列 ──────────────────────────────────────────────
  function renderSiblings(r) {
    if (!UI || !UI.more) return;
    KRD.clear(UI.more);
    var list = [];
    var all = riders();
    for (var i = 0; i < all.length && list.length < 24; i++) {
      if (all[i].i !== r.i && all[i].s === r.s) list.push(all[i]);
    }
    if (!list.length) {
      UI.more.appendChild(KRH('div.empty', {}, KRH('b', { text: '同系列只有这一位' })));
      return;
    }
    var rail = KRH('div.rd-more');
    for (var j = 0; j < list.length; j++) {
      (function (x) {
        var b = KRH('button.rd-more-item', { type: 'button', title: txt(x.n) },
          KRH('div.plate.plate--flat', {}, img(x.img, txt(x.n), true)),
          KRH('span', { text: txt(x.n) })
        );
        b.addEventListener('click', function () { KR.go('/rider/' + x.i); });
        rail.appendChild(b);
      })(list[j]);
    }
    UI.more.appendChild(rail);
    scan();
  }

  // ── 装配 ────────────────────────────────────────────────
  function build(r) {
    UI.left = KRH('div.rd-col.rd-col--left');
    var gears = gearPanels(r);
    for (var g = 0; g < gears.length; g++) UI.left.appendChild(gears[g]);

    UI.mid = KRH('div.rd-col.rd-col--mid');
    UI.stat = KRH('div.rd-col.rd-col--stat');

    var loreSlot = KRH('div.panel-bd');
    var itemsSlot = KRH('div.panel-bd');
    var moreSlot = KRH('div.panel-bd');
    UI.lore = loreSlot; UI.items = itemsSlot; UI.more = moreSlot;

    var below = KRH('div.rd-below', {},
      KRH('section.panel', {},
        KRH('div.panel-hd', {}, KRH('h3', { text: '原著剧情节选' }),
          KRH('span.rd-cap', { style: { marginLeft: 'auto' }, text: '最多 4 段' })),
        loreSlot
      ),
      KRH('div.col', {},
        KRH('section.panel', {},
          KRH('div.panel-hd', {}, KRH('h3', { text: '关联道具' }),
            KRH('span.rk-no', { style: { marginLeft: 'auto' } },
              KRH('b', { text: String((r.items || []).length) }), KRH('span', { text: '件' }))),
          itemsSlot
        ),
        KRH('section.panel', {},
          KRH('div.panel-hd', {}, KRH('h3', { text: '同系列' }),
            KRH('span.rd-cap', { style: { marginLeft: 'auto' }, text: seriesName(r.s) })),
          moreSlot
        )
      )
    );

    var head = KRH('header.row.between', {},
      KRH('div.col', { style: { gap: '4px' } },
        KRH('div.rk-no', {}, KRH('a', { href: '#/roster' }, '← 骑士图鉴'), KRH('i.rk-ruler'), KRH('b', { text: txt(r.i) })),
        KRH('h1.rd-title', { text: txt(r.n) }),
        KRH('div.rd-sub', { text: txt(r.j) + ' · ' + (seriesName(r.s) || txt(r.work)) + ' · ' + txt(r.y) })
      ),
      KRH('div.tags', {},
        KRH('span.tag.tag--gold', { text: txt(r.e) || '未归类' }),
        KRH('span.tag', { text: (r.forms || []).length + ' 形态' })
      )
    );

    return KRH('section.rd', {}, head, KRH('div.rd-grid', {}, UI.left, UI.mid, UI.stat), below);
  }

  function mount(el, params) {
    var id = (params && params.params && params.params[0]) || '';
    var r = findRider(id) || riders()[0];
    if (!r) {
      KRD.clear(el);
      el.appendChild(KRH('div.empty', {}, KRH('b', { text: '找不到这位骑士' }), KRH('span', { text: '回到图鉴重新选一位' })));
      return false;
    }

    S.id = r.i;
    S.formRecs = formsOf(r);
    S.idx = 0;

    UI = { root: el, left: null, mid: null, stat: null, lore: null, items: null, more: null, stats: null };
    KRD.clear(el);
    el.appendChild(build(r));
    buildMid(r);

    paintStage(r, false);
    renderStat(r, null, false);
    renderLore(r);
    renderItems(r);
    renderSiblings(r);
    scan();   // 整棵树此刻已挂在 #view 下，一次扫齐首屏图位

    ensureLore(r);
    ensureItems(r);
    return true;
  }

  function unmount() {
    clearTimers();
    UI = null;
    S.id = '';
    S.idx = 0;
    S.formRecs = [];
  }

  KR.views = KR.views || {};
  KR.views.rider = {
    title: '骑士详情',
    css: 'assets/css/roster.css',
    mount: mount,
    unmount: unmount
  };
})(window);
