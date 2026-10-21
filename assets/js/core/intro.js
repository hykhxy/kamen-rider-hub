// owner: lead — 开场影像：全屏播放、可跳过、可回放、带声音提示。
// 音量已烘焙进视频文件（loudnorm I=-12 LUFS，比素材原始 -35dB 提高约 20dB），
// 页面侧不再接管音频链路：不建 AudioContext、不接 MediaElementSource。
// 原因：MediaElementSource 会把声音挂到 AudioContext 上，上下文 suspended 时画面正常但完全没声，
// 这是「看着在播却没声音」最常见的来源。这里只控制 muted 与 volume=1。
(function (global, doc) {
  'use strict';

  var VIDEO = 'assets/video/opening.mp4?v=20261021b';   // 换版本号避开旧缓存（旧文件音量只有 -35dB）
  var POSTER = 'assets/video/opening.jpg';
  var KEY = 'kr:intro';

  var wrap = null;
  var video = null;
  var soundOn = true;

  function skipRequested() {
    if (/[?&]nointro=1/.test(global.location.search)) return true;
    try { return global.sessionStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }

  function markDone() {
    try { global.sessionStorage.setItem(KEY, 'done'); } catch (e) {}
  }

  function paintSound() {
    var btn = wrap && wrap.querySelector('[data-sound]');
    if (btn) {
      btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      btn.textContent = soundOn ? '声音 开' : '声音 关';
    }
    var hint = wrap && wrap.querySelector('.kr-intro__hint');
    if (hint) hint.hidden = !!soundOn;
  }

  function setSound(on) {
    soundOn = !!on;
    if (video) {
      video.muted = !soundOn;
      video.volume = 1;
    }
    paintSound();
  }

  function build() {
    var el = doc.createElement('div');
    el.className = 'kr-intro';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '开场影像');
    el.innerHTML =
      '<video class="kr-intro__v" src="' + VIDEO + '" poster="' + POSTER + '" ' +
      'playsinline preload="auto" aria-hidden="true"></video>' +
      '<div class="kr-intro__bar">' +
      '<button class="kr-intro__btn" type="button" data-sound aria-pressed="true">声音 开</button>' +
      '<button class="kr-intro__btn" type="button" data-replay>回放</button>' +
      '<button class="kr-intro__skip" type="button">跳过 <span aria-hidden="true">›</span></button>' +
      '</div>' +
      '<p class="kr-intro__hint" hidden>浏览器拦了带声音的自动播放 · 点画面或「声音」开启</p>';
    return el;
  }

  function close() {
    if (!wrap) return;
    var node = wrap;
    wrap = null;
    markDone();
    node.classList.add('is-out');
    try { video.pause(); } catch (e) {}
    doc.documentElement.classList.remove('kr-intro-lock');
    global.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 420);
    var view = doc.getElementById('view');
    if (view) { try { view.focus({ preventScroll: true }); } catch (e) {} }
  }

  function play() {
    if (!video) return;
    video.muted = !soundOn;
    video.volume = 1;
    try {
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          // 带声音的自动播放被拦：静音先播，并显示提示
          soundOn = false;
          video.muted = true;
          paintSound();
          try { video.play().catch(function () {}); } catch (e) {}
        });
      }
    } catch (e) {}
  }

  function open(fromStart) {
    if (wrap) {
      if (fromStart) {
        setSound(true);
        try { video.currentTime = 0; } catch (e) {}
        play();
      }
      return;
    }
    wrap = build();
    video = wrap.querySelector('.kr-intro__v');

    wrap.querySelector('[data-sound]').addEventListener('click', function (ev) {
      ev.stopPropagation();
      setSound(!soundOn);
      if (soundOn) { try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    });
    wrap.querySelector('[data-replay]').addEventListener('click', function (ev) {
      ev.stopPropagation();
      setSound(true);
      try { video.currentTime = 0; } catch (e) {}
      play();
    });
    wrap.querySelector('.kr-intro__skip').addEventListener('click', function (ev) {
      ev.stopPropagation();
      close();
    });
    // 点画面任意处：没声就开声，有声保持（避免误关）
    wrap.addEventListener('click', function () {
      if (!soundOn) { setSound(true); play(); }
    });
    video.addEventListener('ended', close);
    video.addEventListener('error', function () {
      global.setTimeout(close, 1600);
    });
    doc.addEventListener('keydown', onKey);

    doc.documentElement.classList.add('kr-intro-lock');
    doc.body.appendChild(wrap);

    if (fromStart) { try { video.currentTime = 0; } catch (e) {} }
    setSound(true);
    play();
  }

  function onKey(e) {
    if (!wrap) { doc.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Escape') close();
    else if (e.key === ' ' && doc.activeElement === doc.body) { e.preventDefault(); open(true); }
  }

  function replayPill() {
    var b = doc.createElement('button');
    b.className = 'kr-replay';
    b.type = 'button';
    b.textContent = '回放开场';
    b.addEventListener('click', function () { open(true); });
    doc.body.appendChild(b);
  }

  function start() {
    replayPill();
    if (skipRequested()) return;
    open(false);
  }

  global.KRIntro = { open: function () { open(true); }, close: close };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
