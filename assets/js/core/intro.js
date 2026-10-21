// owner: lead — 开场影像：两段片源可切换、可跳过、可回放、带声音提示。
// 音量已烘焙进视频文件（loudnorm），页面侧不接管音频链路：不建 AudioContext、
// 不接 MediaElementSource —— 上下文被挂起时会出现「画面在播、完全没声」。
(function (global, doc) {
  'use strict';

  var SOURCES = [
    {
      id: 'v1', no: '01', label: '原创骑士',
      src: 'assets/video/opening.mp4?v=20261021b',
      poster: 'assets/video/opening.jpg'
    },
    {
      id: 'v2', no: '02', label: '全平成 MAD',
      src: 'assets/video/opening2.mp4?v=1',
      poster: 'assets/video/opening2.jpg'
    }
  ];
  var KEY = 'kr:intro';
  var KEY_SRC = 'kr:intro.src';

  var wrap = null;
  var video = null;
  var soundOn = true;
  var cur = 0;

  function readChoice() {
    try {
      var v = global.localStorage.getItem(KEY_SRC);
      var i = Number(v);
      if (i >= 0 && i < SOURCES.length) return i;
    } catch (e) {}
    return 0;
  }

  function saveChoice(i) {
    try { global.localStorage.setItem(KEY_SRC, String(i)); } catch (e) {}
  }

  function skipRequested() {
    if (/[?&]nointro=1/.test(global.location.search)) return true;
    try { return global.sessionStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }

  function markDone() {
    try { global.sessionStorage.setItem(KEY, 'done'); } catch (e) {}
  }

  function paint() {
    if (!wrap) return;
    var snd = wrap.querySelector('[data-sound]');
    if (snd) {
      snd.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      snd.textContent = soundOn ? '声音 开' : '声音 关';
    }
    var hint = wrap.querySelector('.kr-intro__hint');
    if (hint) hint.hidden = !!soundOn;
    var cta = wrap.querySelector('[data-cta]');
    if (cta) cta.hidden = !!soundOn;
    var chips = wrap.querySelectorAll('[data-src]');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', String(Number(chips[i].getAttribute('data-src')) === cur));
    }
  }

  function setSound(on) {
    soundOn = !!on;
    if (video) { video.muted = !soundOn; video.volume = 1; }
    paint();
  }

  function loadSource(i, autoplay) {
    cur = Math.max(0, Math.min(SOURCES.length - 1, i));
    saveChoice(cur);
    var s = SOURCES[cur];
    if (video) {
      video.poster = s.poster;
      video.src = s.src;
      try { video.load(); } catch (e) {}
      if (autoplay) { try { video.currentTime = 0; } catch (e) {} play(); }
    }
    paint();
  }

  function build() {
    var el = doc.createElement('div');
    el.className = 'kr-intro';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '开场影像');

    var chips = '';
    for (var i = 0; i < SOURCES.length; i++) {
      chips += '<button class="kr-intro__src" type="button" data-src="' + i + '" aria-pressed="false">' +
        '<i>' + SOURCES[i].no + '</i>' + SOURCES[i].label + '</button>';
    }

    el.innerHTML =
      '<video class="kr-intro__v" playsinline preload="auto" aria-hidden="true"></video>' +
      '<div class="kr-intro__bar">' +
      '<div class="kr-intro__srcs" role="group" aria-label="选择开场影像">' + chips + '</div>' +
      '<button class="kr-intro__btn" type="button" data-sound aria-pressed="true">声音 开</button>' +
      '<button class="kr-intro__btn" type="button" data-fs>全屏</button>' +
      '<button class="kr-intro__btn" type="button" data-replay>回放</button>' +
      '<button class="kr-intro__skip" type="button">跳过 <span aria-hidden="true">›</span></button>' +
      '</div>' +
      '<button class="kr-intro__cta" type="button" data-cta hidden>点击开启声音</button>' +
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
          soundOn = false;
          video.muted = true;
          paint();
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

    var chips = wrap.querySelectorAll('[data-src]');
    for (var c = 0; c < chips.length; c++) {
      (function (chip) {
        chip.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var i = Number(chip.getAttribute('data-src'));
          if (i === cur) { try { video.currentTime = 0; } catch (e) {} play(); return; }
          setSound(true);
          loadSource(i, true);
        });
      })(chips[c]);
    }

    var cta = wrap.querySelector('[data-cta]');
    if (cta) cta.addEventListener('click', function (ev) {
      ev.stopPropagation();
      setSound(true);
      try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    });
    wrap.querySelector('[data-sound]').addEventListener('click', function (ev) {
      ev.stopPropagation();
      setSound(!soundOn);
      if (soundOn) { try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    });
    wrap.querySelector('[data-fs]').addEventListener('click', function (ev) {
      ev.stopPropagation();
      try {
        if (doc.fullscreenElement) {
          doc.exitFullscreen();
          if (global.screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        } else if (wrap.requestFullscreen) {
          var r = wrap.requestFullscreen();
          // 手机竖屏看 2.2:1 的片子会被压成一条：进全屏时顺手锁横屏
          if (r && r.then && global.screen && screen.orientation && screen.orientation.lock) {
            r.then(function () { screen.orientation.lock('landscape').catch(function () {}); }).catch(function () {});
          }
        } else if (video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); }
      } catch (e) {}
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
    wrap.addEventListener('click', function () {
      if (!soundOn) { setSound(true); play(); }
    });
    video.addEventListener('ended', close);
    // 片源出错时不要直接清场（切换源时浏览器可能抛一次 abort/error）：
    // 保留浮层，提示换一段，用户仍能跳过或重试。
    video.addEventListener('error', function () {
      if (!wrap) return;
      var hint = wrap.querySelector('.kr-intro__hint');
      if (hint) { hint.hidden = false; hint.textContent = '这段片源没加载出来 · 点上方另一段，或跳过'; }
    });
    doc.addEventListener('keydown', onKey);

    doc.documentElement.classList.add('kr-intro-lock');
    doc.body.appendChild(wrap);

    cur = readChoice();
    loadSource(cur, false);
    setSound(true);
    if (fromStart) { try { video.currentTime = 0; } catch (e) {} }
    play();
  }

  function onKey(e) {
    if (!wrap) { doc.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Escape') close();
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

  global.KRIntro = {
    open: function (i) {
      if (typeof i === 'number') loadSource(i, false);
      open(true);
    },
    close: close
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
