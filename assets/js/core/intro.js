// owner: lead — 开场影像：全屏播放，右上角可跳过；跳过/播完写 sessionStorage，本次会话不再打扰。
(function (global, doc) {
  'use strict';

  var VIDEO = 'assets/video/opening.mp4';
  var POSTER = 'assets/video/opening.jpg';
  var KEY = 'kr:intro';           // sessionStorage：本次会话已看过

  function skipRequested() {
    if (/[?&]nointro=1/.test(global.location.search)) return true;
    try { return global.sessionStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }

  function markDone() {
    try { global.sessionStorage.setItem(KEY, 'done'); } catch (e) {}
  }

  function build() {
    var wrap = doc.createElement('div');
    wrap.className = 'kr-intro';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', '开场影像');
    wrap.innerHTML =
      '<video class="kr-intro__v" src="' + VIDEO + '" poster="' + POSTER + '" ' +
      'autoplay muted playsinline preload="auto" aria-hidden="true"></video>' +
      '<div class="kr-intro__bar">' +
      '<button class="kr-intro__skip" type="button">跳过 <span aria-hidden="true">›</span></button>' +
      '</div>';
    return wrap;
  }

  function start() {
    if (skipRequested()) return;
    var wrap = build();
    var video = wrap.querySelector('.kr-intro__v');
    var skip = wrap.querySelector('.kr-intro__skip');
    var closed = false;

    function close(reason) {
      if (closed) return;
      closed = true;
      markDone();
      wrap.classList.add('is-out');
      try { video.pause(); } catch (e) {}
      doc.documentElement.classList.remove('kr-intro-lock');
      global.setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 420);
      if (reason !== 'ended' && doc.activeElement === skip) {
        var view = doc.getElementById('view');
        if (view) { try { view.focus({ preventScroll: true }); } catch (e) {} }
      }
    }

    skip.addEventListener('click', function () { close('skip'); });
    video.addEventListener('ended', function () { close('ended'); });
    video.addEventListener('error', function () {
      // 影像取不到（离线/网络受限）时不要留一块黑屏：退到海报，1.6s 后自动放过
      global.setTimeout(function () { close('error'); }, 1600);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close('esc');
    });

    doc.documentElement.classList.add('kr-intro-lock');
    doc.body.appendChild(wrap);
    try {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
