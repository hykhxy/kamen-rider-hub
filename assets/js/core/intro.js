// owner: lead — 开场影像：全屏播放、可跳过、可回放、带声音增益。
// 规则：进站先播一次（同一标签页只自动播一次）；右上角有「声音 / 回放 / 跳过」；
// 关掉后右下角常驻一枚「回放开场」，随时能把刚才的片子重看一遍。
(function (global, doc) {
  'use strict';

  var VIDEO = 'assets/video/opening.mp4';
  var POSTER = 'assets/video/opening.jpg';
  var KEY = 'kr:intro';
  var GAIN = 2.2;          // 素材本声音量偏小：1.0 只到人声可闻，2.2 大约提升 6–7 dB
  var wrap = null;
  var video = null;
  var audio = { ctx: null, gain: null, ok: false };
  var soundOn = true;

  function skipRequested() {
    if (/[?&]nointro=1/.test(global.location.search)) return true;
    try { return global.sessionStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }

  function markDone() {
    try { global.sessionStorage.setItem(KEY, 'done'); } catch (e) {}
  }

  /* 声音要比 100% 更大：WebAudio 增益 + 压缩器，避免削波 */
  function setupAudio(el) {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var src = ctx.createMediaElementSource(el);
      var gain = ctx.createGain();
      gain.gain.value = GAIN;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      src.connect(gain);
      gain.connect(comp);
      comp.connect(ctx.destination);
      audio = { ctx: ctx, gain: gain, ok: true };
    } catch (e) {
      audio.ok = false;   // 退回 video.volume = 1
    }
  }

  /* 有些浏览器允许不静音自动播放，但 AudioContext 仍是 suspended：
     那样声音会被挂在挂起的上下文里（画面有、声音没有）。任何一次点击/按键都补一次 resume。 */
  function resumeAudio() {
    if (audio.ok && audio.ctx && audio.ctx.state === 'suspended') {
      try { audio.ctx.resume(); } catch (e) {}
    }
  }

  function setSound(on) {
    soundOn = !!on;
    if (!video) return;
    video.muted = !soundOn;
    video.volume = 1;
    resumeAudio();
    if (audio.ok && audio.gain) audio.gain.gain.value = soundOn ? GAIN : 0;
    var btn = wrap && wrap.querySelector('[data-sound]');
    if (btn) {
      btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      btn.textContent = soundOn ? '声音 开' : '声音 关';
    }
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
      '</div>';
    return el;
  }

  function close(reason) {
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
    if (reason !== 'ended') {
      var view = doc.getElementById('view');
      if (view) { try { view.focus({ preventScroll: true }); } catch (e) {} }
    }
  }

  function play() {
    if (!video) return;
    try {
      video.muted = !soundOn;
      video.volume = 1;
      if (audio.ok && audio.ctx) {
        if (audio.ctx.state === 'suspended') { try { audio.ctx.resume(); } catch (e) {} }
        audio.gain.gain.value = soundOn ? GAIN : 0;
      }
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          // 浏览器拦了带声音的自动播放：静音先播，等用户点一下再开
          try {
            video.muted = true;
            soundOn = false;   // 同步状态：否则第一次点「声音」会变成关掉
            var btn = wrap && wrap.querySelector('[data-sound]');
            if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '声音 关'; }
            video.play().catch(function () {});
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  function open(fromStart) {
    if (wrap) {
      if (fromStart && video) { try { video.currentTime = 0; } catch (e) {} play(); }
      return;
    }
    wrap = build();
    video = wrap.querySelector('.kr-intro__v');
    setupAudio(video);

    wrap.querySelector('[data-sound]').addEventListener('click', function () {
      setSound(!soundOn);
      if (soundOn) { try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    });
    wrap.querySelector('[data-replay]').addEventListener('click', function () {
      setSound(true);
      try { video.currentTime = 0; } catch (e) {}
      play();
    });
    wrap.querySelector('.kr-intro__skip').addEventListener('click', function () { close('skip'); });
    video.addEventListener('ended', function () { close('ended'); });
    video.addEventListener('error', function () {
      global.setTimeout(function () { close('error'); }, 1600);
    });
    doc.addEventListener('keydown', onKey);

    doc.documentElement.classList.add('kr-intro-lock');
    doc.body.appendChild(wrap);
    doc.addEventListener('pointerdown', resumeAudio, true);
    doc.addEventListener('keydown', resumeAudio, true);

    setSound(true);
    if (fromStart) { try { video.currentTime = 0; } catch (e) {} }
    play();
  }

  function onKey(e) {
    if (!wrap) { doc.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Escape') close('esc');
    else if (e.key === ' ' && doc.activeElement === doc.body) { e.preventDefault(); open(true); }
  }

  /* 右下角常驻「回放开场」：关掉之后也能把刚才的片子重看一遍 */
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
