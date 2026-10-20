// owner: shell-core — KRH 建元素简写 / KRD 工具集
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  KR.views = KR.views || {};

  var SVG_TAGS = /^(svg|g|path|circle|rect|line|polyline|polygon|text|tspan|defs|use|ellipse|stop|pattern|clipPath|linearGradient|radialGradient)$/;
  var SELECTOR = /^([a-zA-Z][a-zA-Z0-9-]*)?((?:[.#][a-zA-Z0-9_-]+)*)$/;
  var UID = 0;

  function parse(sel) {
    var m = SELECTOR.exec(String(sel == null ? 'div' : sel).trim() || 'div');
    if (!m) return { tag: 'div', cls: '', id: '' };
    var parts = (m[2] || '').split(/(?=[.#])/);
    var cls = [], id = '';
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      if (!t) continue;
      if (t.charAt(0) === '.') cls.push(t.slice(1));
      else id = t.slice(1);
    }
    return { tag: m[1] || 'div', cls: cls.join(' '), id: id };
  }

  function isChild(v) {
    return v == null || typeof v === 'string' || typeof v === 'number' ||
      (typeof v === 'object' && (v.nodeType || v.constructor === Array));
  }

  function addClass(el, v) {
    var cur = el.getAttribute('class') || '';
    el.setAttribute('class', (cur ? cur + ' ' : '') + v);
  }

  function applyProps(el, props) {
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') addClass(el, v);
      else if (k === 'style' && typeof v === 'object') {
        for (var s in v) {
          if (!Object.prototype.hasOwnProperty.call(v, s)) continue;
          var name = s.charAt(0) === '-' ? s : s.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
          el.style.setProperty(name, v[s]);
        }
      } else if (k === 'dataset' && typeof v === 'object') {
        for (var d in v) {
          if (Object.prototype.hasOwnProperty.call(v, d)) el.setAttribute('data-' + d.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), v[d]);
        }
      } else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (typeof v === 'function' && k.slice(0, 2) === 'on') {
        var type = k.charAt(2) === ':' ? k.slice(3) : k.slice(2).toLowerCase();
        el.addEventListener(type, v);
      } else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }

  function append(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k == null || k === false) continue;
      if (k.constructor === Array) { append(el, k); continue; }
      el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    }
  }

  function KRH(sel, props) {
    var p = parse(sel);
    var el = SVG_TAGS.test(p.tag)
      ? document.createElementNS('http://www.w3.org/2000/svg', p.tag)
      : document.createElement(p.tag);
    if (p.tag === 'svg') el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (p.id) el.setAttribute('id', p.id);
    if (p.cls) addClass(el, p.cls);
    var from = 1;
    if (arguments.length > 1 && !isChild(props)) { applyProps(el, props); from = 2; }
    append(el, Array.prototype.slice.call(arguments, from));
    return el;
  }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  function html(str) {
    var t = document.createElement('template');
    t.innerHTML = String(str == null ? '' : str).trim();
    var c = t.content;
    return c.children.length === 1 ? c.firstElementChild : c;
  }

  function fmtNum(n, digits) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    var d = digits == null ? 0 : Math.max(0, Math.min(4, digits | 0));
    var parts = v.toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function clamp(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) v = lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function debounce(fn, ms) {
    var t = null;
    var wrapped = function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms || 120);
    };
    wrapped.cancel = function () { if (t) { clearTimeout(t); t = null; } };
    return wrapped;
  }

  function throttle(fn, ms) {
    var last = 0, timer = null, lastArgs = null;
    var wrapped = function () {
      var now = Date.now(), gap = ms || 120;
      lastArgs = arguments;
      if (now - last >= gap) { last = now; fn.apply(this, arguments); return; }
      if (timer) return;
      var self = this;
      timer = setTimeout(function () {
        timer = null;
        last = Date.now();
        fn.apply(self, lastArgs || []);
      }, gap - (now - last));
    };
    wrapped.cancel = function () { if (timer) { clearTimeout(timer); timer = null; } };
    return wrapped;
  }

  function uid(prefix) {
    UID += 1;
    return (prefix || 'kr') + '-' + UID.toString(36);
  }

  function on(target, types, fn, opts) {
    var list = String(types).split(/\s+/).filter(Boolean);
    for (var i = 0; i < list.length; i++) target.addEventListener(list[i], fn, opts);
    return function off() {
      for (var j = 0; j < list.length; j++) target.removeEventListener(list[j], fn, opts);
    };
  }

  function one(target, types, fn, opts) {
    var off = on(target, types, function (ev) { off(); fn.call(this, ev); }, opts);
    return off;
  }

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

  var KRD = {
    el: KRH,
    html: html,
    esc: esc,
    fmtNum: fmtNum,
    clamp: clamp,
    debounce: debounce,
    throttle: throttle,
    uid: uid,
    on: on,
    one: one,
    q: q,
    qa: qa,
    clear: clear
  };

  // ── 诊断：本文件最先加载，收集器必须早于任何视图脚本 ────
  var ERRORS = [];
  var DIAG_EL = null;
  var RESFAIL = 0;

  function diagEl() {
    if (DIAG_EL && DIAG_EL.parentNode) return DIAG_EL;
    var b = document.createElement('div');
    b.id = 'krh-diag';
    b.hidden = true;
    b.setAttribute('data-count', '0');
    if (document.body) document.body.appendChild(b);
    DIAG_EL = b;
    return b;
  }

  function report(scope, err) {
    var msg = scope + ': ' + (err && err.message ? err.message : (err && err.stack ? err.stack : String(err)));
    ERRORS.push(msg);
    try {
      var box = diagEl();
      box.setAttribute('data-count', String(ERRORS.length));
      box.textContent = ERRORS.join(' / ');
    } catch (e) {}
    if (typeof KR.onReport === 'function') {
      try { KR.onReport(scope, err, msg); } catch (e2) {}
    }
    return msg;
  }

  KR.report = report;
  KR.errors = ERRORS;
  KR.diag = {
    count: function () { return ERRORS.length; },
    resfail: function () { return RESFAIL; },
    box: function () { return diagEl(); }
  };

  global.onerror = function (msg, src, line, col, err) {
    report('window.onerror', err || new Error(msg + ' @' + String(src || '').split('/').pop() + ':' + line));
    return false;
  };

  global.addEventListener('unhandledrejection', function (e) { report('unhandledrejection', e.reason); });

  // 资源 404（file:// 下 data/*.js 未就绪）单独计数，不污染脚本错误
  global.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t === global || !t.tagName) return;
    RESFAIL += 1;
    document.documentElement.setAttribute('data-resfail', String(RESFAIL));
  }, true);

  if (document.body) diagEl();

  global.KRH = KRH;
  global.KRD = KRD;
})(window);
