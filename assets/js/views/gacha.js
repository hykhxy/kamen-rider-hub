// owner: quest-create — 抽卡：时代池 / 系列池、单抽十连、保底与残章
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRD = global.KRD;
  var KRH = global.KRH;
  var KRIMG = global.KRIMG;
  var KRA = global.KRA;

  var RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  var TIER_A = 4;
  var TIER_SS = 6;
  var PITY_MAX = 30;
  var TEN_GUARANTEE = TIER_A;

  var STAT_CACHE = null;
  var S = null;

  function Q() { return KR.quest; }
  function clampNum(v, lo, hi) { var n = Number(v); if (!isFinite(n)) n = lo; return n < lo ? lo : (n > hi ? hi : n); }

  function statOf(r) {
    if (!STAT_CACHE) STAT_CACHE = {};
    var id = String(r.i);
    if (!STAT_CACHE[id]) STAT_CACHE[id] = Q().statOf('rider', r);
    return STAT_CACHE[id];
  }

  function tierOf(r) { return Q().rankIndex(statOf(r).rank); }

  function seriesName(s) {
    var arr = (KR.WORLD && KR.WORLD.series) || [];
    for (var i = 0; i < arr.length; i++) if (String(arr[i].i) === String(s)) return arr[i].name;
    return '未归类';
  }

  function rnd(n) { return Math.floor(Math.random() * n); }

  // ── 池 ─────────────────────────────────────────────────
  var ERA_ORDER = ['昭和', '平成', '令和', '未归类'];

  function eraPools() {
    var seen = {};
    var list = KR.RIDERS || [];
    for (var i = 0; i < list.length; i++) {
      var e = String(list[i].e || '未归类');
      if (!seen[e]) seen[e] = { key: 'era|' + e, label: e, era: e, riders: [] };
      seen[e].riders.push(list[i]);
    }
    var out = [];
    for (var k = 0; k < ERA_ORDER.length; k++) if (seen[ERA_ORDER[k]]) out.push(seen[ERA_ORDER[k]]);
    for (var key in seen) {
      if (!Object.prototype.hasOwnProperty.call(seen, key)) continue;
      if (out.indexOf(seen[key]) < 0) out.push(seen[key]);
    }
    return out;
  }

  function seriesPools() {
    var arr = (KR.WORLD && KR.WORLD.series) || [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      (function (s) {
        var riders = (KR.RIDERS || []).filter(function (r) { return String(r.s) === String(s.i); });
        out.push({ key: 'series|' + s.i, label: s.name, era: s.era, riders: riders });
      })(arr[i]);
    }
    return out;
  }

  function compose(pool) {
    var dist = [0, 0, 0, 0, 0, 0, 0, 0];
    var max = -1;
    for (var i = 0; i < pool.riders.length; i++) {
      var t = tierOf(pool.riders[i]);
      dist[t] += 1;
      if (t > max) max = t;
    }
    return { dist: dist, maxTier: max < 0 ? 0 : max, count: pool.riders.length };
  }

  function topTierOf(pool) {
    var c = compose(pool);
    return c.maxTier;
  }

  function pickFrom(pool, minTier) {
    var list = pool.riders;
    if (!list.length) return null;
    if (minTier > 0) {
      var elig = [];
      for (var i = 0; i < list.length; i++) if (tierOf(list[i]) >= minTier) elig.push(list[i]);
      if (elig.length) list = elig;
      else {
        var top = topTierOf(pool);
        var tmp = [];
        for (var j = 0; j < list.length; j++) if (tierOf(list[j]) === top) tmp.push(list[j]);
        list = tmp.length ? tmp : list;
      }
    }
    return list[rnd(list.length)];
  }

  function ownedEntry(id) {
    var mine = (KR.state && KR.state.myRiders) || [];
    for (var i = 0; i < mine.length; i++) if (String(mine[i].i) === String(id)) return mine[i];
    return null;
  }

  function shardTotal() {
    var mine = (KR.state && KR.state.myRiders) || [];
    var n = 0;
    for (var i = 0; i < mine.length; i++) n += Number(mine[i].shards) || 0;
    return n;
  }

  function record(r, tier) {
    var st = statOf(r);
    return {
      i: String(r.i), n: r.n, j: r.j, y: r.y, e: r.e, s: r.s,
      img: r.img, work: r.work,
      rank: st.rank, tier: tier, total: st.total
    };
  }

  // ── 抽 ─────────────────────────────────────────────────
  function drawBatch(pool, count) {
    var g = KR.state.gacha;
    var out = [];
    var guaranteeUsed = false;
    for (var i = 0; i < count; i++) {
      var force = 0;
      if (count > 1 && i === count - 1 && !guaranteeUsed) {
        var anyHigh = false;
        for (var k = 0; k < out.length; k++) if (out[k].tier >= TEN_GUARANTEE) anyHigh = true;
        if (!anyHigh) force = TEN_GUARANTEE;
      }
      var need = force;
      if (g.pity + 1 >= PITY_MAX) need = Math.max(need, TIER_SS);

      var r = pickFrom(pool, need);
      if (!r) return out;
      var tier = tierOf(r);
      if (tier >= TEN_GUARANTEE) guaranteeUsed = true;

      g.pulls += 1;
      g.pity = tier >= TIER_SS ? 0 : g.pity + 1;

      var rec = record(r, tier);
      var owned = ownedEntry(rec.i);
      if (owned) {
        rec.dup = true;
        owned.shards = (Number(owned.shards) || 0) + 1;
        rec.shards = owned.shards;
      } else {
        rec.shards = 0;
        KR.state.myRiders.push(rec);
      }
      out.push(rec);
    }
    if (KR.save) KR.save();
    return out;
  }

  function syncHud() {
    var n = (KR.state && KR.state.myRiders ? KR.state.myRiders.length : 0);
    var nodes = KRD.qa('[data-bind="riders"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = KRD.fmtNum(n);
  }

  // ── 视图 ───────────────────────────────────────────────
  function mount(el, ctx) {
    STAT_CACHE = null;
    el.setAttribute('data-own', 'gacha');

    if (!KR.quest) {
      el.appendChild(KRH('section.panel.panel--quiet', {},
        KRH('div.panel-hd', {}, KRH('h2', { text: '抽卡' })),
        KRH('div.panel-bd', {}, KRH('div.empty', {},
          KRH('b', { text: '数值基座缺失' }),
          KRH('span', { text: 'views/map.js 未先加载，KR.quest 不存在。' })
        ))
      ));
      return;
    }
    if (!KR.RIDERS || !KR.RIDERS.length) {
      el.appendChild(KRH('section.panel.panel--quiet', {},
        KRH('div.panel-hd', {}, KRH('h2', { text: '抽卡' })),
        KRH('div.panel-bd', {}, KRH('div.empty', {},
          KRH('b', { text: '骑士数据未载入' }),
          KRH('span', { text: 'data/riders.js 未就绪，池子无法建立。' })
        ))
      ));
      return;
    }

    S = {
      type: 'era',
      value: '',
      busy: false,
      results: [],
      lastPool: null
    };

    var ERAS = eraPools();
    var SERIES = seriesPools();
    if (ERAS.length) { S.type = 'era'; S.value = ERAS[0].label; }
    else if (SERIES.length) { S.type = 'series'; S.value = SERIES[0].key; }

    function currentPool() {
      var arr = S.type === 'era' ? ERAS : SERIES;
      for (var i = 0; i < arr.length; i++) {
        if (S.type === 'era' ? arr[i].label === S.value : arr[i].key === S.value) return arr[i];
      }
      return arr[0] || null;
    }

    var head = KRH('header.gv-head');
    head.appendChild(KRH('div.t-eyebrow', { text: 'CARD SYSTEM' }));
    head.appendChild(KRH('h1.t-h1', { text: '抽卡' }));
    head.appendChild(KRH('p.gv-lede', {
      text: '两套池：按时代四大类，或按 43 个系列逐一取。每次抽取写进「我的骑士」，重复归一为残章。'
    }));

    var meters = KRH('div.gv-meters');
    head.appendChild(meters);

    var poolsBox = KRH('aside.gv-pools.panel.panel--quiet');
    poolsBox.appendChild(KRH('div.panel-hd', {}, KRH('h2', { text: '选池' })));
    var poolsBd = KRH('div.panel-bd.gv-pools-bd');
    poolsBox.appendChild(poolsBd);

    var main = KRH('div.gv-main');
    var summary = KRH('section.gv-summary.panel.panel--gold');
    var stage = KRH('section.gv-stage');
    var grid = KRH('div.gv-grid');
    var emptyHint = KRH('div.gv-empty', {},
      KRH('span.gv-empty-k', { text: 'NO DRAW' }),
      KRH('span', { text: '还没有抽取记录。选池后点「单抽 ×1」或「十连 ×10」。' })
    );
    stage.appendChild(grid);
    stage.appendChild(emptyHint);
    main.appendChild(summary);
    main.appendChild(stage);

    var body = KRH('div.gv-body', {}, poolsBox, main);
    el.appendChild(KRH('section.gv', {}, head, body));

    // ── 池列表 ───────────────────────────────────────────
    function buildPools() {
      KRD.clear(poolsBd);
      poolsBd.appendChild(KRH('div.gv-pool-k', { text: '按时代' }));
      var eraWrap = KRH('div.gv-pool-list');
      for (var i = 0; i < ERAS.length; i++) {
        (function (p) {
          eraWrap.appendChild(KRH('button.gv-pool' + (S.type === 'era' && S.value === p.label ? '.is-on' : ''), {
            type: 'button', 'data-pool': 'era', 'data-val': p.label
          },
            KRH('span.gv-pool-n', { text: p.label }),
            KRH('span.gv-pool-c.tnum', { text: String(p.riders.length) })
          ));
        })(ERAS[i]);
      }
      poolsBd.appendChild(eraWrap);

      poolsBd.appendChild(KRH('div.gv-pool-k', { text: '按系列（43）' }));
      var serWrap = KRH('div.gv-pool-list.gv-pool-list--long');
      for (var j = 0; j < SERIES.length; j++) {
        (function (p) {
          serWrap.appendChild(KRH('button.gv-pool' + (S.type === 'series' && S.value === p.key ? '.is-on' : ''), {
            type: 'button', 'data-pool': 'series', 'data-val': p.key
          },
            KRH('span.gv-pool-n', { text: p.label }),
            KRH('span.gv-pool-c.tnum', { text: String(p.riders.length) })
          ));
        })(SERIES[j]);
      }
      poolsBd.appendChild(serWrap);
    }

    // ── 读数 ─────────────────────────────────────────────
    function buildMeters() {
      KRD.clear(meters);
      var g = KR.state.gacha;
      function meter(k, v, cls) {
        meters.appendChild(KRH('div.gv-meter' + (cls ? '.' + cls : ''), {},
          KRH('span.gv-meter-k', { text: k }),
          KRH('span.gv-meter-v.tnum', { text: v })
        ));
      }
      meter('累计抽取', KRD.fmtNum(g.pulls));
      meter('保底计数', (PITY_MAX - g.pity) + ' / ' + PITY_MAX);
      meter('已拥有', KRD.fmtNum((KR.state.myRiders || []).length) + ' / ' + KRD.fmtNum(KR.RIDERS.length));
      meter('残章', KRD.fmtNum(shardTotal()));
    }

    // ── 池说明 ───────────────────────────────────────────
    function buildSummary() {
      var pool = currentPool();
      S.lastPool = pool;
      KRD.clear(summary);
      if (!pool) return;
      var c = compose(pool);
      var topRank = RANK_ORDER[c.maxTier];
      var highN = 0;
      for (var i = TIER_A; i < c.dist.length; i++) highN += c.dist[i];
      var highPct = c.count ? (highN / c.count * 100) : 0;

      summary.appendChild(KRH('div.panel-hd', {},
        KRH('span.gv-sum-k', { text: S.type === 'era' ? '时代池' : '系列池' }),
        KRH('h2', { text: pool.label })
      ));
      var bd = KRH('div.panel-bd.gv-sum-bd');

      var stats = KRH('div.gv-sum-stats');
      function cell(k, v) {
        stats.appendChild(KRH('div.gv-sum-cell', {},
          KRH('span.gv-sum-c-k', { text: k }),
          KRH('span.gv-sum-c-v', { text: v })
        ));
      }
      cell('骑士数', String(c.count));
      cell('最高评级', topRank);
      cell('A 以上', highN + ' 位 · ' + highPct.toFixed(1) + '%');
      cell('SS 保底', PITY_MAX + ' 抽');
      bd.appendChild(stats);

      var table = KRH('div.gv-rates');
      table.appendChild(KRH('span.gv-rates-k', { text: '本池评级分布' }));
      for (var t = RANK_ORDER.length - 1; t >= 0; t--) {
        if (!c.dist[t]) continue;
        var pct = (c.dist[t] / c.count * 100);
        table.appendChild(KRH('div.gv-rate', {},
          KRH('span.rank' + (t >= 6 ? '.rank--max' : (t >= 4 ? '.rank--hi' : '')), { text: RANK_ORDER[t] }),
          KRH('div.gv-rate-bar', {}, KRH('i', { style: { '--v': String(Math.max(2, Math.round(pct))) } })),
          KRH('span.gv-rate-p.tnum', { text: pct.toFixed(1) + '%' }),
          KRH('span.gv-rate-n.tnum', { text: String(c.dist[t]) })
        ));
      }
      bd.appendChild(table);

      bd.appendChild(KRH('p.gv-sum-note', {
        text: '概率按本池实际构成计算：同池内等概率抽取，档位由骑士记录确定性推出。十连必出 A 以上，' +
          PITY_MAX + ' 抽必出 SS 以上；本池若不足该档，保底顺延至池内最高档。'
      }));

      var ft = KRH('div.gv-draw');
      ft.appendChild(KRH('button.btn.btn-gold.btn-lg.gv-draw-btn', {
        type: 'button', 'data-draw': '1', disabled: !c.count
      }, '单抽 ×1'));
      ft.appendChild(KRH('button.btn.btn-red.btn-lg.gv-draw-btn', {
        type: 'button', 'data-draw': '10', disabled: !c.count
      }, '十连 ×10'));
      ft.appendChild(KRH('button.btn.btn-ghost.btn-lg', {
        type: 'button', 'data-act': 'to-create'
      }, '去创造角色'));
      bd.appendChild(ft);

      summary.appendChild(bd);
    }

    // ── 结果 ─────────────────────────────────────────────
    function paintGrid() {
      KRD.clear(grid);
      if (!S.results.length) {
        emptyHint.removeAttribute('hidden');
        return;
      }
      emptyHint.setAttribute('hidden', '');
      var step = S.results.length > 1 ? 60 : 0;
      for (var i = 0; i < S.results.length; i++) {
        (function (rec, n) {
          var delay = Math.min(1200, n * step);
          var card = KRH('article.gv-card', {
            'data-tier': RANK_ORDER[rec.tier],
            style: { '--d': delay + 'ms' }
          },
            KRH('div.gv-card-back', {}, KRH('span.gv-card-back-n', { text: 'KR' })),
            KRH('div.gv-card-front.plate.plate--flat', {},
              KRH('div.gv-card-pic.plate.plate--flat', {},
                KRH('img', { 'data-kr-img': rec.img, 'data-kr-thumb': '1', alt: rec.n })
              ),
              KRH('div.gv-card-t', {},
                KRH('b', { text: rec.n }),
                KRH('i', { text: seriesName(rec.s) + ' · ' + (rec.y || '—') })
              ),
              KRH('span.rank' + (rec.tier >= 6 ? '.rank--max' : (rec.tier >= 4 ? '.rank--hi' : '')), { text: rec.rank }),
              rec.dup ? KRH('span.gv-dup', { text: '已拥有 · 残章 +1' }) : null
            )
          );
          grid.appendChild(card);
        })(S.results[i], i);
      }
      if (KRIMG) KRIMG.observe(grid);
    }

    function runDraw(count) {
      if (S.busy) return;
      var pool = currentPool();
      if (!pool || !pool.riders.length) { if (KR.toast) KR.toast('这个池子是空的', 'warn'); return; }
      S.busy = true;
      S.results = drawBatch(pool, count);
      buildMeters();
      paintGrid();
      syncHud();
      var top = 0;
      for (var i = 0; i < S.results.length; i++) if (S.results[i].tier > top) top = S.results[i].tier;
      if (KR.toast) {
        var dupNum = S.results.filter(function (x) { return x.dup; }).length;
        KR.toast('抽到 ' + count + ' 张 · 最高 ' + RANK_ORDER[top] + (dupNum ? ' · 重复 ' + dupNum : ''), top >= 6 ? 'ok' : '');
      }
      var wait = KRA && KRA.reduced ? 0 : Math.min(1600, 400 + count * 80);
      setTimeout(function () { S.busy = false; }, wait);
    }

    // ── 事件 ─────────────────────────────────────────────
    KRD.on(poolsBox, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-pool]') : null;
      if (!btn) return;
      S.type = btn.getAttribute('data-pool');
      S.value = btn.getAttribute('data-val');
      var all = KRD.qa('.gv-pool', poolsBd);
      for (var i = 0; i < all.length; i++) {
        all[i].classList.toggle('is-on',
          all[i].getAttribute('data-pool') === S.type && all[i].getAttribute('data-val') === S.value);
      }
      S.results = [];
      buildSummary();
      paintGrid();
    });

    KRD.on(summary, 'click', function (ev) {
      var t = ev.target;
      var drawBtn = t && t.closest ? t.closest('[data-draw]') : null;
      if (drawBtn) { runDraw(Number(drawBtn.getAttribute('data-draw')) || 1); return; }
      var actBtn = t && t.closest ? t.closest('[data-act]') : null;
      if (actBtn && actBtn.getAttribute('data-act') === 'to-create') KR.go('/create');
    });

    buildPools();
    buildMeters();
    buildSummary();
    paintGrid();
  }

  function unmount(el) {
    S = null;
    STAT_CACHE = null;
    if (el) {
      el.removeAttribute('data-own');
      KRD.clear(el);
    }
  }

  KR.gachaPools = { era: eraPools, series: seriesPools };

  KR.views.gacha = {
    title: '抽卡',
    mount: mount,
    unmount: unmount
  };
})(window);
