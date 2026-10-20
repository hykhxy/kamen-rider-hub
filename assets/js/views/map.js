// owner: quest-create — 关卡地图（战术图）；顺带提供 create/gacha 共用的确定性数值基座 KR.quest
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRD = global.KRD;
  var KRH = global.KRH;
  var KRIMG = global.KRIMG;

  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) v = lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d || 0);
  }

  function pad2(n) {
    n = num(n, 0);
    return n < 10 ? '0' + n : String(n);
  }

  // ── 确定性数值基座 ─────────────────────────────────────
  // KRSTAT 由 roster-rider 交付；未就绪时用同形状的本地实现顶上，
  // 保证同一 kind+id 每次结果一致（禁 Math.random / Date）。
  var RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  var RANK_CUT = [44, 54, 62, 70, 78, 84, 90];

  function hash32(s) {
    var h = 2166136261;
    var t = String(s);
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function unitOf(seed) { return (hash32(seed) % 1000003) / 1000003; }

  function rankOf(total) {
    var r = 0;
    for (var i = 0; i < RANK_CUT.length; i++) if (total >= RANK_CUT[i]) r = i + 1;
    return RANKS[r];
  }

  function rankIndex(rank) {
    var i = RANKS.indexOf(String(rank));
    return i < 0 ? 0 : i;
  }

  function hasAny(text, words) {
    for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) >= 0) return true;
    return false;
  }

  // 旗帜骑士：作品 riders[0] 视为该作主骑，数值上确有一档加成
  var FLAGSHIP = null;
  function flagshipSet() {
    if (FLAGSHIP) return FLAGSHIP;
    FLAGSHIP = {};
    var list = (KR.WORLD && KR.WORLD.works) || [];
    for (var i = 0; i < list.length; i++) {
      var first = (list[i].riders || [])[0];
      if (first) FLAGSHIP[first] = 1;
    }
    return FLAGSHIP;
  }

  function localStat(kind, rec) {
    rec = rec || {};
    var id = String(rec.i || rec.id || rec.n || 'unknown');
    var seed = kind + '|' + id;
    var text = String(rec.name || rec.n || '') + ' ' + String(rec.lore || '');
    var formCount = Array.isArray(rec.forms) ? rec.forms.length : num(rec.formCount, 0);
    var itemCount = Array.isArray(rec.items) ? rec.items.length : 0;

    var u0 = unitOf(seed + '|a');
    var u1 = unitOf(seed + '|b');
    var u2 = unitOf(seed + '|c');
    var u3 = unitOf(seed + '|d');
    var u5 = unitOf(seed + '|core');

    var bulk = Math.min(14, formCount * 1.6);
    var gear = Math.min(10, itemCount * 1.1) + (rec.belt ? 3 : 0) + (rec.bike ? 2 : 0);
    var berserk = text.indexOf('暴走') >= 0;
    var flight = text.indexOf('飞行') >= 0;
    var boost = hasAny(text, ['强化', '升级', '最终']);
    var beast = text.indexOf('怪人态') >= 0;
    var kw = (berserk ? 8 : 0) + (flight ? 5 : 0) + (boost ? 6 : 0) + (beast ? 3 : 0);
    var flag = (kind === 'rider' && flagshipSet()[rec.n]) ? 13 : 0;

    var core = clamp(Math.round(27 + u5 * 34 + (bulk + gear + kw) * 0.85 + flag), 10, 99);

    var pow = clamp(Math.round(core + (u0 - 0.5) * 22 + (berserk ? 9 : 0) - (beast ? 4 : 0)), 0, 100);
    var spd = clamp(Math.round(core + (u1 - 0.5) * 22 + (flight ? 10 : 0) - (bulk > 8 ? 3 : 0)), 0, 100);
    var skl = clamp(Math.round(core + (u2 - 0.5) * 22 + (boost ? 4 : 0) - (berserk ? 6 : 0)), 0, 100);
    var def = clamp(Math.round(core + (u3 - 0.5) * 22 + (beast ? 7 : 0) - (flight ? 3 : 0)), 0, 100);

    var total = clamp(Math.round(pow * 0.28 + spd * 0.24 + skl * 0.26 + def * 0.22), 0, 100);
    var note = berserk ? '形态失控，出力不稳'
      : (boost ? '多段强化，代价明确'
        : (flight ? '空战权重高于地面' : '武装偏均衡'));

    return {
      pow: pow, spd: spd, skl: skl, def: def,
      total: total,
      rank: rankOf(total),
      bars: [
        { k: '力', v: pow }, { k: '速', v: spd },
        { k: '术', v: skl }, { k: '防', v: def }
      ],
      note: note
    };
  }

  function statOf(kind, rec) {
    var S = global.KRSTAT;
    if (S && typeof S.of === 'function') {
      try {
        var out = S.of(kind, rec);
        if (out && isFinite(out.total) && out.rank && out.bars && out.bars.length === 4) return out;
      } catch (e) {
        if (KR.report) KR.report('KRSTAT.of', e);
      }
    }
    return localStat(kind, rec);
  }

  KR.quest = {
    hash32: hash32,
    unitOf: unitOf,
    statOf: statOf,
    localStat: localStat,
    rankOf: rankOf,
    rankIndex: rankIndex,
    RANKS: RANKS,
    clamp: clamp,
    num: num,
    pad2: pad2
  };

  // ── 关卡切分 ───────────────────────────────────────────
  var LEVELS = [
    {
      key: 'L1', no: '01', name: '昭和·创世线', span: '1971–1994',
      note: '改造手术台造出的第一批身体。修卡、迪斯特龙、G.O.D、黑撒旦、戈尔戈姆到克莱西斯，名字一直换，媒介没换：把人拆开再装回去。'
    },
    {
      key: 'L2', no: '02', name: '平成·令和·新时代线', span: '2000–2026',
      note: '遗迹、契约、商品、故事。形态开始记账，敌人从九郎岳地底、镜面、数据流与传说里出来；到令和，叙事本身成了战场。'
    }
  ];

  function levelOf(work) {
    var era = String(work.era || '');
    var y = num(work.year, 0);
    if (era === '昭和') return 0;
    if (era === '平成' || era === '令和') return 1;
    if (!y) return 1;
    return Math.abs(y - 1994) <= Math.abs(y - 2000) ? 0 : 1;
  }

  function buildLevelAll() {
    var all = (KR.WORLD && KR.WORLD.works) || [];
    var buckets = [
      { nodes: [], notes: [] },
      { nodes: [], notes: [] }
    ];
    for (var i = 0; i < all.length; i++) {
      var w = all[i];
      if (!w || !w.id || !num(w.no, 0)) continue;
      var idx = levelOf(w);
      var b = buckets[idx];
      var y = num(w.year, 0);
      if (!String(w.era || '') || !y) {
        b.notes.push(pad2(w.no) + ' ' + w.title + '：年份或时代缺失，按年份距离挂到本关');
      } else if (idx === 0 && y > 1989) {
        b.notes.push(pad2(w.no) + ' ' + w.title + '（' + y + '）：超出 1971–1989 窗口，era 记昭和，按纪归入第一关');
      }
      b.nodes.push(w);
    }
    for (var k = 0; k < buckets.length; k++) {
      buckets[k].nodes.sort(function (a, c) {
        return (num(a.year, 0) - num(c.year, 0)) || (num(a.no, 0) - num(c.no, 0));
      });
    }
    return buckets;
  }

  // ── 几何：年份定 x，序号定同年错位；全程确定性 ────────
  var MAP_H = 620;

  function geometry(nodes) {
    var n = nodes.length;
    var W = Math.max(1240, 200 + n * 78);
    var padL = 96;
    var padR = 96;
    var usable = Math.max(1, W - padL - padR);
    var years = [];
    var i;
    for (i = 0; i < n; i++) years.push(num(nodes[i].year, 1971));
    var minY = n ? Math.min.apply(null, years) : 1971;
    var maxY = n ? Math.max.apply(null, years) : 1971;
    var span = Math.max(1, maxY - minY);

    var xs = [];
    for (i = 0; i < n; i++) xs.push(padL + ((years[i] - minY) / span) * usable);

    var buckets = {};
    for (i = 0; i < n; i++) {
      var key = Math.round(xs[i]);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(i);
    }
    for (var g in buckets) {
      if (!Object.prototype.hasOwnProperty.call(buckets, g)) continue;
      var list = buckets[g];
      if (list.length < 2) continue;
      for (var m = 0; m < list.length; m++) xs[list[m]] += (m - (list.length - 1) / 2) * 46;
    }

    function axisY(x) {
      var t = clamp((x - padL) / usable, 0, 1);
      return MAP_H * 0.5 + Math.sin(t * Math.PI * 2.0) * 74 + Math.sin(t * Math.PI * 5.1) * 24;
    }

    var pts = [];
    for (i = 0; i < n; i++) pts.push({ x: xs[i], y: axisY(xs[i]) });

    return { w: W, h: MAP_H, padL: padL, usable: usable, minY: minY, maxY: maxY, pts: pts, axisY: axisY };
  }

  function contourPath(cx, cy, rx, ry, seed, steps) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2;
      var k = 1 + Math.sin(t * 3 + seed) * 0.10 + Math.sin(t * 5 + seed * 1.7) * 0.05;
      pts.push((cx + Math.cos(t) * rx * k).toFixed(1) + ' ' + (cy + Math.sin(t) * ry * k).toFixed(1));
    }
    return 'M' + pts.join(' L') + ' Z';
  }

  function openingOf(work) {
    var list = (KR.WORLD && KR.WORLD.openings) || [];
    for (var i = 0; i < list.length; i++) if (list[i].work === work.title) return list[i];
    return null;
  }

  function riderOf(work) {
    var names = work.riders || [];
    var riders = KR.RIDERS || [];
    for (var i = 0; i < names.length; i++) {
      for (var j = 0; j < riders.length; j++) if (riders[j].n === names[i]) return riders[j];
    }
    return null;
  }

  function monstersReady() { return !!(KR.IMG && KR.IMG.monsters && KR.IMG.monsters.length); }

  function foesOf(work, limit) {
    if (!monstersReady()) return [];
    var byName = {};
    var list = KR.IMG.monsters;
    var i;
    for (i = 0; i < list.length; i++) if (!byName[list[i].n]) byName[list[i].n] = list[i];

    var out = [];
    var enemies = work.enemies || [];
    for (i = 0; i < enemies.length && out.length < limit; i++) {
      if (byName[enemies[i]] && out.indexOf(byName[enemies[i]]) < 0) out.push(byName[enemies[i]]);
    }

    var series = (work.series || [])[0];
    var year = num(work.year, 0);
    for (i = 0; i < list.length && out.length < limit; i++) {
      var m = list[i];
      if (out.indexOf(m) >= 0) continue;
      if ((series != null && m.s === series) || Math.abs(num(m.y, 0) - year) <= 1) out.push(m);
    }

    // 2023 之后的新作在图鉴里还没有专属怪人，退到同时代的怪人，别让特写层空着
    if (!out.length) {
      var era = String(work.era || '');
      for (i = list.length - 1; i >= 0 && out.length < limit; i--) {
        if (era && list[i].e !== era) continue;
        if (out.indexOf(list[i]) < 0) out.push(list[i]);
      }
    }
    return out;
  }

  function nodeTitle(work) {
    var t = String(work.title || '');
    return t.length > 6 ? t.slice(0, 6) : t;
  }

  // ── 战术图 ─────────────────────────────────────────────
  function buildStage(nodes, geo) {
    var svg = KRH('svg.map-svg', {
      viewBox: '0 0 ' + geo.w + ' ' + geo.h,
      width: geo.w, height: geo.h,
      preserveAspectRatio: 'xMinYMin meet',
      role: 'img', 'aria-label': '关卡战术图'
    });

    var contour = KRH('g.map-contour', { 'aria-hidden': 'true' });
    var seeds = [[0.30, 0.30, 1.7], [0.74, 0.72, 4.1]];
    for (var s = 0; s < seeds.length; s++) {
      var cx = geo.w * seeds[s][0];
      var cy = geo.h * seeds[s][1];
      for (var ring = 1; ring <= 4; ring++) {
        contour.appendChild(KRH('path.map-contour-line', {
          d: contourPath(cx, cy, geo.w * 0.15 * ring, geo.h * 0.17 * ring, seeds[s][2] + ring * 0.9, 72)
        }));
      }
    }
    svg.appendChild(contour);

    var band = [];
    for (var bx = geo.padL - 60; bx <= geo.w - geo.padL + 60; bx += 26) {
      band.push(bx + ' ' + geo.axisY(bx).toFixed(1));
    }
    var axisD = 'M' + band.join(' L');
    svg.appendChild(KRH('path.map-axis', { d: axisD, 'aria-hidden': 'true' }));

    var routeD = [];
    for (var i = 0; i < geo.pts.length; i++) {
      routeD.push((i ? 'L' : 'M') + geo.pts[i].x.toFixed(1) + ' ' + geo.pts[i].y.toFixed(1));
    }
    svg.appendChild(KRH('path.map-link', { d: routeD.join(' '), 'aria-hidden': 'true' }));

    var ticks = KRH('g.map-ticks', { 'aria-hidden': 'true' });
    for (var tx = 0; tx <= geo.w; tx += 100) {
      var majX = (tx % 400 === 0);
      ticks.appendChild(KRH('line.map-tick', { x1: tx, y1: 0, x2: tx, y2: majX ? 16 : 8 }));
      ticks.appendChild(KRH('line.map-tick', { x1: tx, y1: geo.h, x2: tx, y2: geo.h - (majX ? 16 : 8) }));
      if (majX) ticks.appendChild(KRH('text.map-tick-lbl', { x: tx + 5, y: 27, text: pad2(tx / 100) }));
    }
    for (var ty = 0; ty <= geo.h; ty += 100) {
      var majY = (ty % 200 === 0);
      ticks.appendChild(KRH('line.map-tick', { x1: 0, y1: ty, x2: majY ? 16 : 8, y2: ty }));
      ticks.appendChild(KRH('line.map-tick', { x1: geo.w, y1: ty, x2: geo.w - (majY ? 16 : 8), y2: ty }));
      if (majY) ticks.appendChild(KRH('text.map-tick-lbl', { x: 20, y: ty - 4, text: 'K' + pad2(ty / 200) }));
    }
    svg.appendChild(ticks);

    var cross = KRH('g.map-cross', { 'aria-hidden': 'true' });
    cross.appendChild(KRH('line', { x1: geo.w / 2 - 30, y1: geo.h / 2, x2: geo.w / 2 + 30, y2: geo.h / 2 }));
    cross.appendChild(KRH('line', { x1: geo.w / 2, y1: geo.h / 2 - 30, x2: geo.w / 2, y2: geo.h / 2 + 30 }));
    cross.appendChild(KRH('circle.map-cross-ring', { cx: geo.w / 2, cy: geo.h / 2, r: 44 }));
    svg.appendChild(cross);

    var lead = KRH('g.map-lead', {});
    lead.appendChild(KRH('line.map-lead-line', { x1: 0, y1: 0, x2: geo.w / 2, y2: geo.h / 2 }));
    lead.appendChild(KRH('circle.map-lead-tip', { cx: 0, cy: 0, r: 4 }));
    lead.setAttribute('hidden', '');
    svg.appendChild(lead);

    var layer = KRH('g.map-nodes');
    for (var n = 0; n < nodes.length; n++) {
      var w = nodes[n];
      var pt = geo.pts[n];
      var side = (n % 2 === 0) ? -1 : 1;
      var plateAnchor = side * 40;
      var name = nodeTitle(w);
      var plateW = Math.max(98, Math.round(34 + name.length * 12.5 + 48));

      var g = KRH('g.map-node', {
        transform: 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ')',
        'data-wid': w.id, 'data-no': pad2(w.no),
        tabindex: '0', role: 'button',
        'aria-label': pad2(w.no) + ' ' + w.title + ' ' + num(w.year, 0)
      });
      var inner = KRH('g.map-node-in');
      inner.appendChild(KRH('circle.map-node-hit', { r: 19 }));
      var core = KRH('g.map-node-core');
      core.appendChild(KRH('circle.map-node-ring', { r: 11 }));
      core.appendChild(KRH('circle.map-node-dot', { r: 3.4 }));
      inner.appendChild(core);
      inner.appendChild(KRH('line.map-node-stem', { x1: 0, y1: 0, x2: 0, y2: plateAnchor }));

      var tagHold = KRH('g', { transform: 'translate(11,-9)' });
      tagHold.appendChild(KRH('g.map-node-tag', {}, KRH('text', { y: 3.6, text: pad2(w.no) })));
      inner.appendChild(tagHold);

      var holder = KRH('g', {
        transform: 'translate(' + (-Math.round(plateW / 2)) + ',' + (side > 0 ? plateAnchor : plateAnchor - 30) + ')'
      });
      var plate = KRH('g.map-node-plate');
      plate.appendChild(KRH('rect.map-plate-bg', { width: plateW, height: 30, rx: 1 }));
      plate.appendChild(KRH('text.map-node-no', { x: 8, y: 20, text: pad2(w.no) }));
      plate.appendChild(KRH('text.map-node-name', { x: 34, y: 20, text: name }));
      plate.appendChild(KRH('text.map-node-year', { x: plateW - 8, y: 20, text: String(num(w.year, 0)), 'text-anchor': 'end' }));
      holder.appendChild(plate);
      inner.appendChild(holder);
      g.appendChild(inner);
      layer.appendChild(g);
    }
    svg.appendChild(layer);
    return svg;
  }

  function renderPanel(host, work) {
    KRD.clear(host);
    if (!work) {
      host.appendChild(KRH('div.panel-hd', {}, KRH('h2', { text: '地点档案' })));
      host.appendChild(KRH('div.panel-bd', {}, KRH('div.empty', {},
        KRH('b', { text: '未选择地点' }),
        KRH('span', { text: '在战术图上点一个节点，这里出该作的开场资料。' })
      )));
      return;
    }

    var op = openingOf(work);
    var r = riderOf(work);

    host.appendChild(KRH('div.panel-hd', {},
      KRH('span.map-panel-no', { text: pad2(work.no) }),
      KRH('h2', { text: work.title })
    ));

    var bd = KRH('div.panel-bd.map-panel-bd');
    var grid = KRH('div.map-kv-grid');
    function row(k, v) {
      grid.appendChild(KRH('div.map-kv', {},
        KRH('span.map-kk', { text: k }),
        KRH('span.map-kv-t', { text: (v == null || v === '') ? '—' : String(v) })
      ));
    }
    row('年份', num(work.year, 0) + ' 年');
    row('时代', work.era || '未归类');
    row('敌对组织', work.org || '—');
    row('敌方代表', (work.enemies || []).length ? work.enemies.join('／') : '无记载');
    row('舞台', work.stage || '—');
    bd.appendChild(grid);

    if (work.theme) {
      bd.appendChild(KRH('p.map-theme', { text: '“' + work.theme + '”' }));
    }

    if (op) {
      var brief = KRH('div.map-brief');
      brief.appendChild(KRH('div.t-eyebrow', { text: 'STARTING HOOK' }));
      brief.appendChild(KRH('div.map-idn', {},
        KRH('span.map-kk', { text: '身份' }),
        KRH('b', { text: op.idn || '—' })
      ));
      brief.appendChild(KRH('p.map-hook', { text: op.hook || '' }));
      bd.appendChild(brief);
    }

    if (r) {
      bd.appendChild(KRH('div.map-sig', {},
        KRH('img.map-sig-img', { 'data-kr-img': r.img, 'data-kr-thumb': '1', alt: r.n }),
        KRH('div.map-sig-t', {},
          KRH('span.map-kk', { text: '本作主骑士' }),
          KRH('b', { text: r.n }),
          KRH('span.sm.muted', {
            text: (KR.WORLD.series[r.s] ? KR.WORLD.series[r.s].name : '未归类') + ' · 形态 ' + (r.forms ? r.forms.length : 0) + ' 条'
          })
        )
      ));
    }

    host.appendChild(bd);
    host.appendChild(KRH('div.panel-ft', {},
      KRH('button.btn.btn-gold.btn-block', {
        type: 'button', 'data-act': 'enter'
      }, '进入事件')
    ));
    if (KRIMG) KRIMG.observe(host);
  }

  function renderCloseLayer(stage, work) {
    var old = stage.querySelector('.map-close');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!work) return;

    var layer = KRH('div.map-close');
    var tex = KRH('div.map-tex', { 'aria-hidden': 'true' });
    var r = riderOf(work);
    var texPath = r ? r.img : '';
    if (!texPath) {
      var texFoe = foesOf(work, 1);
      if (texFoe.length) texPath = texFoe[0].p;
    }
    if (texPath) tex.appendChild(KRH('img.map-tex-img', { 'data-kr-img': texPath, alt: '' }));
    tex.appendChild(KRH('div.map-tex-hatch'));
    layer.appendChild(tex);

    var foes = KRH('div.map-foes');
    foes.appendChild(KRH('span.map-foes-k', { text: '敌方剪影' }));

    if (!monstersReady()) {
      foes.appendChild(KRH('span.skel.map-foe-skel'));
      if (KR.load) {
        KR.load('data/img-monsters.js').then(function () {
          if (S && S.view === 'close' && stage.querySelector('.map-close')) renderCloseLayer(stage, work);
        }, function () {});
      }
    } else {
      var list = foesOf(work, 5);
      for (var i = 0; i < list.length; i++) {
        foes.appendChild(KRH('figure.map-foe', {},
          KRH('img', { 'data-kr-img': list[i].p, 'data-kr-thumb': '1', alt: list[i].n }),
          KRH('figcaption', { text: list[i].n })
        ));
      }
      if (!list.length) foes.appendChild(KRH('span.sm.muted', { text: '该作未收录怪人图像' }));
    }
    layer.appendChild(foes);
    stage.appendChild(layer);
    if (KRIMG) KRIMG.observe(layer);
  }

  // ── 视图 ───────────────────────────────────────────────
  var S = null;

  function mount(el, ctx) {
    S = { level: 0, view: 'overview', selId: '', nodes: [], geo: null, offResize: null, levels: null, notesOpen: false };
    el.setAttribute('data-own', 'map');

    if (!KR.WORLD || !KR.WORLD.works || !KR.WORLD.works.length) {
      el.appendChild(KRH('section.panel.panel--quiet', {},
        KRH('div.panel-hd', {}, KRH('h2', { text: '关卡' })),
        KRH('div.panel-bd', {}, KRH('div.empty', {},
          KRH('b', { text: '世界数据未载入' }),
          KRH('span', { text: 'data/world.js 未就绪，两张地图无法切分。' })
        ))
      ));
      return;
    }

    S.levels = buildLevelAll();
    S.noteTotal = S.levels[0].notes.length + S.levels[1].notes.length;

    var head = KRH('header.map-head');
    head.appendChild(KRH('div.t-eyebrow', { text: 'STAGE SELECT' }));
    head.appendChild(KRH('h1.t-h1', { text: '关卡 · 两张地图' }));

    var levels = KRH('div.map-levels', { role: 'group', 'aria-label': '关卡切换' });
    var metaLine = KRH('div.map-meta');
    var notesBox = KRH('div.map-notes');
    var desc = KRH('p.map-desc');
    head.appendChild(levels);
    head.appendChild(metaLine);
    head.appendChild(notesBox);
    head.appendChild(desc);

    var stage = KRH('div.map-stage');
    var canvas = KRH('div.map-canvas');
    stage.appendChild(canvas);

    var views = KRH('div.map-views', { role: 'group', 'aria-label': '视角切换' });
    var VIEW_DEF = [
      { key: 'overview', label: '全览', hint: '整图 fit，全部节点与连接线' },
      { key: 'region', label: '区域', hint: '选中节点 1.8×，带悬浮铭牌' },
      { key: 'close', label: '特写', hint: '3.2×，舞台纹理 + 敌方剪影' }
    ];
    function bindView(def) {
      views.appendChild(KRH('button.btn.btn-sm.map-vbtn', {
        type: 'button', 'data-view': def.key, title: def.hint
      }, def.label));
    }
    for (var v = 0; v < VIEW_DEF.length; v++) bindView(VIEW_DEF[v]);
    stage.appendChild(views);

    var panel = KRH('aside.map-panel.panel.panel--quiet');
    el.appendChild(KRH('section.mapview', {}, head, KRH('div.map-body', {}, stage, panel)));

    function currentWork() {
      for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === S.selId) return S.nodes[i];
      return null;
    }

    function applyView() {
      var geo = S.geo;
      if (!geo) return;
      var vw = stage.clientWidth || 0;
      var vh = stage.clientHeight || 0;
      if ((!vw || !vh) && stage.getBoundingClientRect) {
        var box = stage.getBoundingClientRect();
        vw = vw || box.width;
        vh = vh || box.height;
      }
      vw = vw || 1120;
      vh = vh || 560;

      var fit = Math.min(vw / geo.w, vh / geo.h);
      var scale = fit;
      var tx = (vw - geo.w * fit) / 2;
      var ty = (vh - geo.h * fit) / 2;

      if (S.view !== 'overview' && S.selId) {
        var idx = -1;
        for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === S.selId) idx = i;
        if (idx >= 0) {
          scale = fit * (S.view === 'close' ? 3.2 : 1.8);
          tx = vw / 2 - geo.pts[idx].x * scale;
          ty = vh / 2 - geo.pts[idx].y * scale;
        }
      }

      canvas.style.setProperty('--s', scale.toFixed(4));
      canvas.style.setProperty('--x', tx.toFixed(1) + 'px');
      canvas.style.setProperty('--y', ty.toFixed(1) + 'px');
      canvas.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' +
        ty.toFixed(1) + 'px,0) scale(' + scale.toFixed(4) + ')';

      var target = S.view === 'close' ? 1.15 : 1.0;
      stage.style.setProperty('--lbl', clamp(target / scale, 0.14, 2.6).toFixed(3));
    }

    function paintSelection() {
      var nodes = KRD.qa('.map-node', canvas);
      var sel = null;
      for (var i = 0; i < nodes.length; i++) {
        var on = nodes[i].getAttribute('data-wid') === S.selId;
        nodes[i].classList.toggle('is-sel', on);
        if (on) sel = nodes[i];
      }

      var lead = canvas.querySelector('.map-lead');
      var work = currentWork();
      if (lead) {
        if (work) {
          lead.removeAttribute('hidden');
          var ix = 0, iy = 0;
          for (var j = 0; j < S.nodes.length; j++) {
            if (S.nodes[j].id === S.selId) { ix = S.geo.pts[j].x; iy = S.geo.pts[j].y; }
          }
          var line = lead.querySelector('.map-lead-line');
          var tip = lead.querySelector('.map-lead-tip');
          if (line) { line.setAttribute('x1', ix.toFixed(1)); line.setAttribute('y1', iy.toFixed(1)); }
          if (tip) { tip.setAttribute('cx', ix.toFixed(1)); tip.setAttribute('cy', iy.toFixed(1)); }
        } else {
          lead.setAttribute('hidden', '');
        }
      }

      renderPanel(panel, work);
      stage.classList.toggle('has-sel', !!work);
      if (S.view === 'close') renderCloseLayer(stage, work);
      else {
        var old = stage.querySelector('.map-close');
        if (old && old.parentNode) old.parentNode.removeChild(old);
      }
    }

    function paintViewButtons() {
      var btns = KRD.qa('.map-vbtn', views);
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-view') === S.view;
        btns[i].classList.toggle('is-on', on);
        btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      stage.setAttribute('data-view', S.view);
    }

    function setView(key) {
      if (key !== 'overview' && key !== 'region' && key !== 'close') return;
      if (S.view === key) return;
      S.view = key;
      paintViewButtons();
      applyView();
      paintSelection();
    }

    function selectNode(wid) {
      if (!wid) return;
      S.selId = wid;
      paintSelection();
      if (S.view !== 'overview') applyView();
    }

    function paintLevels() {
      KRD.clear(levels);
      for (var i = 0; i < LEVELS.length; i++) {
        (function (index) {
          var def = LEVELS[index];
          levels.appendChild(KRH('button.map-lv' + (index === S.level ? '.is-on' : ''), {
            type: 'button', 'data-lv': String(index),
            'aria-pressed': index === S.level ? 'true' : 'false'
          },
            KRH('span.map-lv-no', { text: '关卡 ' + def.no }),
            KRH('span.map-lv-name', { text: def.name }),
            KRH('span.map-lv-count', { text: String(S.levels[index].nodes.length) })
          ));
        })(i);
      }
    }

    function paintMeta() {
      var def = LEVELS[S.level];
      KRD.clear(metaLine);
      metaLine.appendChild(KRH('span.map-meta-k', { text: def.no + ' · ' + def.span }));
      metaLine.appendChild(KRH('span.map-meta-v', { text: '节点 ' + S.nodes.length + ' / ' + KR.WORLD.works.length }));
      metaLine.appendChild(KRH('span.map-meta-v', { text: '全图 ' + S.noteTotal + ' 处区间挂靠' }));
      desc.textContent = def.note;
    }

    function paintNotes() {
      KRD.clear(notesBox);
      var notes = S.levels[S.level].notes;
      if (!notes.length) {
        notesBox.setAttribute('hidden', '');
        return;
      }
      notesBox.removeAttribute('hidden');
      var open = !!S.notesOpen;
      notesBox.appendChild(KRH('button.map-notes-tg' + (open ? '.is-open' : ''), {
        type: 'button', 'aria-expanded': open ? 'true' : 'false',
        onclick: function () { S.notesOpen = !S.notesOpen; paintNotes(); }
      },
        KRH('span.map-notes-k', { text: '区间挂靠说明' }),
        KRH('span.map-notes-n.tnum', { text: String(notes.length) }),
        KRH('span.map-notes-i', { text: open ? '收起' : '展开' })
      ));
      if (!open) return;
      var ul = KRH('ul.map-notes-list');
      for (var i = 0; i < notes.length; i++) ul.appendChild(KRH('li', { text: notes[i] }));
      notesBox.appendChild(ul);
    }

    function paintCanvas() {
      S.nodes = S.levels[S.level].nodes;
      S.geo = geometry(S.nodes);
      KRD.clear(canvas);
      canvas.appendChild(buildStage(S.nodes, S.geo));
      canvas.style.width = S.geo.w + 'px';
      canvas.style.height = S.geo.h + 'px';

      var keep = false;
      for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === S.selId) keep = true;
      if (!keep) S.selId = S.nodes.length ? S.nodes[0].id : '';

      paintLevels();
      paintMeta();
      paintNotes();
      paintViewButtons();
      applyView();
      paintSelection();
    }

    KRD.on(levels, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-lv]') : null;
      if (!btn) return;
      var index = Number(btn.getAttribute('data-lv'));
      if (index === S.level) return;
      S.level = index;
      S.selId = '';
      paintCanvas();
    });

    KRD.on(views, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-view]') : null;
      if (!btn) return;
      setView(btn.getAttribute('data-view'));
    });

    KRD.on(canvas, 'click', function (ev) {
      var node = ev.target && ev.target.closest ? ev.target.closest('.map-node') : null;
      if (!node) return;
      selectNode(node.getAttribute('data-wid'));
    });

    KRD.on(canvas, 'keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var node = ev.target && ev.target.closest ? ev.target.closest('.map-node') : null;
      if (!node) return;
      ev.preventDefault();
      selectNode(node.getAttribute('data-wid'));
    });

    KRD.on(panel, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn || btn.getAttribute('data-act') !== 'enter') return;
      var work = currentWork();
      if (!work) { if (KR.toast) KR.toast('先选一个地点', 'warn'); return; }
      KR.state.lastNode = num(work.no, 0);
      KR.go('/create?work=' + encodeURIComponent(work.id) + '&node=' + num(work.no, 0));
    });

    S.offResize = KRD.on(global, 'resize', KRD.debounce(function () { applyView(); }, 140));

    paintCanvas();

    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(function () { if (S) applyView(); });
    }
  }

  function unmount(el) {
    if (S && S.offResize) { S.offResize(); S.offResize = null; }
    S = null;
    if (el) {
      el.removeAttribute('data-own');
      KRD.clear(el);
    }
  }

  KR.mapLevels = LEVELS;
  KR.mapLevelOf = levelOf;
  KR.mapSplit = buildLevelAll;

  KR.views.map = {
    title: '关卡',
    mount: mount,
    unmount: unmount
  };
})(window);
