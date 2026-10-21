// owner: shell-core — hash 路由、HUD/页脚、视图生命周期、错误兜底
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRD = global.KRD;
  KR.views = KR.views || {};

  var ROUTE_VIEW = {
    '': 'home', home: 'home',
    map: 'map', game: 'map',
    create: 'create',
    roster: 'roster',
    rider: 'rider',
    gacha: 'gacha',
    codex: 'codex', archive: 'codex'
  };

  var VIEW_TITLE = {
    home: '序章', map: '关卡', create: '创造角色', roster: '骑士图鉴',
    rider: '骑士详情', gacha: '抽卡', codex: '全量图库'
  };

  var NAV = [
    { key: 'home', href: '#/', label: '序章', no: '01', match: ['home'] },
    { key: 'game', href: '#/game', label: '关卡', no: '02', match: ['map'] },
    { key: 'roster', href: '#/roster', label: '图鉴', no: '03', match: ['roster', 'rider'] },
    { key: 'gacha', href: '#/gacha', label: '抽卡', no: '04', match: ['gacha'] },
    { key: 'archive', href: '#/archive', label: '图库', no: '05', match: ['codex'] }
  ];

  var EMBLEM =
    '<path d="M16 2.5 28.5 9.5v13L16 29.5 3.5 22.5v-13z" opacity=".8"/>' +
    '<path d="M16 7.6 23.4 11.6v9L16 24.4 8.6 20.6v-9z" opacity=".42"/>' +
    '<path d="M15.9 9.6v13.2" opacity=".9"/>' +
    '<path d="M11.4 14.4 15.9 16.7l4.5-2.3" opacity=".8"/>';

  var CURRENT = null;
  var ENTER_T = null;

  // 收集器在 dom.js，router 只做转发与视图级兜底
  function report(scope, err) { return KR.report(scope, err); }

  // ── 路由解析 ────────────────────────────────────────────
  function decode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function parseQuery(str) {
    var out = {};
    var parts = String(str || '').split('&');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf('=');
      var k = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      out[decode(k)] = eq < 0 ? '' : decode(parts[i].slice(eq + 1));
    }
    return out;
  }

  function parseHash() {
    var raw = String(global.location.hash || '');
    var h = raw.replace(/^#/, '');
    var query = {};
    var qi = h.indexOf('?');
    if (qi >= 0) { query = parseQuery(h.slice(qi + 1)); h = h.slice(0, qi); }
    var segs = h.split('/').filter(function (s) { return s !== ''; });
    return {
      name: segs.length ? decode(segs[0]) : '',
      params: segs.slice(1).map(decode),
      query: query,
      path: '/' + segs.join('/'),
      raw: raw
    };
  }

  // ── 外壳：HUD 与页脚只建一次 ────────────────────────────
  function refreshCounters() {
    var n = KR.state && KR.state.myRiders ? KR.state.myRiders.length : 0;
    var nodes = KRD.qa('[data-bind="riders"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = KRD.fmtNum(n);
    // 顶栏唯一的动态视觉差异：0 压灰、≥1 转金（不加边框 / 不加 hover / 不做按钮）
    var counts = KRD.qa('.hud-count');
    for (var j = 0; j < counts.length; j++) counts[j].setAttribute('data-empty', n ? '0' : '1');
  }

  // hud 三档高度（66 / 54 / 84–88）。sticky 偏移一律读这个变量，不写死 54px。
  function syncHudH() {
    var hud = document.getElementById('hud');
    if (!hud) return;
    var h = hud.offsetHeight || 0;
    if (h) document.documentElement.style.setProperty('--hud-h', h + 'px');
  }

  function buildHud(hud) {
    KRD.clear(hud);

    var brand = KRH('a.hud-brand', { href: '#/', 'aria-label': '返回序章' },
      KRH('svg.hud-emblem', {
        viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor',
        'stroke-width': '1.3', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
      }, KRH('g', { html: EMBLEM })),
      KRH('span.hud-name', {}, KRH('b', { text: '假面骑士' }), KRH('span', { text: 'KR ARCHIVE' }))
    );

    var nav = KRH('nav.hud-nav', { 'aria-label': '主导航' });
    for (var i = 0; i < NAV.length; i++) {
      nav.appendChild(KRH('a.navlink', { href: NAV[i].href, 'data-nav': NAV[i].key },
        KRH('i', { text: NAV[i].no }),
        KRH('span', { text: NAV[i].label })
      ));
    }

    // 右侧只留「我的骑士」一个元素：不加按钮、不加刻度、不加边框。
    // 读屏念「我的骑士 0」；抽卡后计数变化由 aria-live 播报一次。
    var side = KRH('div.hud-side', {},
      KRH('div.hud-count', {
        role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-empty': '1'
      },
        KRH('span.sr-only', { text: '我的骑士 ' }),
        KRH('b', { text: '0', 'data-bind': 'riders' }),
        KRH('span', { 'aria-hidden': 'true', text: '我的骑士' })
      )
    );

    hud.appendChild(brand);
    hud.appendChild(nav);
    hud.appendChild(side);
    hud.setAttribute('data-built', '1');

    refreshCounters();
  }

  function buildFoot(foot) {
    KRD.clear(foot);
    // 页脚只做标识与说明：不写体量、不写版本号、不写在线状态（一样都不带数字）
    foot.appendChild(KRH('span', {}, KRH('b', { text: '档案' }), ' 世界书原文 · 作品年表 · 图像索引'));
  }

  function ensureShell() {
    var hud = document.getElementById('hud');
    if (hud && !hud.getAttribute('data-built')) buildHud(hud);
    var foot = document.getElementById('foot');
    if (foot && !foot.getAttribute('data-built')) buildFoot(foot);
  }

  function paintNav(viewKey) {
    var links = KRD.qa('.navlink');
    for (var i = 0; i < links.length; i++) {
      var key = links[i].getAttribute('data-nav');
      var item = null;
      for (var j = 0; j < NAV.length; j++) if (NAV[j].key === key) item = NAV[j];
      var on = !!(item && item.match.indexOf(viewKey) >= 0);
      links[i].classList.toggle('is-on', on);
      if (on) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  // ── 视图渲染 ────────────────────────────────────────────
  function renderWip(el, key, r) {
    var route = '#/' + (r.name || '') + (r.params.length ? '/' + r.params.join('/') : '');
    el.appendChild(KRH('section.wip', {},
      KRH('div.wip-stripes'),
      KRH('div.wip-body', {},
        KRH('div.t-eyebrow', { text: 'BUILDING' }),
        KRH('h2', { text: '建设中 · ' + (VIEW_TITLE[key] || key) }),
        KRH('p', { text: '视图 ' + key + ' 还没注册到 KR.views，此路由先占位。顶栏、导航、页脚与切页转场已就绪。' }),
        KRH('div.wip-route', {}, KRH('span', { text: route || '#/' })),
        KRH('ul.wip-steps', {},
          KRH('li', { text: '等待 owner 提交 assets/js/views/' + key + '.js' }),
          KRH('li', { text: '契约：KR.views.' + key + ' = { title, mount(el, params), unmount() }' }),
          KRH('li', { text: '注册后调用 KR.route() 立即看到结果' })
        )
      )
    ));
  }

  function renderError(el, key, err) {
    var detail = (err && (err.stack || err.message)) || String(err);
    KRD.clear(el);
    el.setAttribute('data-view', key);
    el.setAttribute('data-err', '1');
    el.appendChild(KRH('section.panel.err-panel', {},
      KRH('div.panel-hd', {}, KRH('h2', { text: '视图异常 · ' + (VIEW_TITLE[key] || key) })),
      KRH('div.panel-bd', {},
        KRH('p.muted.sm', { text: '该视图 mount 抛出异常，导航与其余路由仍然可用。' }),
        KRH('pre', { text: detail })
      ),
      KRH('div.panel-ft', {},
        KRH('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: function () { route(); } }, '重试'),
        KRH('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: function () { KR.go('/'); } }, '回序章')
      )
    ));
    report('view ' + key, err);
  }

  function route() {
    var r = parseHash();
    var viewKey = ROUTE_VIEW[r.name] || r.name || 'home';
    var view = KR.views[viewKey] || null;
    var viewEl = document.getElementById('view');
    if (!viewEl) return;

    if (CURRENT && CURRENT.view && typeof CURRENT.view.unmount === 'function') {
      try { CURRENT.view.unmount(viewEl); } catch (e) { report('unmount ' + CURRENT.key, e); }
    }

    KRD.clear(viewEl);
    viewEl.setAttribute('data-view', viewKey);
    viewEl.removeAttribute('data-err');
    CURRENT = { key: viewKey, view: view, params: r.params };

    if (!view || typeof view.mount !== 'function') {
      renderWip(viewEl, viewKey, r);
    } else {
      try {
        var out = view.mount(viewEl, { params: r.params, query: r.query, path: r.path, name: r.name });
        if (out && typeof out.then === 'function') {
          out.then(null, function (e) { renderError(viewEl, viewKey, e); });
        }
      } catch (e) {
        renderError(viewEl, viewKey, e);
      }
      if (view.title) document.title = view.title + ' · 假面骑士综合大世界';
    }

    paintNav(viewKey);
    refreshCounters();

    viewEl.classList.remove('is-enter');
    void viewEl.offsetWidth;
    viewEl.classList.add('is-enter');
    // 动画结束后必须摘掉 is-enter：view-in 带 fill:both，收尾的 transform 会让 #view 永久成为
    // fixed 后代的包含块 —— 地图页的底部抽屉（position:fixed）会改相对 #view 定位，
    // 一滚到页面下方就飘到文档底部去。
    clearTimeout(ENTER_T);
    ENTER_T = setTimeout(function () { viewEl.classList.remove('is-enter'); }, 420);

    try { global.scrollTo(0, 0); } catch (e) {}
    try { viewEl.focus({ preventScroll: true }); } catch (e) {}
  }

  KR.route = route;
  KR.parseRoute = parseHash;
  KR.NAV = NAV;
  KR.ROUTES = ROUTE_VIEW;

  KR.go = function (path) {
    var p = String(path == null ? '/' : path).replace(/^#/, '');
    if (p.charAt(0) !== '/') p = '/' + p;
    if (global.location.hash === '#' + p) { route(); return; }
    global.location.hash = '#' + p;
  };

  // ── 浮层：layer / modal / toast ─────────────────────────
  function layerRoot() {
    return document.getElementById('layer-root') || document.body;
  }

  KR.layer = function (node, opts) {
    opts = opts || {};
    var host = KRH('div.layer-host', {}, node);
    layerRoot().appendChild(host);
    var closed = false;
    return {
      el: host,
      node: node,
      close: function () {
        if (closed) return;
        closed = true;
        if (host.parentNode) host.parentNode.removeChild(host);
        if (typeof opts.onClose === 'function') opts.onClose();
      }
    };
  };

  KR.modal = function (opts) {
    opts = opts || {};
    var handle, offEsc = null;

    function close() { if (handle) handle.close(); }

    var body = opts.body;
    if (typeof body === 'string') body = KRH('div', { html: body });
    if (!body) body = KRH('div', { html: '&nbsp;' });

    var dlg = KRH('div.modal-dialog', {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '详情', tabindex: '-1'
    },
      KRH('div.modal-hd', {},
        KRH('h3', { text: opts.title || '详情' }),
        KRH('button.modal-x', { type: 'button', 'aria-label': '关闭', onclick: close }, '×')
      ),
      KRH('div.modal-bd', {}, body),
      opts.actions ? KRH('div.modal-ft', {}, opts.actions) : null
    );

    var back = KRH('div.modal', { onclick: function (ev) { if (ev.target === back) close(); } }, dlg);

    handle = KR.layer(back, {
      onClose: function () {
        if (offEsc) offEsc();
        if (typeof opts.onClose === 'function') opts.onClose();
      }
    });

    offEsc = KRD.on(document, 'keydown', function (ev) { if (ev.key === 'Escape') close(); });
    setTimeout(function () { try { dlg.focus(); } catch (e) {} }, 0);
    return handle;
  };

  KR.toast = function (text, kind, ms) {
    var wrap = KRD.q('.toast-wrap');
    if (!wrap) {
      wrap = KRH('div.toast-wrap', { role: 'status', 'aria-live': 'polite' });
      layerRoot().appendChild(wrap);
    }
    var t = KRH('div.toast' + (kind ? '.toast--' + kind : ''), {}, text);
    wrap.appendChild(t);
    var life = ms == null ? 2600 : ms;
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, life);
    return t;
  };

  // ── 启动与兜底 ──────────────────────────────────────────
  function markBoot() {
    document.documentElement.setAttribute('data-boot', 'loaded');
    var boot = document.getElementById('boot');
    if (!boot) return;
    boot.classList.add('is-loaded');
    boot.setAttribute('data-state', 'loaded');
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 320);
  }

  function boot() {
    // 顶栏不再有「读档」按钮，restore 的唯一调用点就在这里。
    // 少了这一步，localStorage 里的 myRiders 永不读回：刷新即归零，而界面一切正常。
    try { if (KR.restore) KR.restore(); } catch (e) { report('restore', e); }
    ensureShell();
    syncHudH();
    route();
    markBoot();

    KRD.on(global, 'resize', KRD.debounce(function () { syncHudH(); }, 140));
    // iOS 上 orientationchange 常与 visualViewport.resize 抢时序，延后再量一次
    KRD.on(global, 'orientationchange', function () { setTimeout(syncHudH, 150); });
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(function () { syncHudH(); }, function () {});
    }
  }

  // 任何未捕获异常：只要 #view 还空着，就地把错误面板画进去，绝不白屏
  KR.onReport = function (scope, err) {
    var viewEl = document.getElementById('view');
    if (!viewEl || viewEl.firstChild || viewEl.getAttribute('data-err') === '1') return;
    renderError(viewEl, (CURRENT && CURRENT.key) || 'unknown', err instanceof Error ? err : new Error(String(err)));
  };

  global.addEventListener('hashchange', route);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
