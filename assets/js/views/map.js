// owner: quest-create — 关卡地图（战术图 / 窄屏纵向时序轴）；顺带提供 create/gacha 共用的确定性数值基座 KR.quest
// v2：年表与种族从序章迁入，作为地图下方的「地层」；≤899 换纵向时序轴 + 底部抽屉。
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

  function str(v) { return String(v == null ? '' : v); }

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

  // ── 富文本：世界书原文是 markdown 片段，只认粗体/标题/列表/表格/代码围栏 ──
  // 从序章搬来（年表全文与种族全文现在只在这页出现）
  var FENCE = String.fromCharCode(96, 96, 96);

  function flat(s) {
    return str(s).replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ')
      .replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function archInline(host, s) {
    var parts = str(s).split('**');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) host.appendChild(KRH('b.arch-b', {}, parts[i]));
      else host.appendChild(document.createTextNode(parts[i]));
    }
    return host;
  }

  function archTable(lines) {
    var box = KRH('div.arch-rt-tbl');
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].replace(/^\s+/, '').replace(/\s+$/, '');
      if (/^\|[\s:|-]+\|$/.test(raw)) continue;
      var cells = raw.replace(/^\|/, '').replace(/\|$/, '').split('|');
      var row = KRH('div.arch-rt-tr');
      for (var j = 0; j < cells.length; j++) {
        var c = KRH('span');
        archInline(c, cells[j].replace(/^\s+/, '').replace(/\s+$/, ''));
        row.appendChild(c);
      }
      box.appendChild(row);
    }
    return box;
  }

  function archRich(source) {
    var out = [];
    var blocks = str(source).replace(/\r/g, '').split(/\n{2,}/);
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].replace(/^\s+/, '').replace(/\s+$/, '');
      if (!b) continue;
      if (b.slice(0, 3) === FENCE) {
        out.push(KRH('pre.arch-rt-pre', { text: b.split(FENCE).join('').replace(/^\s+/, '').replace(/\s+$/, '') }));
        continue;
      }
      var lines = b.split('\n');
      var head = /^(#{1,4})\s+(.+)$/.exec(lines[0]);
      if (head && lines.length === 1) { out.push(KRH('h4.arch-rt-h', { text: head[2] })); continue; }
      var isTbl = true, isList = true;
      for (var j = 0; j < lines.length; j++) {
        if (lines[j].charAt(0) !== '|') isTbl = false;
        if (!/^\s*[-·]\s+/.test(lines[j])) isList = false;
      }
      if (isTbl) { out.push(archTable(lines)); continue; }
      if (isList) {
        var ul = KRH('ul.arch-rt-ul');
        for (var k = 0; k < lines.length; k++) {
          var li = KRH('li');
          archInline(li, lines[k].replace(/^\s*[-·]\s+/, ''));
          ul.appendChild(li);
        }
        out.push(ul);
        continue;
      }
      var p = KRH('p.arch-rt-p');
      for (var q = 0; q < lines.length; q++) {
        if (q) p.appendChild(KRH('br'));
        archInline(p, lines[q]);
      }
      out.push(p);
    }
    return out;
  }

  function pushAll(host, nodes) {
    for (var i = 0; i < nodes.length; i++) host.appendChild(nodes[i]);
    return host;
  }

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

  // ── 几何 A：横向图纸（≥900）年份定 x，序号定同年错位 ──────
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

    return { w: W, h: MAP_H, padL: padL, usable: usable, minY: minY, maxY: maxY, pts: pts, axisY: axisY, narrow: false };
  }

  // 每个节点的命中格宽度 = 到左右邻居较小距离 − 2（Voronoi 一格），互不重叠也不留死区。
  // 宽度必须是 SVG 单位（跟着缩放一起变才铺满），高度在 CSS 里除以 --s 才是屏幕恒定 88px。
  function hitWidths(pts, fallback) {
    var order = [];
    for (var i = 0; i < pts.length; i++) order.push(i);
    order.sort(function (a, b) { return pts[a].x - pts[b].x; });
    var out = [];
    for (var k = 0; k < pts.length; k++) out.push(fallback || 38);
    for (var j = 0; j < order.length; j++) {
      var idx = order[j];
      var dl = j > 0 ? Math.abs(pts[idx].x - pts[order[j - 1]].x) : Infinity;
      var dr = j < order.length - 1 ? Math.abs(pts[order[j + 1]].x - pts[idx].x) : Infinity;
      var d = Math.min(dl, dr);
      out[idx] = Math.max(12, (isFinite(d) ? d : (fallback || 38) * 2) - 2);
    }
    return out;
  }

  // ── 几何 B：纵向时序轴（≤899）──────── six numbers, 契约见 04 §D2
  function vGeometry(nodes) {
    var n = nodes.length;
    var w = 360;
    var padTop = 40;
    var pitch = 64;
    var railX = 44;
    var h = padTop + n * pitch + 24;
    var pts = [];
    for (var i = 0; i < n; i++) pts.push({ x: railX, y: padTop + i * pitch + 28 });
    return { w: w, h: h, padTop: padTop, pitch: pitch, railX: railX, pts: pts, narrow: true };
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

  // ── 战术图（横向图纸）──────────────────────────────────
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

    var hits = hitWidths(geo.pts, 38);
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
      // 命中格宽度写进自定义属性，CSS 里 x / width / height 都读它
      g.style.setProperty('--hit-w', hits[n].toFixed(1) + 'px');

      var inner = KRH('g.map-node-in');
      // rect 而不是 circle：命中区是竖长条（宽随邻居距离、高 88px 屏幕恒定）
      inner.appendChild(KRH('rect.map-node-hit', { rx: 2 }));
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

  // ── 时序轴（纵向，≤899）─────────────────────────────────
  function buildAxis(nodes, geo) {
    var svg = KRH('svg.map-svg.map-svg--axis', {
      viewBox: '0 0 ' + geo.w + ' ' + geo.h,
      width: geo.w, height: geo.h,
      preserveAspectRatio: 'xMinYMin meet',
      role: 'img', 'aria-label': '关卡时序轴'
    });

    svg.appendChild(KRH('line.map-rail', {
      x1: geo.railX, y1: geo.padTop, x2: geo.railX, y2: geo.h - 20
    }));

    var ticks = KRH('g.map-rail-ticks', { 'aria-hidden': 'true' });
    for (var i = 0; i < nodes.length; i++) {
      var major = (i % 5 === 0);
      ticks.appendChild(KRH('line' + (major ? '.map-rail-tick.map-rail-tick--major' : '.map-rail-tick'), {
        x1: geo.railX - (major ? 9 : 5), y1: geo.pts[i].y,
        x2: geo.railX - 2, y2: geo.pts[i].y
      }));
    }
    svg.appendChild(ticks);

    var layer = KRH('g.map-rows');
    for (var n = 0; n < nodes.length; n++) {
      var w = nodes[n];
      var pt = geo.pts[n];
      var g = KRH('g.map-row', {
        transform: 'translate(0,' + pt.y.toFixed(1) + ')',
        'data-wid': w.id, 'data-no': pad2(w.no),
        tabindex: '0', role: 'button',
        'aria-label': pad2(w.no) + ' ' + w.title + ' ' + num(w.year, 0)
      });
      // 整行命中：360 × 64（≥44），点行内任意一处都算选中
      g.appendChild(KRH('rect.map-row-hit', { x: 0, y: -geo.pitch / 2, width: geo.w, height: geo.pitch }));
      // 45° 菱形复用地图的刻度语言：外层 g 负责平移到竖轴，rect 绕自身原点旋转
      g.appendChild(KRH('g', { transform: 'translate(' + geo.railX + ',0)' },
        KRH('rect.map-row-dia', { x: -3.5, y: -3.5, width: 7, height: 7, transform: 'rotate(45)' })
      ));
      g.appendChild(KRH('circle.map-row-dot', { cx: geo.railX, r: 2.4 }));
      g.appendChild(KRH('text.map-row-no', { x: geo.railX + 18, y: 4, text: pad2(w.no) }));
      g.appendChild(KRH('text.map-row-name', { x: geo.railX + 52, y: 4, text: nodeTitle(w) }));
      g.appendChild(KRH('text.map-row-year', {
        x: geo.w - 8, y: 4, text: String(num(w.year, 0)), 'text-anchor': 'end'
      }));
      layer.appendChild(g);
    }
    svg.appendChild(layer);
    return svg;
  }

  // ── 地点面板 ───────────────────────────────────────────
  function sheetBtnLabel(open) { return open ? '收起地点面板' : '展开地点面板'; }

  function chevUp() {
    return KRH('svg.map-sheet-ico', {
      viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'square'
    }, KRH('path', { d: 'M6 14.5 12 8.5l6 6' }));
  }

  function renderPanel(host, work) {
    KRD.clear(host);
    var narrow = S.narrow;

    var hd = KRH('div.panel-hd');
    if (work) {
      hd.appendChild(KRH('span.map-panel-no', { text: pad2(work.no) }));
      hd.appendChild(KRH('h2', { text: work.title }));
    } else {
      hd.appendChild(KRH('h2', {
        text: narrow ? ('选一个地点 · 这条线上有 ' + S.nodes.length + ' 处') : '地点档案'
      }));
    }
    if (narrow) {
      // 整条 56px 都是开关（44×44 只是最小保证），箭头只是它内部的视觉指示
      hd.appendChild(KRH('button.map-sheet-tg', {
        type: 'button',
        'aria-controls': 'map-panel-bd',
        'aria-expanded': S.sheet === 'open' ? 'true' : 'false',
        'aria-label': sheetBtnLabel(S.sheet === 'open'),
        onclick: function () { setSheet(S.sheet === 'open' ? 'peek' : 'open'); }
      }, chevUp()));
    }
    host.appendChild(hd);

    if (!work) {
      var empty = KRH('div.panel-bd', { id: 'map-panel-bd' }, KRH('div.empty', {},
        KRH('b', { text: '未选择地点' }),
        KRH('span', { text: '在战术图上点一个节点，这里出该作的开场资料。' })
      ));
      host.appendChild(empty);
      return;
    }

    var op = openingOf(work);
    var r = riderOf(work);

    var bd = KRH('div.panel-bd.map-panel-bd', { id: 'map-panel-bd' });
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

  // ── 迁入区块：六纪统合年表 / 四十六个种族 ────────────────
  function zoneHead(kicker, title, note) {
    var hd = KRH('header.arch-hd', {},
      KRH('div.t-eyebrow', { text: kicker }),
      KRH('h2.t-h2', { text: title }),
      KRH('p.arch-note', { text: note })
    );
    return hd;
  }

  function splitEra(s) {
    var parts = str(s).split(/\s+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) if (parts[i]) out.push(parts[i]);
    if (out.length <= 1) return { no: '', name: out[0] || '' };
    return { no: out[0], name: out.slice(1).join(' ') };
  }

  function buildChrono(W) {
    var list = (W.timeline || []).slice();
    var sec = KRH('section.map-zone.map-zone--chrono', { 'data-zone': 'chrono' });
    sec.appendChild(zoneHead('TIMELINE · 统合年表', '六纪统合年表', '按组织继承与力量来源切片，不是年份复述。点一纪读全文。'));

    var track = KRH('div.chrono-track', { role: 'tablist', 'aria-label': '统合年表各纪' });
    var detail = KRH('div.chrono-detail', { role: 'tabpanel', tabindex: '0' });
    var dhd = KRH('div.chrono-dhd');
    var body = KRH('div.chrono-body');
    detail.appendChild(dhd);
    detail.appendChild(body);

    var items = [], btns = [];

    function select(idx, wantFocus) {
      S.chrono = idx;
      for (var i = 0; i < items.length; i++) {
        var on = i === idx;
        items[i].classList.toggle('is-on', on);
        btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
        btns[i].setAttribute('tabindex', on ? '0' : '-1');
        if (on) { btns[i].setAttribute('id', 'chrono-tab-' + i); detail.setAttribute('aria-labelledby', 'chrono-tab-' + i); }
      }
      KRD.clear(dhd);
      KRD.clear(body);
      var t = list[idx];
      if (!t) return;
      var e = splitEra(t.era);
      dhd.appendChild(KRH('b', { text: (e.no ? e.no + ' · ' : '') + e.name }));
      dhd.appendChild(KRH('span.tnum', { text: str(t.range) }));
      pushAll(body, archRich(t.text));
      if (wantFocus) { try { btns[idx].focus(); } catch (err) {} }
    }

    for (var i = 0; i < list.length; i++) {
      (function (idx) {
        var e = splitEra(list[idx].era);
        var item = KRH('div.chrono-item');
        var btn = KRH('button.chrono-btn', {
          type: 'button', role: 'tab', 'data-idx': String(idx),
          'aria-selected': 'false', tabindex: '-1'
        });
        btn.appendChild(KRH('span.chrono-era', { text: e.no || '纪' }));
        btn.appendChild(KRH('b.chrono-name', { text: e.name }));
        btn.appendChild(KRH('span.chrono-range.tnum', { text: str(list[idx].range) }));
        item.appendChild(btn);
        track.appendChild(item);
        btns.push(btn);
        items.push(item);
      })(i);
    }

    KRD.on(track, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-idx]') : null;
      if (!btn) return;
      select(Number(btn.getAttribute('data-idx')), false);
    });

    KRD.on(track, 'keydown', function (ev) {
      var k = ev.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
      var cur = S && S.chrono ? S.chrono : 0;
      var next = k === 'Home' ? 0
        : (k === 'End' ? list.length - 1
          : (k === 'ArrowRight' ? Math.min(list.length - 1, cur + 1) : Math.max(0, cur - 1)));
      if (next === cur) return;
      ev.preventDefault();
      select(next, true);
    });

    sec.appendChild(track);
    sec.appendChild(detail);
    if (list.length) select(0, false);
    else S.chrono = 0;
    return sec;
  }

  function raceModal(race) {
    return function () {
      var box = KRH('div.race-modal');
      if (race.base) box.appendChild(KRH('div.tags', {}, KRH('span.tag.tag--gold', { text: str(race.base) })));
      pushAll(box, archRich(race.desc));
      var h = KR.modal({ title: str(race.name), body: box });
      if (S) S.layers.push(h);
    };
  }

  function raceRow(race, idx) {
    var row = KRH('button.race-card', {
      type: 'button', 'data-race': str(idx),
      'aria-haspopup': 'dialog', 'aria-label': str(race.name) + ' 全文'
    });
    if (idx === 0) row.setAttribute('class', row.getAttribute('class') + ' race-card--sum');
    var tx = KRH('span.race-tx');
    tx.appendChild(KRH('b.race-name', { text: str(race.name) }));
    if (race.base) tx.appendChild(KRH('span.tag.tag--dim.race-base', { text: str(race.base) }));
    row.appendChild(tx);
    row.addEventListener('click', raceModal(race));
    return row;
  }

  function buildRaces(W) {
    var list = W.races || [];
    var sec = KRH('section.map-zone.map-zone--races', { 'data-zone': 'races' });
    sec.appendChild(zoneHead('AKUMA · 敌我同源', '四十六个种族', '骑士与怪人出自同一套技术、同一个源头、同一种代价。点一行读全文。'));

    var grid = KRH('div.race-grid', { id: 'arch-race-grid', 'data-fold': '1' });
    for (var i = 0; i < list.length; i++) grid.appendChild(raceRow(list[i], i));

    var more = KRH('button.btn.btn-ghost.btn-sm.race-more', {
      type: 'button', 'aria-controls': 'arch-race-grid'
    });

    function paintMore() {
      var open = grid.getAttribute('data-fold') === '0';
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      more.textContent = open ? '收起' : ('展开全部 ' + list.length + ' 条');
    }

    more.addEventListener('click', function () {
      grid.setAttribute('data-fold', grid.getAttribute('data-fold') === '1' ? '0' : '1');
      paintMore();
    });
    paintMore();

    // 折叠按钮必须放在 multicol 容器之外：塞进 .race-grid 会被分栏切走
    sec.appendChild(grid);
    sec.appendChild(more);
    return sec;
  }

  function buildArch(W) {
    var wrap = KRH('div.map-arch', { 'aria-label': '关卡附录' });
    wrap.appendChild(buildChrono(W));
    wrap.appendChild(buildRaces(W));
    return wrap;
  }

  // ── 视图 ───────────────────────────────────────────────
  var S = null;
  var MQ_NARROW = '(max-width:899px)';

  function isNarrow() {
    return !!(global.matchMedia && global.matchMedia(MQ_NARROW).matches);
  }

  function mount(el, ctx) {
    S = {
      level: 0, view: 'overview', selId: '', nodes: [], geo: null,
      narrow: false, sheet: 'peek', notesOpen: false, chrono: 0,
      offResize: null, offMq: null, offEsc: null, layers: []
    };
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

    S.narrow = isNarrow();
    S.levels = buildLevelAll();
    S.noteTotal = S.levels[0].notes.length + S.levels[1].notes.length;

    var head = KRH('header.map-head');
    head.appendChild(KRH('div.t-eyebrow', { text: 'STAGE SELECT' }));
    head.appendChild(KRH('h1.t-h1', { text: '关卡 · 两张地图' }));

    var levels = KRH('div.map-levels', { role: 'group', 'aria-label': '关卡切换' });
    var metaLine = KRH('div.map-meta');
    var notesBox = KRH('div.map-notes');
    var desc = KRH('p.map-desc');
    // 关卡 tab 必须是 .mapview 的直接子元素：sticky 需要高度足够的包含块，
    // 塞进短小的 header 里一滚就失效（≤899 切关时的锚点就没了）。
    var sub = KRH('div.map-sub', {}, metaLine, notesBox, desc);

    var stage = KRH('div.map-stage');
    var canvas = KRH('div.map-canvas');
    stage.appendChild(canvas);

    var views = KRH('div.map-views', { role: 'group', 'aria-label': '视角切换' });
    var VIEW_DEF = [
      { key: 'overview', label: '全览', hint: '整图 fit，全部节点与连接线' },
      { key: 'region', label: '区域', hint: '选中节点 1.8×，带悬浮铭牌' },
      { key: 'close', label: '特写', hint: '3.2×，舞台纹理 + 敌方剪影' }
    ];
    for (var v = 0; v < VIEW_DEF.length; v++) {
      views.appendChild(KRH('button.btn.btn-sm.map-vbtn', {
        type: 'button', 'data-view': VIEW_DEF[v].key, title: VIEW_DEF[v].hint
      }, VIEW_DEF[v].label));
    }
    stage.appendChild(views);

    // 地点选择播报：键盘选中后焦点不动，靠这里播一次地名
    var live = KRH('div.sr-only', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

    var panel = KRH('aside.map-panel.panel.panel--quiet');

    // 关卡 tab 单独放在 mapview 下（不塞进 .map-head）：sticky 需要高度足够的包含块，
    // 放进短小的 header 里一滚就失效。
    var shell = KRH('section.mapview', {},
      head, levels, sub,
      KRH('div.map-body', {}, stage, panel),
      live
    );
    el.appendChild(shell);

    // 年表 / 种族：通栏，不与右栏对齐（对齐会让人以为它们属于面板）
    el.appendChild(buildArch(KR.WORLD));

    function currentWork() {
      for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === S.selId) return S.nodes[i];
      return null;
    }

    function setSheet(state) {
      S.sheet = state;
      panel.setAttribute('data-sheet', state);
      syncSheetA11y();
      // scroll-padding-bottom 随状态切：peek 留抽屉高度，open 留 66vh
      try {
        document.documentElement.style.scrollPaddingBottom = (state === 'open' ? '66vh' : '64px');
      } catch (e) {}
    }

    function syncSheetA11y() {
      if (!S || !S.narrow) {
        panel.removeAttribute('data-sheet');
        var all = panel.querySelectorAll('.panel-bd,.panel-ft');
        for (var k = 0; k < all.length; k++) {
          all[k].removeAttribute('inert');
          all[k].removeAttribute('aria-hidden');
        }
        return;
      }
      panel.setAttribute('data-sheet', S.sheet);
      var open = S.sheet === 'open';
      var tg = panel.querySelector('.map-sheet-tg');
      if (tg) {
        tg.setAttribute('aria-expanded', open ? 'true' : 'false');
        tg.setAttribute('aria-label', sheetBtnLabel(open));
      }
      // peek 态：translateY 只是视觉推出，节点仍在布局里，必须退出 Tab 序
      var parts = panel.querySelectorAll('.panel-bd,.panel-ft');
      for (var i = 0; i < parts.length; i++) {
        if (open) {
          parts[i].removeAttribute('inert');
          parts[i].removeAttribute('aria-hidden');
        } else {
          parts[i].setAttribute('inert', '');
          parts[i].setAttribute('aria-hidden', 'true');
        }
      }
    }

    function applyView() {
      if (!S.geo) return;
      if (S.narrow) {
        // 纵向轴：等比铺满，不做平移缩放；命中区按屏幕恒定，--s 固定 1
        canvas.style.transform = 'none';
        canvas.style.setProperty('--s', '1');
        return;
      }
      var vw = stage.clientWidth || 0;
      var vh = stage.clientHeight || 0;
      if ((!vw || !vh) && stage.getBoundingClientRect) {
        var box = stage.getBoundingClientRect();
        vw = vw || box.width;
        vh = vh || box.height;
      }
      vw = vw || 1120;
      vh = vh || 560;

      var fit = Math.min(vw / S.geo.w, vh / S.geo.h);
      var scale = fit;
      var tx = (vw - S.geo.w * fit) / 2;
      var ty = (vh - S.geo.h * fit) / 2;

      if (S.view !== 'overview' && S.selId) {
        var idx = -1;
        for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === S.selId) idx = i;
        if (idx >= 0) {
          scale = fit * (S.view === 'close' ? 3.2 : 1.8);
          tx = vw / 2 - S.geo.pts[idx].x * scale;
          ty = vh / 2 - S.geo.pts[idx].y * scale;
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
      var nodes = KRD.qa('g[data-wid]', canvas);
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('is-sel', nodes[i].getAttribute('data-wid') === S.selId);
      }

      var lead = canvas.querySelector('.map-lead');
      var work = currentWork();
      if (lead) {
        if (work && !S.narrow) {
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
      syncSheetA11y();
      stage.classList.toggle('has-sel', !!work);

      if (live) {
        live.textContent = work ? ('已选 ' + work.title + ' · 编号 ' + pad2(work.no)) : '';
      }

      if (S.narrow) {
        if (S.view === 'close') S.view = 'overview';
      } else if (S.view === 'close') {
        renderCloseLayer(stage, work);
      } else {
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
      if (S.narrow) key = 'overview';
      if (S.view === key) return;
      S.view = key;
      paintViewButtons();
      applyView();
      paintSelection();
    }

    // 当前节点始终可见：纵向轴 2176px，选中后把行滚进「hud + 关卡条之下、抽屉之上」的可见带。
    // 手写 scrollBy 而不是 scrollIntoView：sticky 关卡条会盖住视口顶部，
    // scroll-padding 只写得下一条，算不准就压到关卡片底下。
    function revealRow(wid, force) {
      if (!S.narrow) return;
      var g = canvas.querySelector('g[data-wid="' + wid + '"]');
      if (!g) return;
      var box = g.getBoundingClientRect();
      var hudH = parseFloat(global.getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 88;
      var lvH = levels ? levels.getBoundingClientRect().height : 0;
      var bandTop = hudH + lvH + 12;
      // 抽屉 open 时占 66vh，可见带只剩 90px 上下：这时让行顶贴住可见带上沿，别居中
      var drawerH = S.sheet === 'open' ? Math.round(global.innerHeight * 0.66) + 8 : 64;
      var bandBottom = global.innerHeight - drawerH;
      var fits = (bandBottom - bandTop) >= (box.height + 8);
      if (!force && box.top >= bandTop - 4 && box.bottom <= bandBottom + 4) return;
      var target = fits ? ((bandTop + bandBottom) / 2 - box.height / 2) : (bandTop + 8);
      if (target < bandTop) target = bandTop;
      var delta = box.top - target;
      if (!delta || Math.abs(delta) < 2) return;
      try { global.scrollBy({ top: delta, behavior: 'auto' }); } catch (e) {
        try { global.scrollTo(0, (global.pageYOffset || 0) + delta); } catch (e2) {}
      }
    }

    // 面板落到舞台下方时（≤1100），选中后确保面板头在视野内，否则用户只看到节点高亮
    function revealPanel() {
      if (S.narrow || !panel) return;
      if (!global.matchMedia || !global.matchMedia('(max-width:1100px)').matches) return;
      var hd = panel.querySelector('.panel-hd');
      if (!hd) return;
      var box = hd.getBoundingClientRect();
      if (box.top < 0 || box.top > global.innerHeight - 60) {
        try { hd.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } catch (e) {}
      }
    }

    function selectNode(wid, fromPointer) {
      if (!wid) return;
      S.selId = wid;
      if (S.narrow) {
        // 点节点 = 强制展开，不做「记住上次 peek」：可预测 > 聪明
        setSheet('open');
      }
      paintSelection();
      if (S.view !== 'overview') applyView();
      if (S.narrow) revealRow(wid, true);
      else if (fromPointer) revealPanel();
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
      S.narrow = isNarrow();
      S.nodes = S.levels[S.level].nodes;
      S.geo = S.narrow ? vGeometry(S.nodes) : geometry(S.nodes);
      KRD.clear(canvas);
      canvas.appendChild(S.narrow ? buildAxis(S.nodes, S.geo) : buildStage(S.nodes, S.geo));

      if (S.narrow) {
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.transform = 'none';
      } else {
        canvas.style.width = S.geo.w + 'px';
        canvas.style.height = S.geo.h + 'px';
        canvas.style.removeProperty('transform');
      }

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

    // ── 事件 ─────────────────────────────────────────────
    KRD.on(levels, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-lv]') : null;
      if (!btn) return;
      var index = Number(btn.getAttribute('data-lv'));
      if (index === S.level) return;
      S.level = index;
      S.selId = '';
      paintCanvas();
      // 切关后回到舞台顶（sticky 关卡条 + scroll-margin-top 提供锚点）
      if (S.narrow) {
        try { stage.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e) {}
      }
    });

    KRD.on(views, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-view]') : null;
      if (!btn) return;
      setView(btn.getAttribute('data-view'));
    });

    KRD.on(canvas, 'click', function (ev) {
      var node = ev.target && ev.target.closest ? ev.target.closest('g[data-wid]') : null;
      if (!node) return;
      selectNode(node.getAttribute('data-wid'), true);
    });

    KRD.on(canvas, 'keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var node = ev.target && ev.target.closest ? ev.target.closest('g[data-wid]') : null;
      if (!node) return;
      ev.preventDefault();
      selectNode(node.getAttribute('data-wid'), true);
    });

    KRD.on(panel, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn || btn.getAttribute('data-act') !== 'enter') return;
      var work = currentWork();
      if (!work) { if (KR.toast) KR.toast('先选一个地点', 'warn'); return; }
      KR.state.lastNode = num(work.no, 0);
      KR.go('/create?work=' + encodeURIComponent(work.id) + '&node=' + num(work.no, 0));
    });

    // Esc 回 peek，焦点回最后选中的节点。弹窗开着时让 KR.modal 自己处理，别一次关两层。
    S.offEsc = KRD.on(document, 'keydown', function (ev) {
      if (ev.key !== 'Escape' || !S || !S.narrow) return;
      if (document.querySelector('.modal')) return;
      if (S.sheet !== 'open') return;
      setSheet('peek');
      var g = S.selId ? canvas.querySelector('g[data-wid="' + S.selId + '"]') : null;
      if (g) { try { g.focus(); } catch (e) {} }
    });

    S.offResize = KRD.on(global, 'resize', KRD.debounce(function () { applyView(); }, 140));

    // 断点穿越要换几何（横向图纸 ↔ 纵向轴），换完保留选中项
    if (global.matchMedia) {
      var mql = global.matchMedia(MQ_NARROW);
      var onMq = function () {
        if (!S) return;
        if (isNarrow() === S.narrow) return;
        paintCanvas();
        if (!S.narrow) setSheet('open');
      };
      if (mql.addEventListener) mql.addEventListener('change', onMq);
      else if (mql.addListener) mql.addListener(onMq);
      S.offMq = function () {
        if (mql.removeEventListener) mql.removeEventListener('change', onMq);
        else if (mql.removeListener) mql.removeListener(onMq);
      };
    }

    paintCanvas();
    if (S.narrow) setSheet('peek');

    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(function () { if (S) applyView(); });
    }
  }

  function unmount(el) {
    if (S) {
      if (S.offResize) S.offResize();
      if (S.offMq) S.offMq();
      if (S.offEsc) S.offEsc();
      for (var i = 0; i < S.layers.length; i++) {
        try { S.layers[i].close(); } catch (e) {}
      }
    }
    try { document.documentElement.style.scrollPaddingBottom = ''; } catch (e) {}
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
