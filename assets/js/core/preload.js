// owner: lead — 加载页：假面骑士皮带核心意象 + 档案接入计数 + 献词。
// 顺序：本页 → 开场影像。加载页只在本次会话第一次进站时出现，`?nointro=1` 直接跳过。
(function (global, doc) {
  'use strict';

  var KEY = 'kr:pre';
  var DUR = 2600;          // 接入动画时长
  var OUT = 520;           // 出场时长

  function skipped() {
    if (/[?&]nointro=1/.test(global.location.search)) return true;
    try { return global.sessionStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }

  function mark() {
    try { global.sessionStorage.setItem(KEY, 'done'); } catch (e) {}
  }

  var done = false;
  var resolveDone;
  var gate = new Promise(function (r) { resolveDone = r; });
  global.KR_PRELOAD = { ready: gate };

  function build() {
    var el = doc.createElement('div');
    el.className = 'kr-pre';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', '正在接入统合档案');
    el.innerHTML =
      '<div class="kr-pre__grid" aria-hidden="true"></div>' +
      '<div class="kr-pre__scan" aria-hidden="true"></div>' +
      '<div class="kr-pre__stage">' +
      '  <p class="kr-pre__eyebrow"><span>KAMEN RIDER</span><i>ARCHIVE · 1971—2026</i></p>' +
      '  <div class="kr-pre__core" aria-hidden="true">' +
      '    <span class="kr-pre__ring"></span>' +
      '    <span class="kr-pre__ring is-dash"></span>' +
      '    <span class="kr-pre__arc"></span>' +
      '    <span class="kr-pre__eye"></span>' +
      '  </div>' +
      '  <p class="kr-pre__count"><b data-num>000</b><i>/ 100</i><em data-phase>核心同步</em></p>' +
      '  <div class="kr-pre__verse">' +
      '    <p><span>谨以此卡，纪念我失去的时光</span></p>' +
      '    <p><span>那是一段小有遗憾的美好时光</span></p>' +
      '  </div>' +
      '  <p class="kr-pre__hint">点击任意处跳过</p>' +
      '</div>' +
      '<div class="kr-pre__bar" aria-hidden="true"><i data-bar></i></div>';
    return el;
  }

  function finish(el, resolve) {
    if (done) return;
    done = true;
    mark();
    el.classList.add('is-out');
    doc.documentElement.classList.remove('kr-pre-lock');
    global.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      resolve();
      resolveDone();
    }, OUT);
  }

  function run() {
    // 首屏 HTML 里已经有一段静态加载页（保证数据脚本解析前就画出来），这里直接接管它
    var el = doc.getElementById('kr-pre') || build();
    doc.documentElement.classList.add('kr-pre-lock');
    doc.body.appendChild(el);

    var num = el.querySelector('[data-num]');
    var bar = el.querySelector('[data-bar]');
    var arc = el.querySelector('.kr-pre__arc');
    var phase = el.querySelector('[data-phase]');
    var started = performance.now();
    var canSkip = false;

    global.setTimeout(function () { canSkip = true; el.classList.add('is-ready'); }, 700);
    doc.addEventListener('click', function () { if (canSkip) finish(el, resolveDone); });
    doc.addEventListener('keydown', function (e) { if (canSkip && e.key === 'Escape') finish(el, resolveDone); });

    function tick(now) {
      if (done) return;
      var t = Math.min(1, (now - started) / DUR);
      var p = Math.round(t * 100);
      num.textContent = ('00' + p).slice(-3);
      bar.style.transform = 'scaleX(' + t + ')';
      arc.style.setProperty('--p', String(t));
      if (p < 34) phase.textContent = '核心同步';
      else if (p < 72) phase.textContent = '档案校验';
      else phase.textContent = '线路接入';
      if (t < 1) global.requestAnimationFrame(tick);
      else finish(el, resolveDone);
    }
    global.requestAnimationFrame(tick);
  }

  function start() {
    if (skipped()) {
      var el = doc.getElementById('kr-pre');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      resolveDone();
      return;
    }
    run();
  }

  // 尽早显示：本脚本在 <body> 末尾执行，此时 body 已存在，
  // 不等 DOMContentLoaded —— 否则会被后面 3.8MB 数据脚本的解析拖后 1s 以上。
  if (doc.body) start();
  else doc.addEventListener('DOMContentLoaded', start);
})(window, document);
