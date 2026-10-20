// owner: shell-core — KRA 动效基元（reduced-motion 下一律瞬时）
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRA = global.KRA = global.KRA || {};

  var raf = global.requestAnimationFrame
    ? function (fn) { return global.requestAnimationFrame(fn); }
    : function (fn) { return setTimeout(function () { fn(KRA.now()); }, 16); };
  var caf = global.cancelAnimationFrame
    ? function (id) { global.cancelAnimationFrame(id); }
    : function (id) { clearTimeout(id); };

  KRA.now = function () {
    return global.performance && global.performance.now ? global.performance.now() : Date.now();
  };

  var mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  KRA.reduced = !!(mq && mq.matches);
  if (mq) {
    var onMq = function (e) { KRA.reduced = e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  KRA.DUR = { fast: 120, base: 180, slow: 240, drama: 600 };
  KRA.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  KRA.easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  function handle(promise, cancel) { return { promise: promise, cancel: cancel }; }

  KRA.raf = function (fn) { return raf(fn); };
  KRA.rafCancel = function (id) { caf(id); };
  KRA.wait = function (ms) { return new Promise(function (r) { setTimeout(r, KRA.reduced ? 0 : (ms || 0)); }); };

  KRA.tweenValue = function (from, to, ms, onTick, ease) {
    from = Number(from) || 0;
    to = Number(to) || 0;
    ms = Number(ms) || 0;
    ease = ease || KRA.easeOut;
    var cancelled = false, id = 0;

    var promise = new Promise(function (resolve) {
      if (KRA.reduced || ms <= 0) {
        if (onTick) onTick(to, 1);
        resolve(to);
        return;
      }
      var t0 = KRA.now();
      var step = function () {
        if (cancelled) return;
        var p = Math.min(1, (KRA.now() - t0) / ms);
        if (onTick) onTick(from + (to - from) * ease(p), p);
        if (p < 1) id = raf(step);
        else resolve(to);
      };
      id = raf(step);
    });

    return handle(promise, function () { cancelled = true; caf(id); });
  };

  KRA.countTo = function (el, from, to, ms, fmt) {
    var write = fmt || function (v) {
      var g = global.KRD;
      return g && g.fmtNum ? g.fmtNum(Math.round(v)) : String(Math.round(v));
    };
    if (!el) {
      if (write) write(to);
      return handle(Promise.resolve(to), function () {});
    }
    var t = KRA.tweenValue(from, to, ms, function (v) { el.textContent = write(v); });
    t.promise.then(function () { el.textContent = write(to); });
    return t;
  };

  function toList(nodes) {
    if (!nodes) return [];
    if (nodes.nodeType) return [nodes];
    if (typeof nodes === 'string') return Array.prototype.slice.call(document.querySelectorAll(nodes));
    if (typeof nodes.length === 'number') return Array.prototype.slice.call(nodes);
    return [];
  }

  KRA.stagger = function (nodes, stepMs, fn) {
    var list = toList(nodes);
    var timers = [];
    var cancelled = false;
    var gap = stepMs == null ? 40 : stepMs;

    var promise = new Promise(function (resolve) {
      if (!list.length) { resolve(0); return; }
      if (KRA.reduced || gap <= 0) {
        for (var i = 0; i < list.length; i++) if (fn) fn(list[i], i);
        resolve(list.length);
        return;
      }
      var left = list.length;
      list.forEach(function (el, i) {
        timers.push(setTimeout(function () {
          if (cancelled) return;
          if (fn) fn(el, i);
          left -= 1;
          if (left === 0) resolve(list.length);
        }, i * gap));
      });
    });

    return handle(promise, function () {
      cancelled = true;
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers.length = 0;
    });
  };

  KRA.toggleClass = function (el, cls, on, ms) {
    if (!el) return;
    if (KRA.reduced) { el.classList.toggle(cls, !!on); return; }
    if (on) el.classList.add(cls);
    else {
      el.classList.remove(cls);
      if (ms) setTimeout(function () { el.classList.remove(cls); }, ms);
    }
  };

  global.KRA = KRA;
})(window);
