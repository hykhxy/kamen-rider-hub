/* owner: roster-rider */
/* KRSTAT · 数值与评级引擎
   取值完全由 (kind + id + 原著文本) 经 FNV-1a 播种，不读时钟也不取随机数，
   所以同一记录每次调用恒等；视图可以放心缓存、比对、做档位动画。
   总评 = 时代基线 + 公共浮动 + 单轴偏移 + 文本进位，最后被世界书【判定】的锚点表夹到指定档。 */
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};

  var LADDER = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  var CUTS = [30, 42, 54, 66, 78, 88, 95];

  var AXIS_STD = ['力', '速', '技', '防'];
  // 人类口径换一套轴名：同一副形状读出来的是体格，不是破城
  var AXIS_HUMAN = ['体格', '技巧', '意志', '装备'];

  var W = { pow: 0.28, spd: 0.24, skl: 0.24, def: 0.24 };

  // ── 确定性播种 ──────────────────────────────────────────
  function fnv1a(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h = (h ^ str.charCodeAt(i)) >>> 0;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function seedOf(kind, id) { return fnv1a(String(kind) + '|' + String(id), 0x811c9dc5); }

  function pick(seed, salt, lo, hi) {
    return lo + (fnv1a(salt, seed) % (hi - lo + 1));
  }

  /* 时代基线 + 噪声抖动 + 文本进位。
     单纯哈希会让「假面骑士1号」掉到 E、「罗多斯里」冲到 A——那读者第一眼就知道是随机数。
     所以基线由原著年代给定（昭和<平成<令和），哈希只负责拉开同代内部的差距，
     真正的跃迁留给 name/lore 命中。 */
  var ERA_BASE = { '昭和': 48, '平成': 57, '令和': 61, '未归类': 45 };
  var BASE_FALLBACK = 50;
  var CHAR_BASE = 33;
  /* 抖动拆成「公共浮动 + 单轴偏移」。
     只抖动单轴的话，四轴求加权平均会把方差再压一半，S/SS/SSS 永远抽不出来。 */
  var COMMON = [-24, 22];
  var AXIS_JIT = [-10, 10];
  var CHAR_COMMON = [-18, 15];
  var CHAR_AXIS_JIT = [-7, 7];

  /* 原著文本命中 → 真实改数值，并在 tags 里留痕。
     形态名在档案里大量是英文记号（Ultimate Form / Shining Form / King Form），
     只认中文会让档位阶梯变成死代码，所以两套写法并列。 */
  var KEYWORDS = [
    {
      re: /逢魔|全开|神话|创世|根源|ohma|grand\s*zio|world\s*of\s*the|end\s*of\s*time/i,
      tag: '神话档', top: true, w: { pow: 22, spd: 16, skl: 22, def: 20 }
    },
    {
      re: /暴走|最终|究极|无限|强化|过载|融合|ultimate|final\s*form|final\s*attack|infinity|muteki|hyper|maximum|amazing|genius|cosmic|shining|burning|king\s*form|emperor|supreme/i,
      tag: '超规格', w: { pow: 15, spd: 7, skl: 10, def: 13 }
    },
    { re: /强化形态|rising|upgrade|charge\s*up|boost/i, tag: '强化态', w: { pow: 8, spd: 4, skl: 5, def: 6 } },
    { re: /飞行|空中|跳跃|疾|aerial|sky|wing|jump|speed\s*form|clock\s*up/i, tag: '机动', w: { spd: 12 } },
    { re: /术|法|咒|仪式|时间|空间|镜|magic|time|mirror|space|illusion/i, tag: '术式', w: { skl: 12 } },
    { re: /重装|装甲|防御|要塞|armor|shield|fortress|heavy/i, tag: '重装', w: { def: 12 } }
  ];

  // 形态序号梯度：只认显式记号，不拿裸数字猜（年份、编号里全是数字）
  var SEQUENCE = [
    { re: /新/, w: { pow: 2, spd: 2, skl: 2, def: 2 } },
    { re: /旧/, w: { pow: -3, spd: -3, skl: -3, def: -3 } },
    { re: /Ⅱ|Ⅲ|Ⅳ|Ⅱ型|Ⅲ型/, w: { pow: 2, skl: 3 } },
    { re: /强化形态|觉醒|进化/, w: { pow: 3, skl: 2 } }
  ];

  var TRIAL = /旧|初期|试作/;

  /* 世界书【判定】末尾自带一张档位锚点表（D：…／C：…／S：空我究极、Agito 闪耀…）。
     这是全书唯一一处把具体名字和档位对上的地方，不接进来就等于把最硬的原著信号丢掉。 */
  var ANCHOR = null;

  function normName(s) {
    return String(s == null ? '' : s).replace(/[\s·・,，.。/／()（）\[\]【】《》\-—_]/g, '').toLowerCase();
  }

  function anchors() {
    if (ANCHOR) return ANCHOR;
    ANCHOR = [];
    var text = KR.WORLD && KR.WORLD.judges ? KR.WORLD.judges.text : '';
    var seg = String(text || '').split('【档位锚点示例】')[1];
    if (!seg) return ANCHOR;
    var rows = seg.split('\n');
    var line = '';
    for (var r = 0; r < rows.length; r++) {
      if (/[EDCBAS]{1,3}：/.test(rows[r])) { line = rows[r]; break; }
    }
    if (!line) return ANCHOR;
    var re = /(SSS|SS|S|A|B|C|D)：/g;
    var hit, marks = [];
    while ((hit = re.exec(line))) marks.push({ rank: hit[1], at: hit.index, end: re.lastIndex });
    for (var i = 0; i < marks.length; i++) {
      var body = line.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].at : line.length);
      var names = body.split(/[、；;]/);
      for (var j = 0; j < names.length; j++) {
        var n = normName(names[j]).replace(/^初期的?/, '').replace(/^刚变身/, '');
        if (n) ANCHOR.push({ n: n, rank: marks[i].rank });
      }
    }
    return ANCHOR;
  }

  function anchorRank(name) {
    var list = anchors();
    if (!list.length) return null;
    var key = normName(name);
    if (!key) return null;
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (key.indexOf(a.n) < 0) continue;
      // 取命中最长的一条，短名（「奥丁」）不该盖掉更具体的（「奥丁 X」）
      if (!best || a.n.length > best.n.length) best = a;
    }
    return best ? best.rank : null;
  }

  // 档位的上下界：CUTS[i] 是 LADDER[i] 的下界，所以某档的上界是下一档下界减一
  function bandBounds(rank) {
    var i = rankIndex(rank);
    var lo = i === 0 ? 6 : CUTS[i - 1];
    var hi = i >= LADDER.length - 1 ? 100 : CUTS[i] - 1;
    return [lo, hi];
  }

  // ── 工具 ────────────────────────────────────────────────
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d == null ? 0 : d);
  }

  function clampInt(v, lo, hi) {
    v = Math.round(num(v, lo));
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function rankOf(total) {
    var t = num(total, 0);
    for (var i = 0; i < CUTS.length; i++) if (t < CUTS[i]) return LADDER[i];
    return LADDER[LADDER.length - 1];
  }

  function rankIndex(rank) {
    var i = LADDER.indexOf(String(rank));
    return i < 0 ? 0 : i;
  }

  function add(w, key, v) { w[key] = num(w[key], 0) + v; }

  function apply(list, text, w, tags, mintop) {
    for (var i = 0; i < list.length; i++) {
      var rule = list[i];
      if (!rule.re.test(text)) continue;
      for (var k in rule.w) if (Object.prototype.hasOwnProperty.call(rule.w, k)) add(w, k, rule.w[k]);
      if (rule.tag && tags.indexOf(rule.tag) < 0) tags.push(rule.tag);
      if (mintop && rule.top) { mintop.top = true; mintop.tag = rule.tag; }
    }
  }

  function uniq(list, max) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (v && out.indexOf(v) < 0) out.push(v);
      if (out.length >= max) break;
    }
    return out;
  }

  // ── KR.FORMS 索引（data-forge 给的是数组，契约写的是对象键；两种都吃） ──
  var FORM_SRC = null;
  var FORM_INDEX = null;

  function formIndex() {
    var F = KR.FORMS;
    if (!F) return null;
    if (FORM_INDEX && FORM_SRC === F) return FORM_INDEX;
    var map = {};
    if (Object.prototype.toString.call(F) === '[object Array]') {
      for (var i = 0; i < F.length; i++) if (F[i] && F[i].i) map[F[i].i] = F[i];
    } else if (typeof F === 'object') {
      for (var k in F) if (Object.prototype.hasOwnProperty.call(F, k)) map[k] = F[k];
    }
    FORM_SRC = F;
    FORM_INDEX = map;
    return map;
  }

  // ── 命中文本 ────────────────────────────────────────────
  function textOf(kind, rec) {
    var name = String(rec.name || rec.n || '');
    if (kind === 'form') return name + '\n' + String(rec.lore || '');
    if (kind === 'rider') {
      var map = formIndex();
      var base = rec.baseForm && map ? map[rec.baseForm] : null;
      if (base && base.lore) return name + '\n' + base.name + '\n' + String(base.lore);
      // 骑士自带的 lore 是全形态大合集，整篇扫会把「旧形态」的记号算到骑士头上，
      // 只取开头 160 字的纲要段。
      return name + '\n' + String(rec.lore || '').slice(0, 160);
    }
    return name;
  }

  function tagsOf(kind, rec, derived) {
    var base = [];
    if (kind === 'char') {
      base = ['人类'];
      if (rec.e) base.push(rec.e);
      if (rec.y) base.push(rec.y + '年');
    } else if (kind === 'rider') {
      if (rec.tags && rec.tags.length) base = rec.tags.slice(0, 3);
      else base = [rec.e || '', rec.y ? rec.y + '年' : ''];
    } else {
      base = [rec.e || '', rec.y ? rec.y + '年' : ''];
    }
    return uniq(base.concat(derived), 6);
  }

  // ── 判词：从世界书【判定】的三轴与断裂层口径写，20 字内 ──
  function noteFor(kind, w, total, rank) {
    var vals = [w.pow, w.spd, w.skl, w.def];
    var labels = kind === 'char' ? AXIS_HUMAN : AXIS_STD;
    var hi = 0, lo = 0, i;
    for (i = 1; i < 4; i++) {
      if (vals[i] > vals[hi]) hi = i;
      if (vals[i] < vals[lo]) lo = i;
    }
    var spread = vals[hi] - vals[lo];
    var s;

    if (rank === 'SSS') s = '世界规则本身，不入常规判定';
    else if (rank === 'SS') s = '断裂层之内，只可走越级四路径';
    else if (rank === 'S') s = labels[hi] + '已在顶点，同级无解';
    // 人类先按人体尺度读，别把骑士的「见习」口径套到血肉之躯上
    else if (kind === 'char') {
      if (total < 30) s = '常人极限，遇怪人先脱身';
      else if (total < 42) s = labels[hi] + '撑得住，' + labels[lo] + '拖后腿';
      else s = '血肉之躯，硬拼须先有装备';
    }
    else if (rank === 'E') s = labels[hi] + '勉强可用，' + labels[lo] + '仍是短板';
    else if (rank === 'D') s = '见习档，杂兵可战，干部不可';
    else if (spread <= 6) s = '四轴均齐，胜负看地形与人数';
    else if (vals[lo] >= 68) s = '无明显短板，需靠人数与地形消耗';
    else s = labels[hi] + '压同级，' + labels[lo] + '不足以越级';

    return s.length > 20 ? s.slice(0, 20) : s;
  }

  // ── 主引擎 ──────────────────────────────────────────────
  var CACHE = {};

  function build(kind, rec) {
    var id = rec && rec.i != null ? rec.i : '';
    var seed = seedOf(kind, id);
    var isChar = kind === 'char';

    var core;
    if (isChar) core = CHAR_BASE;
    else {
      var era = rec && rec.e ? String(rec.e) : '';
      core = ERA_BASE[era] == null ? BASE_FALLBACK : ERA_BASE[era];
      // 同代之内越靠后越厚，但封顶 6，避免 2026 年的作品白拿一大截
      core += Math.min(6, Math.max(0, Math.round((num(rec.y, 1971) - 1971) / 15)));
    }

    var cm = isChar ? CHAR_COMMON : COMMON;
    var ax = isChar ? CHAR_AXIS_JIT : AXIS_JIT;
    var common = pick(seed, 'common', cm[0], cm[1]);
    var w = {
      pow: core + common + pick(seed, 'jpow', ax[0], ax[1]),
      spd: core + common + pick(seed, 'jspd', ax[0], ax[1]),
      skl: core + common + pick(seed, 'jskl', ax[0], ax[1]),
      def: core + common + pick(seed, 'jdef', ax[0], ax[1])
    };

    var tags = [];
    var top = {};
    var text = textOf(kind, rec);
    apply(KEYWORDS, text, w, tags, top);
    apply(SEQUENCE, String((rec && (rec.name || rec.n)) || ''), w, tags);

    if (kind === 'rider') {
      // 形态越多，说明这条进化线被写过越多，本体给一点厚度
      var n = rec.forms ? rec.forms.length : 0;
      if (n >= 6) { add(w, 'pow', 3); add(w, 'def', 3); }
    }

    var cap = isChar ? 86 : 100;
    for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k)) w[k] = clampInt(w[k], isChar ? 6 : 8, cap);

    var total = w.pow * W.pow + w.spd * W.spd + w.skl * W.skl + w.def * W.def;

    // 试作期压的是总评，不压单轴：年代感要从总档上读出来，不是把条形刻度改花
    if (TRIAL.test(String((rec && (rec.name || rec.n)) || ''))) total -= 8;
    // 神话档是断裂层：世界书把 SSS 留给「世界规则本身」，靠堆数值永远堆不到，
    // 所以命中即保底，而不是加点。
    if (top.top) total = Math.max(total, 95);
    // 原著点名的锚点压过哈希：名字被世界书写进哪一档，就落在那一档的区间里
    var anchor = isChar ? null : anchorRank(rec && (rec.name || rec.n));
    if (anchor) {
      var bb = bandBounds(anchor);
      total = clampInt(total, bb[0], bb[1]);
      if (tags.indexOf('原著锚点') < 0) tags.push('原著锚点');
    }
    total = clampInt(total, 6, 100);
    // 人类口径不出 SSS：断裂层是给神话留的，不是给血肉之躯
    if (isChar && total > 94) total = 94;

    var rank = rankOf(total);
    var labels = isChar ? AXIS_HUMAN : AXIS_STD;
    var bars = [
      { k: labels[0], v: w.pow },
      { k: labels[1], v: w.spd },
      { k: labels[2], v: w.skl },
      { k: labels[3], v: w.def }
    ];

    return {
      i: String(id),
      kind: kind,
      pow: w.pow, spd: w.spd, skl: w.skl, def: w.def,
      total: total,
      rank: rank,
      bars: bars,
      axisLabels: labels.slice(),
      note: noteFor(kind, w, total, rank),
      tags: tagsOf(kind, rec, tags),
      anchor: anchor || null,
      top: !!top.top
    };
  }

  function of(kind, rec) {
    var k = String(kind || 'form');
    if (k !== 'rider' && k !== 'form' && k !== 'char') k = 'form';
    if (!rec || typeof rec !== 'object') {
      return {
        i: '', kind: k, pow: 8, spd: 8, skl: 8, def: 8, total: 6, rank: 'E',
        bars: [{ k: '力', v: 8 }, { k: '速', v: 8 }, { k: '技', v: 8 }, { k: '防', v: 8 }],
        axisLabels: AXIS_STD.slice(), note: '记录缺失，无法判定', tags: [], top: false
      };
    }
    var key = k + ':' + (rec.i == null ? '' : rec.i);
    var hit = CACHE[key];
    if (hit) return hit;
    hit = build(k, rec);
    CACHE[key] = hit;
    return hit;
  }

  function delta(a, b) {
    a = a || {}; b = b || {};
    var from = a.rank || rankOf(a.total);
    var to = b.rank || rankOf(b.total);
    var d = {
      pow: num(b.pow) - num(a.pow),
      spd: num(b.spd) - num(a.spd),
      skl: num(b.skl) - num(a.skl),
      def: num(b.def) - num(a.def),
      total: num(b.total) - num(a.total),
      rank: { from: from, to: to },
      grade: '平',
      up: false
    };
    // rank 既能按结构读 {from,to}，也能当 'B→A' 直接拼进文案
    d.rank.toString = function () { return String(from) + '→' + String(to); };
    d.rankText = String(d.rank);

    var ia = rankIndex(from), ib = rankIndex(to);
    if (ib !== ia) {
      d.up = ib > ia;
      d.grade = d.up ? '升' : '降';
    } else if (d.total > 0) { d.up = true; d.grade = '升'; }
    else if (d.total < 0) { d.up = false; d.grade = '降'; }
    return d;
  }

  global.KRSTAT = {
    LADDER: LADDER.slice(),
    CUTS: CUTS.slice(),
    AXIS: AXIS_STD.slice(),
    AXIS_HUMAN: AXIS_HUMAN.slice(),
    of: of,
    delta: delta,
    rank: rankOf,
    rankIndex: rankIndex,
    // 同一 (kind+id) 恒等，缓存只是省算力；数据换了就丢
    reset: function () { CACHE = {}; FORM_SRC = null; FORM_INDEX = null; ANCHOR = null; }
  };
  KR.STAT_API = global.KRSTAT;
})(window);
