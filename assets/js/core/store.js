// owner: shell-core — 存储、按需加载、KR.state 初始结构
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var PREFIX = 'krh:';
  var MEM = {};
  var LS = null;

  try {
    var probe = PREFIX + '__probe__';
    global.localStorage.setItem(probe, '1');
    global.localStorage.removeItem(probe);
    LS = global.localStorage;
  } catch (e) {
    LS = null;
  }

  function encode(v) {
    try { return JSON.stringify(v); } catch (e) { return JSON.stringify(String(v)); }
  }

  var KRSTORE = {
    persistent: !!LS,

    get: function (key, fallback) {
      var raw;
      try {
        raw = LS ? LS.getItem(PREFIX + key) : (Object.prototype.hasOwnProperty.call(MEM, key) ? MEM[key] : null);
      } catch (e) {
        raw = null;
      }
      if (raw == null) return fallback === undefined ? null : fallback;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    },

    set: function (key, value) {
      var raw = encode(value);
      try {
        if (LS) LS.setItem(PREFIX + key, raw);
        else MEM[key] = raw;
        return true;
      } catch (e) {
        MEM[key] = raw;
        return false;
      }
    },

    remove: function (key) {
      try { if (LS) LS.removeItem(PREFIX + key); } catch (e) {}
      delete MEM[key];
    },

    keys: function () {
      var out = [];
      try {
        if (LS) {
          for (var i = 0; i < LS.length; i++) {
            var k = LS.key(i);
            if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
          }
        }
      } catch (e) {}
      for (var m in MEM) {
        if (Object.prototype.hasOwnProperty.call(MEM, m) && out.indexOf(m) < 0) out.push(m);
      }
      return out;
    }
  };

  // 存档结构固定：视图只改字段，不改形状
  KR.state = KR.state || {
    myRiders: [],
    gacha: { pulls: 0, pity: 0 },
    character: null,
    lastNode: null
  };

  KR.save = function () {
    return KRSTORE.set('state', KR.state);
  };

  KR.restore = function () {
    var saved = KRSTORE.get('state', null);
    if (!saved || typeof saved !== 'object') return false;
    if (saved.myRiders instanceof Array) KR.state.myRiders = saved.myRiders;
    if (saved.gacha && typeof saved.gacha === 'object') {
      KR.state.gacha.pulls = Number(saved.gacha.pulls) || 0;
      KR.state.gacha.pity = Number(saved.gacha.pity) || 0;
    }
    if ('character' in saved) KR.state.character = saved.character;
    if ('lastNode' in saved) KR.state.lastNode = saved.lastNode;
    return true;
  };

  var PENDING = {};

  // file:// 下 fetch 与模块加载都不可用，只能拿 script.onload 当加载信号
  KR.load = function (path) {
    path = String(path || '');
    if (!path) return Promise.reject(new Error('KR.load 需要路径'));
    if (PENDING[path]) return PENDING[path];

    var p = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.async = false;
      s.src = path;
      s.onload = function () { resolve(path); };
      s.onerror = function () {
        delete PENDING[path];
        reject(new Error('脚本加载失败：' + path));
      };
      (document.head || document.documentElement).appendChild(s);
    });

    PENDING[path] = p;
    return p;
  };

  global.KRSTORE = KRSTORE;
})(window);
