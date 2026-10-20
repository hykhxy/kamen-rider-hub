// owner: codex-home — 序章：封面 / 三入口 / 六纪统合年表 / 敌我同源 / 判定条令 / 变身语法
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};

  // 首屏只带骑士与形态索引（约 340KB）。人物/怪人/道具索引共 1.5MB，交给图库页按需拉，
  // 所以封面用契约合计值；图库页再用五张表的数组长度实算，把这个数字校验回来。
  var IMG_TOTAL = 10623;

  // 世界书原文里的代码围栏是三反引号；这里用码点拼，免得上层再包一层字符串时被转义吃掉
  var FENCE = String.fromCharCode(96, 96, 96);

  var LIVE = null;

  function H() { return global.KRH.apply(global, arguments); }
  function D() { return global.KRD; }
  function IMG() { return global.KRIMG; }

  // ── 小工具 ───────────────────────────────────────────────
  function str(v) { return String(v == null ? '' : v); }

  function flat(s) {
    return str(s).replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ')
      .replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function clip(s, n) {
    var t = flat(s);
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  function num(n) {
    var d = D();
    return d && d.fmtNum ? d.fmtNum(n) : str(n);
  }

  function world() { return (global.KR && global.KR.WORLD) || null; }
  function riders() { return (global.KR && global.KR.RIDERS) || []; }

  function imgList(key) {
    var api = global.KR && global.KR.IMG;
    return (api && api[key]) || null;
  }

  // ── 富文本：世界书原文是 markdown 片段，只认粗体/标题/列表/表格/代码围栏 ──
  function inline(host, s) {
    var parts = str(s).split('**');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) host.appendChild(H('b.home-b', {}, parts[i]));
      else host.appendChild(document.createTextNode(parts[i]));
    }
    return host;
  }

  function table(lines) {
    var box = H('div.home-rt-tbl');
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].replace(/^\s+/, '').replace(/\s+$/, '');
      if (/^\|[\s:|-]+\|$/.test(raw)) continue;
      var cells = raw.replace(/^\|/, '').replace(/\|$/, '').split('|');
      var row = H('div.home-rt-tr');
      for (var j = 0; j < cells.length; j++) {
        var c = H('span');
        inline(c, cells[j].replace(/^\s+/, '').replace(/\s+$/, ''));
        row.appendChild(c);
      }
      box.appendChild(row);
    }
    return box;
  }

  function rich(source) {
    var out = [];
    var blocks = str(source).replace(/\r/g, '').split(/\n{2,}/);
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].replace(/^\s+/, '').replace(/\s+$/, '');
      if (!b) continue;
      if (b.slice(0, 3) === FENCE) {
        out.push(H('pre.home-rt-pre', { text: b.split(FENCE).join('').replace(/^\s+/, '').replace(/\s+$/, '') }));
        continue;
      }
      var lines = b.split('\n');
      var head = /^(#{1,4})\s+(.+)$/.exec(lines[0]);
      if (head && lines.length === 1) { out.push(H('h4.home-rt-h', { text: head[2] })); continue; }
      var isTbl = true, isList = true;
      for (var j = 0; j < lines.length; j++) {
        if (lines[j].charAt(0) !== '|') isTbl = false;
        if (!/^\s*[-·]\s+/.test(lines[j])) isList = false;
      }
      if (isTbl) { out.push(table(lines)); continue; }
      if (isList) {
        var ul = H('ul.home-rt-ul');
        for (var k = 0; k < lines.length; k++) {
          var li = H('li');
          inline(li, lines[k].replace(/^\s*[-·]\s+/, ''));
          ul.appendChild(li);
        }
        out.push(ul);
        continue;
      }
      var p = H('p.home-rt-p');
      for (var q = 0; q < lines.length; q++) {
        if (q) p.appendChild(H('br'));
        inline(p, lines[q]);
      }
      out.push(p);
    }
    return out;
  }

  function pushAll(host, nodes) {
    for (var i = 0; i < nodes.length; i++) host.appendChild(nodes[i]);
    return host;
  }

  // ── 1. 封面 ──────────────────────────────────────────────
  var HERO = [
    { keys: ['假面骑士1号', '1号'] },
    { keys: ['假面骑士空我', '空我'] },
    { keys: ['假面骑士帝骑', '帝骑'] },
    { keys: ['假面骑士零一', 'Zero-One'] },
    { keys: ['假面骑士极狐', '极狐'] }
  ];

  function pickRider(all, spec) {
    var i, j;
    for (i = 0; i < spec.keys.length; i++) {
      for (j = 0; j < all.length; j++) if (all[j].n === spec.keys[i]) return all[j];
    }
    for (i = 0; i < spec.keys.length; i++) {
      for (j = 0; j < all.length; j++) if (str(all[j].n).indexOf(spec.keys[i]) >= 0) return all[j];
    }
    return null;
  }

  function figures() {
    var box = H('div.hero-figs', { 'aria-hidden': 'true' });
    var all = riders();
    for (var i = 0; i < HERO.length; i++) {
      var r = pickRider(all, HERO[i]);
      if (!r) continue;
      // 官方照多为浅底：一律进 .plate（暗底 + 底光 + 金框 + 径向溶解），斜切留在外层 figure
      var f = H('figure.hero-fig');
      var plate = H('div.plate.hero-plate');
      var im = H('img', { 'data-kr-img': str(r.img) || ('rider/' + str(r.i) + '.webp'), alt: str(r.n) + ' 立绘' });
      // 主位走全尺寸线路，其余走 wsrv 缩略图，封面不至于一口气拉五张原图
      if (i) im.setAttribute('data-kr-thumb', '1');
      plate.appendChild(im);
      plate.appendChild(H('figcaption.plate-cap.hero-cap', {},
        H('b', { text: (str(r.n) || str(r.j)).replace(/^假面骑士/, '') }),
        H('i.tnum', { text: str(r.y) })
      ));
      f.appendChild(plate);
      box.appendChild(f);
    }
    return box;
  }

  function scale(W) {
    var metas = W.meta || {};
    var rows = [
      { n: num(metas.works), u: '部作品' },
      { n: num((W.timeline || []).length), u: '纪' },
      { n: num(metas.entries), u: '条世界书' },
      { n: num(riders().length), u: '位骑士' },
      { n: num((W.races || []).length), u: '个种族' },
      { n: num(IMG_TOTAL), u: '张图', note: '图库页用五张索引的数组长度实算校验' }
    ];
    var dl = H('dl.hero-scale', { 'aria-label': '档案数据刻度' });
    for (var i = 0; i < rows.length; i++) {
      var cell = H('div.hero-scale-i');
      var dt = H('dt', { text: rows[i].n });
      if (rows[i].note) dt.setAttribute('title', rows[i].note);
      cell.appendChild(dt);
      cell.appendChild(H('dd', { text: rows[i].u }));
      dl.appendChild(cell);
    }
    return dl;
  }

  function hero(W) {
    var A = H('section.home-hero', { 'data-sec': 'hero' });
    A.appendChild(H('div.hero-grid', { 'aria-hidden': 'true' }));

    var copy = H('div.hero-copy');
    copy.appendChild(H('div.hero-eyebrow', {},
      H('i', { text: 'KR ARCHIVE' }),
      H('span', { text: num(W.meta && W.meta.works) + ' 部作品' })
    ));
    copy.appendChild(H('h1.hero-title', {},
      H('span', { text: '假面骑士' }),
      H('span', { text: '综合大世界' })
    ));
    copy.appendChild(H('div.hero-en', { text: 'KR ARCHIVE' }));
    copy.appendChild(H('p.hero-line', { text: '同一台改造手术，造出怪人，也造出骑士。' }));
    copy.appendChild(scale(W));

    A.appendChild(copy);
    A.appendChild(figures());
    return A;
  }

  // ── 2. 三入口 ────────────────────────────────────────────
  function chevron() {
    return H('svg.gate-arrow', {
      viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'square'
    }, H('path', { d: 'M5 12h13M12 6l6 6-6 6' }));
  }

  function gates() {
    var list = [
      { href: '#/game', no: '01', label: '开始游戏', hint: '从关卡地图选一处地点', cls: 'gate--main btn-gold' },
      { href: '#/roster', no: '02', label: '骑士图鉴', hint: num(riders().length) + ' 位骑士的数值台', cls: 'btn-ghost' },
      { href: '#/archive', no: '03', label: '全量图库', hint: num(IMG_TOTAL) + ' 张图的胶片库', cls: 'btn-ghost' }
    ];
    var nav = H('nav.home-gates', { 'aria-label': '序章入口' });
    for (var i = 0; i < list.length; i++) {
      var a = H('a.gate.btn.btn-lg', { href: list[i].href });
      a.setAttribute('class', a.getAttribute('class') + ' ' + list[i].cls);
      a.appendChild(H('span.gate-no', { text: list[i].no }));
      var body = H('span.gate-body');
      body.appendChild(H('b.gate-lbl', { text: list[i].label }));
      body.appendChild(H('span.gate-hint', { text: list[i].hint }));
      a.appendChild(body);
      a.appendChild(chevron());
      nav.appendChild(a);
    }
    return nav;
  }

  // ── 3. 六纪统合年表 ──────────────────────────────────────
  function splitEra(s) {
    var parts = str(s).split(/\s+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) if (parts[i]) out.push(parts[i]);
    if (out.length <= 1) return { no: '', name: out[0] || '' };
    return { no: out[0], name: out.slice(1).join(' ') };
  }

  function chronoPick(select, idx) {
    return function () { select(idx); };
  }

  function chrono(W) {
    var list = (W.timeline || []).slice();
    var sec = H('section.home-sec.home-chrono', { 'data-sec': 'chrono' });
    sec.appendChild(secHead('TIMELINE · 统合年表', '六纪统合年表', '按组织继承与力量来源切片，不是年份复述。点一纪读全文。'));

    var track = H('div.chrono-track', { role: 'tablist', 'aria-label': '统合年表各纪' });
    var panel = H('div.chrono-detail.panel.panel--quiet');
    panel.appendChild(H('div.panel-hd', {},
      H('h3', { text: '纪年全文' }),
      H('span.chrono-dmark', { text: '点上方任一纪切换' })
    ));
    var body = H('div.panel-bd');
    panel.appendChild(body);

    var btns = [];
    var items = [];

    function select(idx) {
      for (var i = 0; i < items.length; i++) {
        var on = i === idx;
        items[i].classList.toggle('is-on', on);
        btns[i].setAttribute('aria-expanded', on ? 'true' : 'false');
        btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      D().clear(body);
      var t = list[idx];
      if (!t) return;
      var e = splitEra(t.era);
      body.appendChild(H('div.chrono-dhd', {},
        H('b', { text: (e.no ? e.no + ' · ' : '') + e.name }),
        H('span.tnum', { text: str(t.range) })
      ));
      pushAll(body, rich(t.text));
    }

    for (var i = 0; i < list.length; i++) {
      var e = splitEra(list[i].era);
      var item = H('div.chrono-item');
      var btn = H('button.chrono-btn', {
        type: 'button', role: 'tab', 'aria-selected': 'false', 'aria-expanded': 'false'
      });
      btn.appendChild(H('span.chrono-era', { text: e.no || '纪' }));
      btn.appendChild(H('b.chrono-name', { text: e.name }));
      btn.appendChild(H('span.chrono-range.tnum', { text: str(list[i].range) }));
      btn.appendChild(H('span.chrono-x', { text: clip(list[i].text, 90) }));
      btn.addEventListener('click', chronoPick(select, i));
      item.appendChild(btn);
      track.appendChild(item);
      btns.push(btn);
      items.push(item);
    }

    sec.appendChild(track);
    sec.appendChild(panel);
    if (list.length) select(0);
    return sec;
  }

  // ── 4. 敌我同源 ──────────────────────────────────────────
  function racePick(race) {
    return function () {
      var box = H('div.race-modal');
      if (race.base) box.appendChild(H('div.tags', {}, H('span.tag.tag--gold', { text: str(race.base) })));
      pushAll(box, rich(race.desc));
      var h = KR.modal({ title: str(race.name), body: box });
      if (LIVE) LIVE.layers.push(h);
    };
  }

  function raceCard(race, idx) {
    var card = H('button.race-card', {
      type: 'button', 'data-race': str(idx), 'aria-haspopup': 'dialog', 'aria-label': str(race.name) + ' 全文'
    });
    card.setAttribute('class', card.getAttribute('class') + (idx === 0 ? ' race-card--sum' : ''));

    var fig = H('span.plate.plate--photo.race-fig');
    var im = H('img.race-img', { alt: str(race.name) + ' 怪人' });
    im.setAttribute('data-race-img', '1');
    // 怪人索引是异步补的：先用纹章位占住尺寸，索引到了再换成 data-kr-img
    im.src = IMG().placeholder('monster');
    fig.appendChild(im);
    card.appendChild(fig);

    var tx = H('span.race-tx');
    tx.appendChild(H('b.race-name', { text: str(race.name) }));
    if (race.base) tx.appendChild(H('span.tag.tag--dim.race-base', { text: str(race.base) }));
    tx.appendChild(H('span.race-desc', { text: clip(race.desc, 60) }));
    card.appendChild(tx);

    card.addEventListener('click', racePick(race));
    return card;
  }

  function races(W) {
    var list = W.races || [];
    var sec = H('section.home-sec.home-races', { 'data-sec': 'races' });
    sec.appendChild(secHead('AKUMA · 敌我同源', '四十六个种族', '骑士与怪人出自同一套技术、同一个源头、同一种代价。点卡片读全文。'));
    var grid = H('div.race-grid');
    for (var i = 0; i < list.length; i++) grid.appendChild(raceCard(list[i], i));
    sec.appendChild(grid);
    return sec;
  }

  function bucket(list) {
    var bySeries = {}, byEra = {};
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var sk = 's' + str(r.s);
      if (!bySeries[sk]) bySeries[sk] = [];
      bySeries[sk].push(r);
      var ek = 'e' + str(r.e);
      if (!byEra[ek]) byEra[ek] = [];
      byEra[ek].push(r);
    }
    return { bySeries: bySeries, byEra: byEra };
  }

  function hashOf(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h;
  }

  // 种族名与 46 部作品的 org 同源：对得上就用该系列怪人，对不上退到同时代
  function matchMonster(race, W, buckets, all) {
    var name = str(race.name);
    var work = null;
    var works = (W && W.works) || [];
    for (var i = 0; i < works.length; i++) {
      var org = str(works[i].org);
      if (!org) continue;
      if (org === name || name.indexOf(org) >= 0 || org.indexOf(name) >= 0) { work = works[i]; break; }
    }
    var pool = null;
    if (work) {
      var ser = (work.series && work.series.length) ? work.series[0] : null;
      if (ser != null) pool = buckets.bySeries['s' + ser] || null;
      if (!pool) pool = buckets.byEra['e' + str(work.era)] || null;
    }
    if (!pool || !pool.length) pool = all;
    if (!pool.length) return '';
    return str(pool[hashOf(name) % pool.length].p);
  }

  function patchRaceImages() {
    if (!LIVE || !LIVE.alive) return;
    var W = world();
    var monsters = imgList('monsters');
    if (!W || !monsters || !monsters.length) return;
    var buckets = bucket(monsters);
    var cards = D().qa('.race-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var race = (W.races || [])[Number(card.getAttribute('data-race'))];
      if (!race) continue;
      var mine = card.querySelector('img[data-race-img]');
      if (!mine) continue;
      var p = matchMonster(race, W, buckets, monsters);
      if (!p) continue;
      mine.removeAttribute('src');
      mine.setAttribute('data-kr-img', p);
      mine.setAttribute('data-kr-thumb', '1');
      mine.setAttribute('alt', str(race.name) + ' 怪人');
      IMG().observe(card);
    }
  }

  // 怪人索引 362KB：首屏画完再补，绝不挡首帧
  function scheduleMonsters() {
    if (!LIVE) return;
    // 索引已在内存里（比如从图库页回来）就直接补，不必再等一次网络
    if (imgList('monsters')) { patchRaceImages(); return; }
    var t = setTimeout(function () {
      if (!LIVE || !LIVE.alive) return;
      var p;
      try { p = KR.load('data/img-monsters.js'); } catch (e) { return; }
      if (p && typeof p.then === 'function') p.then(patchRaceImages, function () {});
    }, 900);
    LIVE.timers.push(t);
  }

  // ── 5. 判定规则 ──────────────────────────────────────────
  function orderToggle(text, btn, paras, paint) {
    return function () {
      var open = text.getAttribute('data-open') === '1';
      if (open) {
        paint(paras.slice(0, 3));
        text.setAttribute('data-open', '0');
        btn.textContent = '展开全文 · 共 ' + paras.length + ' 段';
        btn.setAttribute('aria-expanded', 'false');
      } else {
        paint(paras);
        text.setAttribute('data-open', '1');
        btn.textContent = '收起';
        btn.setAttribute('aria-expanded', 'true');
      }
    };
  }

  function order(no, title, body) {
    var art = H('article.order');
    art.appendChild(H('header.order-hd', {},
      H('i.order-no', { text: no }),
      H('b.order-title', { text: title })
    ));
    var bd = H('div.order-bd');
    var text = H('div.order-text');
    art.appendChild(bd);
    bd.appendChild(text);

    var paras = [];
    var raw = str(body).split(/\n{2,}/);
    for (var i = 0; i < raw.length; i++) if (raw[i].replace(/\s/g, '')) paras.push(raw[i]);
    var folded = paras.length > 3;

    function paint(list) {
      D().clear(text);
      pushAll(text, rich(list.join('\n\n')));
    }
    paint(folded ? paras.slice(0, 3) : paras);

    if (folded) {
      text.setAttribute('data-open', '0');
      var more = H('button.btn.btn-ghost.btn-sm.order-more', { type: 'button', 'aria-expanded': 'false' });
      more.textContent = '展开全文 · 共 ' + paras.length + ' 段';
      more.addEventListener('click', orderToggle(text, more, paras, paint));
      bd.appendChild(more);
    }
    return art;
  }

  function judge(W) {
    var J = W.judges || {};
    var sec = H('section.home-sec.home-judge', { 'data-sec': 'judge' });
    sec.appendChild(secHead('DOCTRINE · 作战条令', '判定规则', '力×速×术定档，八步走完再落笔。'));
    var list = H('div.order-list');
    list.appendChild(order('01', '定档式', J.statline));
    list.appendChild(order('02', '世界书【判定】原文', J.text));
    list.appendChild(order('03', '越级四路径', J.routes));
    sec.appendChild(list);
    return sec;
  }

  // ── 6. 变身器语法 ────────────────────────────────────────
  function steps() {
    var names = ['资格', '媒介', '转换', '结算'];
    var hints = ['谁能用', '装什么进去', '身体怎么变', '代价从哪扣'];
    var ol = H('ol.steps', { 'aria-label': '变身四步' });
    for (var i = 0; i < names.length; i++) {
      ol.appendChild(H('li.step', {},
        H('i.step-no', { text: '0' + (i + 1) }),
        H('b.step-name', { text: names[i] }),
        H('span.step-hint', { text: hints[i] })
      ));
    }
    return ol;
  }

  function grammarPick(source) {
    return function () {
      var box = H('div.grammar-modal');
      pushAll(box, rich(source));
      var h = KR.modal({ title: '变身器语法 · 原文', body: box });
      if (LIVE) LIVE.layers.push(h);
    };
  }

  function grammar(W) {
    var T = W.transforms || {};
    var sec = H('section.home-sec.home-grammar', { 'data-sec': 'grammar' });
    sec.appendChild(secHead('GRAMMAR · 变身器语法', '资格 · 媒介 · 转换 · 结算', '四百多套装备，都在写同一条句子。'));

    var box = H('div.panel.panel--tight.grammar-box');
    var bd = H('div.panel-bd');
    box.appendChild(bd);
    bd.appendChild(H('p.grammar-lead', { text: clip(T.grammar, 240) }));
    bd.appendChild(steps());

    var ft = H('div.grammar-ft');
    var btn = H('button.btn.btn-ghost.btn-sm', { type: 'button' }, '读语法原文');
    btn.addEventListener('click', grammarPick(T.grammar));
    ft.appendChild(btn);
    ft.appendChild(H('span.grammar-meta', { text: '原文 ' + num(str(T.grammar).length) + ' 字' }));
    bd.appendChild(ft);

    sec.appendChild(box);
    return sec;
  }

  // ── 页脚落款 ─────────────────────────────────────────────
  function years(W) {
    var works = (W && W.works) || [];
    var lo = 0, hi = 0;
    for (var i = 0; i < works.length; i++) {
      var y = Number(works[i].year) || 0;
      if (!y) continue;
      if (!lo || y < lo) lo = y;
      if (y > hi) hi = y;
    }
    return lo ? (lo + '–' + hi) : '1971–2026';
  }

  function colophon(W) {
    return H('footer.home-colophon', {},
      H('span.home-col-mark', { text: 'KR ARCHIVE · 序章' }),
      H('span.home-col-line', { text: '本档案收录 ' + years(W) + '，共 ' + num(W.meta && W.meta.works) + ' 部。' })
    );
  }

  function secHead(kicker, title, note) {
    return H('header.home-sec-hd', {},
      H('span.t-eyebrow', { text: kicker }),
      H('h2.t-h2', { text: title }),
      H('p.home-sec-note', { text: note })
    );
  }

  function missing() {
    return H('section.panel.panel--quiet', {},
      H('div.panel-hd', {}, H('h2', { text: '序章数据未就绪' })),
      H('div.panel-bd', {},
        H('p.muted', { text: 'window.KR.WORLD 没挂上。页面需经 index.html 打开，data/world.js 才会按顺序载入。' })
      )
    );
  }

  // ── 视图生命周期 ─────────────────────────────────────────
  function mount(el) {
    if (!global.KRH || !global.KRD || !global.KRIMG) return;
    unmount();

    LIVE = { alive: true, timers: [], layers: [] };

    var W = world();
    if (!W) { el.appendChild(missing()); return; }

    var root = H('div.home');
    el.appendChild(root);
    LIVE.root = root;

    root.appendChild(hero(W));
    root.appendChild(gates());
    root.appendChild(chrono(W));
    root.appendChild(races(W));
    root.appendChild(judge(W));
    root.appendChild(grammar(W));
    root.appendChild(colophon(W));

    IMG().observe(root);
    scheduleMonsters();
  }

  function unmount() {
    if (!LIVE) return;
    LIVE.alive = false;
    for (var i = 0; i < LIVE.timers.length; i++) clearTimeout(LIVE.timers[i]);
    for (var j = 0; j < LIVE.layers.length; j++) {
      try { LIVE.layers[j].close(); } catch (e) {}
    }
    LIVE = null;
  }

  KR.views = KR.views || {};
  KR.views.home = { title: '序章', mount: mount, unmount: unmount };
})(window);
