// owner: shell-core — KRIMG 五级线路降级与懒加载（本地镜像优先）
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};

  var RAW = 'https://raw.githubusercontent.com/hykhxy/kamen-rider-archive/main/';
  /* 公网版：本地镜像不上传，第 0 线路改为 jsDelivr（全球可达），
     国内网络由其后的 ghfast / wsrv 兜底 */
  var LOCAL_PREFIX = 'https://cdn.jsdelivr.net/gh/hykhxy/kamen-rider-archive@main/';
  var TIER_COUNT = 5;
  var TIER_NAME = ['jsdelivr', 'ghfast', 'wsrv', 'jsdelivr2', 'raw'];

  var TIERS = [
    function (p) { return LOCAL_PREFIX + p; },
    function (p) { return 'https://ghfast.top/' + RAW + p; },
    function (p, w) { return 'https://wsrv.nl/?url=raw.githubusercontent.com/hykhxy/kamen-rider-archive/main/' + p + '&w=' + w + '&output=webp&q=86'; },
    function (p) { return 'https://gcore.jsdelivr.net/gh/hykhxy/kamen-rider-archive@main/' + p; },
    function (p) { return RAW + p; }
  ];

  // 本机实测：jsdelivr 与 raw 已整体不可用，ghfast / wsrv 仍可但 4s 量级，
  // 所以本地镜像必须排第一；缩略图紧跟本地走 wsrv w=320 省流量
  var FULL_ORDER = [0, 1, 2, 4, 3];
  var THUMB_ORDER = [0, 2, 1, 4, 3];
  var IO_MARGIN = '600px';

  var KIND_LABEL = { rider: '骑士', form: '形态', char: '人物', monster: '怪人', item: '道具' };

  var FAILED = Object.create(null);
  var STATS = freshStats();

  function freshStats() {
    return {
      total: 0, ok: 0, failed: 0, placeholders: 0,
      byTier: [0, 0, 0, 0, 0],
      failByTier: [0, 0, 0, 0, 0],
      paths: Object.create(null)
    };
  }

  function kindOf(p) {
    var i = String(p).indexOf('/');
    return i > 0 ? String(p).slice(0, i) : 'img';
  }

  function placeholder(kind) {
    var label = KIND_LABEL[kind] || '未载入';
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" width="120" height="160">' +
      '<rect width="120" height="160" fill="#0c0e13"/>' +
      '<g fill="none" stroke="#c9a227" stroke-width="1" opacity=".5">' +
      '<path d="M60 24 L92 44 L92 84 L60 104 L28 84 L28 44 Z"/>' +
      '<path d="M60 36 L82 49 L82 79 L60 92 L38 79 L38 49 Z" opacity=".55"/>' +
      '</g>' +
      '<path d="M60 50 L72 57 L72 71 L60 78 L48 71 L48 57 Z" fill="#e0372f" opacity=".72"/>' +
      '<text x="60" y="132" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" ' +
      'letter-spacing="3" fill="#6d7686">' + label + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function setAttr(el, k, v) { el.setAttribute(k, v); }

  function attach(img, p, opts) {
    opts = opts || {};
    if (!img || img.nodeType !== 1 || !p) return img;
    p = String(p);
    if (img.getAttribute('data-krimg-bound') === p) return img;

    setAttr(img, 'data-krimg-bound', p);
    setAttr(img, 'data-kr-img', p);
    if (opts.alt) setAttr(img, 'alt', opts.alt);
    if (!img.hasAttribute('loading')) setAttr(img, 'loading', opts.eager ? 'eager' : 'lazy');
    if (!img.hasAttribute('decoding')) setAttr(img, 'decoding', 'async');

    var kind = kindOf(p);
    var order = opts.thumb ? THUMB_ORDER : FULL_ORDER;
    var width = opts.thumb ? 320 : (opts.w || 800);
    var idx = 0;
    var ac = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    var sig = ac ? { signal: ac.signal } : false;

    function stop() {
      if (ac) { ac.abort(); ac = null; }
    }

    function fail() {
      stop();
      STATS.failed++;
      STATS.placeholders++;
      STATS.paths[p] = 1;
      setAttr(img, 'data-failed', '1');
      setAttr(img, 'data-tier', 'x');
      img.src = placeholder(kind);
      if (typeof opts.onFail === 'function') opts.onFail(img);
    }

    function next() {
      while (idx < order.length && FAILED[p + '@' + order[idx]]) idx++;
      if (idx >= order.length) { fail(); return; }
      setAttr(img, 'data-tier', String(order[idx]));
      img.src = TIERS[order[idx]](p, width);
    }

    function onLoad() {
      if (img.getAttribute('data-failed') === '1') return;
      stop();
      STATS.ok++;
      STATS.byTier[Number(img.getAttribute('data-tier')) || 0]++;
      setAttr(img, 'data-ok', '1');
      if (typeof opts.onOk === 'function') opts.onOk(img);
    }

    function onError() {
      var t = Number(img.getAttribute('data-tier'));
      if (t >= 0) {
        STATS.failByTier[t]++;
        // 本地缺图不是坏线路（镜像还在长），绝不写进全局黑名单，下次照样先试本地
        if (t !== 0) FAILED[p + '@' + t] = 1;
      }
      idx += 1;
      next();
    }

    img.addEventListener('error', onError, sig);
    img.addEventListener('load', onLoad, sig);
    STATS.total++;
    next();
    return img;
  }

  var io = null;
  function onIntersect(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      io.unobserve(entries[i].target);
      mount(entries[i].target);
    }
  }

  function mount(img) {
    var p = img.getAttribute('data-kr-img');
    if (!p) return;
    var thumb = img.getAttribute('data-kr-thumb');
    attach(img, p, { thumb: thumb === '1' || thumb === 'true', alt: img.getAttribute('alt') || '' });
  }

  function collect(root) {
    var list = [];
    if (!root) root = document;
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute('data-kr-img')) list.push(root);
    if (root.querySelectorAll) {
      var found = root.querySelectorAll('[data-kr-img]');
      for (var i = 0; i < found.length; i++) list.push(found[i]);
    }
    return list;
  }

  function observe(root) {
    var list = collect(root);
    if (!list.length) return 0;
    if (typeof global.IntersectionObserver !== 'function') {
      for (var i = 0; i < list.length; i++) mount(list[i]);
      return list.length;
    }
    if (!io) io = new global.IntersectionObserver(onIntersect, { rootMargin: IO_MARGIN, threshold: 0 });
    var n = 0;
    for (var j = 0; j < list.length; j++) {
      var el = list[j];
      if (el.getAttribute('data-krimg-bound') || el.__krimgWatched) continue;
      el.__krimgWatched = 1;
      io.observe(el);
      n++;
    }
    return n;
  }

  var KRIMG = {
    local: function (p) { return LOCAL_PREFIX + String(p); },
    path: function (p) { return TIERS[0](String(p)); },
    url: function (p, tier, opts) {
      var t = Number(tier);
      if (!(t >= 0) || t > TIER_COUNT - 1) t = 0;
      return TIERS[t](String(p), (opts && opts.w) || 800);
    },
    attach: attach,
    observe: observe,
    placeholder: placeholder,
    tiers: TIER_NAME.slice(),
    fullOrder: FULL_ORDER.slice(),
    thumbOrder: THUMB_ORDER.slice(),
    failStats: function () {
      var bad = Object.keys(STATS.paths);
      return {
        total: STATS.total,
        ok: STATS.ok,
        failed: STATS.failed,
        placeholders: STATS.placeholders,
        byTier: STATS.byTier.slice(),
        failByTier: STATS.failByTier.slice(),
        tierNames: TIER_NAME.slice(),
        failedPaths: bad.length,
        failedSample: bad.slice(0, 12)
      };
    },
    reset: function () {
      FAILED = Object.create(null);
      STATS = freshStats();
      return true;
    }
  };

  global.KRIMG = KRIMG;
  KR.IMG_API = KRIMG;
})(window);
