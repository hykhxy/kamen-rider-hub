// owner: codex-home — 序章：封面（页眉刻度 + 双行标题 + 立绘带）/ 三入口 / 落款
// v2：删标语、删六格数字、年表与种族迁往关卡页、判定与语法两节删除。首页不再出现任何统计数值。
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};

  var LIVE = null;

  function H() { return global.KRH.apply(global, arguments); }
  function IMG() { return global.KRIMG; }

  function str(v) { return String(v == null ? '' : v); }

  function world() { return (global.KR && global.KR.WORLD) || null; }
  function riders() { return (global.KR && global.KR.RIDERS) || []; }

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

  // 档案边界：只有年份，没有体量。首页不出现任何统计数字。
  function span(W) {
    var works = (W && W.works) || [];
    var lo = 0, hi = 0;
    for (var i = 0; i < works.length; i++) {
      var y = Number(works[i].year) || 0;
      if (!y) continue;
      if (!lo || y < lo) lo = y;
      if (y > hi) hi = y;
    }
    return lo ? (lo + '—' + hi) : '';
  }

  function hero(W) {
    var A = H('section.home-hero', { 'data-sec': 'hero' });
    A.appendChild(H('div.hero-grid', { 'aria-hidden': 'true' }));

    var copy = H('div.hero-copy');
    copy.appendChild(H('div.hero-eyebrow', {},
      H('i', { text: 'KR ARCHIVE' }),
      H('span.tnum', { text: span(W) })
    ));
    copy.appendChild(H('h1.hero-title', {},
      H('span', { text: '假面骑士' }),
      H('span', { text: '综合大世界' })
    ));

    A.appendChild(copy);
    A.appendChild(figures());
    return A;
  }

  // ── 2. 三入口（一条入口带，靠宽度与描边分主次）────────────────
  function chevron() {
    return H('svg.gate-arrow', {
      viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'square'
    }, H('path', { d: 'M5 12h13M12 6l6 6-6 6' }));
  }

  function gates() {
    var list = [
      { href: '#/game', no: '01', label: '开始游戏', hint: '从关卡地图选一处地点', cls: 'gate--main btn-gold' },
      { href: '#/roster', no: '02', label: '骑士图鉴', hint: '力 / 速 / 术 / 防 与评级', cls: 'btn-ghost' },
      { href: '#/archive', no: '03', label: '全量图库', hint: '按作品与系列分卷的胶片库', cls: 'btn-ghost' }
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

  // ── 3. 落款 ──────────────────────────────────────────────
  function colophon() {
    return H('footer.home-colophon', {},
      H('span.home-col-mark', { text: 'KR ARCHIVE · 序章' }),
      H('span.home-col-line', { text: '原文照录，不做解释。' })
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

    LIVE = { alive: true };

    var W = world();
    if (!W) { el.appendChild(missing()); return; }

    var root = H('div.home');
    el.appendChild(root);
    LIVE.root = root;

    root.appendChild(hero(W));
    root.appendChild(gates());
    root.appendChild(colophon());

    IMG().observe(root);
  }

  function unmount() {
    if (!LIVE) return;
    LIVE.alive = false;
    LIVE = null;
  }

  KR.views = KR.views || {};
  KR.views.home = { title: '序章', mount: mount, unmount: unmount };
})(window);
