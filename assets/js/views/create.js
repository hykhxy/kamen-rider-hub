// owner: quest-create — 创造角色：档案式单页，左表单右 sticky 角色卡
(function (global) {
  'use strict';

  var KR = global.KR = global.KR || {};
  var KRD = global.KRD;
  var KRH = global.KRH;
  var KRIMG = global.KRIMG;

  function Q() { return KR.quest; }
  function clampNum(v, lo, hi) { var n = Number(v); if (!isFinite(n)) n = lo; return n < lo ? lo : (n > hi ? hi : n); }

  var GENDERS = ['男', '女', '其他', '不明'];
  var LOOKS = ['瘦高', '结实', '伤疤', '眼镜', '长发', '短发', '制服', '风衣', '义肢', '纹身', '旧伤', '工装'];
  var TRAITS = [
    { k: 'courage', label: '勇气' },
    { k: 'reason', label: '理性' },
    { k: 'empathy', label: '共情' },
    { k: 'discipline', label: '纪律' }
  ];
  var NAME_POOL = ['相马 辽', '九条 沙耶', '神谷 恒', '橘 千夏', '不破 凉介', '雾岛 澪', '的场 佑真', '白鸟 星'];
  var MODES = [
    { k: 'codex', label: '原著图鉴' },
    { k: 'gacha', label: '抽卡获得' },
    { k: 'custom', label: '原创自定义' }
  ];

  var S = null;
  var RIDER_INDEX = null;

  // 手动复制弹窗的常驻文案（照抄 05-v2-ux.md §5 文案总表）
  var HINT_SELECTED = '已全选 · 按 Ctrl + C 复制（Mac 按 ⌘ + C）';
  var HINT_LOST = '按 Ctrl + C 复制（Mac 按 ⌘ + C）；没选中就先点「全选」';
  // 45 × '─'，抬头与正文之间的分隔线
  var RULE = new Array(46).join('─');

  function riderIndex() {
    if (RIDER_INDEX) return RIDER_INDEX;
    RIDER_INDEX = {};
    var list = KR.RIDERS || [];
    for (var i = 0; i < list.length; i++) RIDER_INDEX[list[i].i] = list[i];
    return RIDER_INDEX;
  }

  function seriesName(s) {
    var arr = (KR.WORLD && KR.WORLD.series) || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].i === s) return arr[i].name;
    return '未归类';
  }

  function works() { return (KR.WORLD && KR.WORLD.works) || []; }

  function workById(id) {
    var list = works();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // 纪归属：取「起点年份 ≤ 作品年份」的最后一纪（range 有重叠，只靠起点判定）
  function eraStarts() {
    var tl = (KR.WORLD && KR.WORLD.timeline) || [];
    var out = [];
    for (var i = 0; i < tl.length; i++) {
      var m = /(\d{4})\s*[–\-~]\s*(\d{4})/.exec(String(tl[i].range || ''));
      out.push(m ? Number(m[1]) : 0);
    }
    return out;
  }

  function eraIndexOf(year) {
    var starts = eraStarts();
    var idx = -1;
    for (var i = 0; i < starts.length; i++) if (starts[i] && starts[i] <= year) idx = i;
    return idx;
  }

  function worksOfEra(idx) {
    var out = [];
    var list = works();
    for (var i = 0; i < list.length; i++) if (eraIndexOf(Number(list[i].year) || 0) === idx) out.push(list[i]);
    return out;
  }

  // ── 数值 ───────────────────────────────────────────────
  function humanStat(seedRec) {
    var base = Q().localStat('human', seedRec);
    var pow = clampNum(Math.round(base.pow * 0.62), 0, 100);
    var spd = clampNum(Math.round(base.spd * 0.9), 0, 100);
    var skl = clampNum(Math.round(base.skl * 1.08), 0, 100);
    var def = clampNum(Math.round(base.def * 0.66), 0, 100);
    var total = clampNum(Math.round(pow * 0.28 + spd * 0.24 + skl * 0.26 + def * 0.22), 0, 100);
    return {
      pow: pow, spd: spd, skl: skl, def: def,
      total: total, rank: Q().rankOf(total),
      bars: [{ k: '力', v: pow }, { k: '速', v: spd }, { k: '术', v: skl }, { k: '防', v: def }],
      note: '肉身参战，无装甲加成'
    };
  }

  function customStat(w) {
    var h = Q().hash32('orig|' + w.name + '|' + w.form + '|' + w.formCount);
    var wob = function (shift) { return ((h >>> shift) % 9) - 4; };
    var scale = clampNum(w.formCount, 1, 12);
    var lift = (scale - 1) * 1.4;
    var pow = clampNum(Math.round(26 + w.w.pow * 0.64 + lift + wob(0)), 0, 100);
    var spd = clampNum(Math.round(26 + w.w.spd * 0.64 + lift + wob(5)), 0, 100);
    var skl = clampNum(Math.round(26 + w.w.skl * 0.64 + lift + wob(11)), 0, 100);
    var def = clampNum(Math.round(26 + w.w.def * 0.64 + lift + wob(17)), 0, 100);
    var total = clampNum(Math.round(pow * 0.28 + spd * 0.24 + skl * 0.26 + def * 0.22), 0, 100);
    return {
      pow: pow, spd: spd, skl: skl, def: def,
      total: total, rank: Q().rankOf(total),
      bars: [{ k: '力', v: pow }, { k: '速', v: spd }, { k: '术', v: skl }, { k: '防', v: def }],
      note: '原创记录，权重自填'
    };
  }

  function pseudoRider() {
    var c = S.custom;
    var count = clampNum(c.formCount, 1, 12);
    var forms = [];
    for (var i = 0; i < count; i++) forms.push('O' + (i + 1));
    var record = {
      i: 'orig:' + c.name + '|' + c.form,
      n: c.name || '未命名骑士',
      j: c.name || '',
      name: c.form || '默认形态',
      formCount: count,
      forms: forms,
      belt: c.belt ? { i: '', n: c.belt } : null,
      bike: c.bike ? { i: '', n: c.bike } : null,
      items: [],
      tags: ['原创'],
      img: '',
      custom: true,
      weights: { pow: c.w.pow, spd: c.w.spd, skl: c.w.skl, def: c.w.def }
    };
    return record;
  }

  function currentAvatar() {
    if (S.noAvatar) return { mode: 'human', record: null, label: '人类身份', img: '', name: '不化身' };
    if (S.mode === 'codex') {
      var r = riderIndex()[S.riderId];
      return r
        ? { mode: 'rider', record: r, label: '原著图鉴', img: r.img, name: r.n }
        : { mode: 'rider', record: null, label: '原著图鉴', img: '', name: '' };
    }
    if (S.mode === 'gacha') {
      var g = riderIndex()[S.gachaId];
      return g
        ? { mode: 'rider', record: g, label: '抽卡获得', img: g.img, name: g.n }
        : { mode: 'rider', record: null, label: '抽卡获得', img: '', name: '' };
    }
    var rec = pseudoRider();
    return { mode: 'custom', record: rec, label: '原创', img: '', name: rec.n };
  }

  function currentStat() {
    var av = currentAvatar();
    if (av.mode === 'human') {
      return humanStat({ i: 'human|' + (S.name || 'x') + '|' + S.gender, n: S.name });
    }
    if (av.mode === 'custom') return customStat(S.custom);
    if (!av.record) return null;
    return Q().statOf('rider', av.record);
  }

  function currentWork() {
    if (S.eraIdx < 0 || !S.workId) return null;
    return workById(S.workId);
  }

  function cardData() {
    var av = currentAvatar();
    var st = currentStat();
    var w = currentWork();
    var tl = (KR.WORLD && KR.WORLD.timeline) || [];
    return {
      v: 1,
      bureau: 'KR-BUREAU',
      name: S.name,
      gender: S.gender,
      looks: S.looks.slice(),
      looksText: S.looksText,
      traits: {
        courage: S.traits.courage, reason: S.traits.reason,
        empathy: S.traits.empathy, discipline: S.traits.discipline
      },
      persona: S.personaText,
      avatar: {
        mode: S.noAvatar ? 'human' : S.mode,
        noAvatar: !!S.noAvatar,
        name: av.name,
        riderId: av.record ? String(av.record.i) : '',
        formName: S.mode === 'custom' && !S.noAvatar ? S.custom.form : '',
        formCount: S.mode === 'custom' && !S.noAvatar ? clampNum(S.custom.formCount, 1, 12) : (av.record && av.record.forms ? av.record.forms.length : 0),
        belt: S.mode === 'custom' && !S.noAvatar ? S.custom.belt : '',
        bike: S.mode === 'custom' && !S.noAvatar ? S.custom.bike : ''
      },
      timeline: {
        era: S.eraIdx >= 0 && tl[S.eraIdx] ? tl[S.eraIdx].era : '',
        eraRange: S.eraIdx >= 0 && tl[S.eraIdx] ? tl[S.eraIdx].range : '',
        workId: w ? w.id : '',
        workTitle: w ? w.title : '',
        stage: w ? w.stage : '',
        year: Number(S.year) || 0
      },
      aids: S.aids.map(function (id) {
        var c = charById(id);
        return c ? { i: c.i, n: c.n, p: c.p, series: seriesName(c.s) } : null;
      }).filter(Boolean),
      stat: st ? { pow: st.pow, spd: st.spd, skl: st.skl, def: st.def, total: st.total, rank: st.rank } : null,
      origin: S.src ? { work: S.src.work, stage: S.src.stage, no: S.src.no } : null
    };
  }

  var CHAR_INDEX = null;
  function charById(id) {
    if (!KR.IMG || !KR.IMG.chars) return null;
    if (!CHAR_INDEX) {
      CHAR_INDEX = {};
      for (var i = 0; i < KR.IMG.chars.length; i++) CHAR_INDEX[KR.IMG.chars[i].i] = KR.IMG.chars[i];
    }
    return CHAR_INDEX[id] || null;
  }

  // ── 小工具 ─────────────────────────────────────────────
  function field(label, node, hint) {
    var f = KRH('div.field', {}, KRH('label', { text: label }), node);
    if (hint) f.appendChild(KRH('div.field-hint', { text: hint }));
    return f;
  }

  function select(className, options, onChange) {
    var sel = KRH('select' + (className ? '.' + className : '.sel'), { onchange: onChange });
    for (var i = 0; i < options.length; i++) {
      sel.appendChild(KRH('option', { value: String(options[i].v) }, options[i].t));
    }
    return sel;
  }

  function stamp(text) {
    return KRH('span.crt-stamp', { text: text });
  }

  // ── 视图 ───────────────────────────────────────────────
  function resetState() {
    S = {
      name: NAME_POOL[0],
      nameIdx: 0,
      gender: '不明',
      looks: [],
      looksText: '',
      traits: { courage: 60, reason: 60, empathy: 60, discipline: 60 },
      personaText: '',
      noAvatar: false,
      mode: 'codex',
      riderId: (KR.RIDERS && KR.RIDERS.length) ? KR.RIDERS[0].i : '',
      gachaId: '',
      custom: {
        name: '', form: '', formCount: 3,
        w: { pow: 55, spd: 55, skl: 55, def: 55 },
        belt: '', bike: ''
      },
      eraIdx: -1,
      workId: '',
      year: 0,
      aids: [],
      src: null,
      portraitPath: '',
      query: { rider: '', era: '', series: '', page: 0, char: '', charPage: 0 },
      ready: false
    };
  }

  function mount(el, ctx) {
    resetState();
    el.setAttribute('data-own', 'create');

    if (!KR.quest) {
      el.appendChild(KRH('section.panel.panel--quiet', {},
        KRH('div.panel-hd', {}, KRH('h2', { text: '创造角色' })),
        KRH('div.panel-bd', {}, KRH('div.empty', {},
          KRH('b', { text: '数值基座缺失' }),
          KRH('span', { text: 'views/map.js 未先加载，KR.quest 不存在。' })
        ))
      ));
      return;
    }

    var lede = KRH('p.crt-lede', {
      text: '四项归档：身份、化身、时间线、援助位。右侧是实时角色卡，底栏可以把整份设定复制走。'
    });
    var srcBar = KRH('div.crt-src');
    srcBar.setAttribute('hidden', '');

    var form = KRH('div.crt-form');
    var side = KRH('div.crt-side');
    var card = KRH('aside.crt-card.panel');
    side.appendChild(card);

    var body = KRH('div.crt-body', {}, form, side);
    el.appendChild(KRH('section.crt', {},
      KRH('header.crt-head', {},
        KRH('div.t-eyebrow', { text: 'BUREAU · DOSSIER' }),
        KRH('h1.t-h1', { text: '创造角色' }),
        lede,
        srcBar
      ),
      body
    ));

    // ── 01 身份 ──────────────────────────────────────────
    var sec1 = KRH('section.crt-sec.panel.panel--quiet');
    sec1.appendChild(KRH('div.crt-sec-hd', {},
      KRH('span.crt-sec-no', { text: '01' }),
      KRH('h2', { text: '身份' }),
      stamp('IDENTITY')
    ));
    var bd1 = KRH('div.crt-sec-bd');

    var nameIpt = KRH('input.ipt', {
      type: 'text', maxlength: '24', value: S.name, 'aria-label': '姓名',
      oninput: function (ev) { S.name = ev.target.value; paintCard(); }
    });
    var nameRow = KRH('div.crt-inline', {}, nameIpt,
      KRH('button.btn.btn-ghost.btn-sm', {
        type: 'button',
        onclick: function () {
          S.nameIdx = (S.nameIdx + 1) % NAME_POOL.length;
          S.name = NAME_POOL[S.nameIdx];
          nameIpt.value = S.name;
          paintCard();
        }
      }, '换一个')
    );
    bd1.appendChild(field('姓名', nameRow, '默认给一个可用名，可直接改写'));

    var genderRow = KRH('div.crt-seg', { role: 'group', 'aria-label': '性别' });
    for (var gi = 0; gi < GENDERS.length; gi++) {
      (function (g) {
        genderRow.appendChild(KRH('button.crt-seg-btn' + (g === S.gender ? '.is-on' : ''), {
          type: 'button', 'data-gender': g,
          onclick: function () {
            S.gender = g;
            var btns = KRD.qa('.crt-seg-btn', genderRow);
            for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('is-on', btns[i].getAttribute('data-gender') === g);
            paintCard();
          }
        }, g));
      })(GENDERS[gi]);
    }
    bd1.appendChild(field('性别', genderRow));

    var lookTags = KRH('div.tags.crt-chips');
    for (var li = 0; li < LOOKS.length; li++) {
      (function (look) {
        lookTags.appendChild(KRH('button.tag.tag--dim.crt-chip', {
          type: 'button', 'data-look': look,
          onclick: function () {
            var at = S.looks.indexOf(look);
            if (at >= 0) S.looks.splice(at, 1); else S.looks.push(look);
            this.classList.toggle('is-on', S.looks.indexOf(look) >= 0);
            paintCard();
          }
        }, look));
      })(LOOKS[li]);
    }
    bd1.appendChild(field('外貌倾向', lookTags, '可多选'));

    var looksTxa = KRH('textarea.txa', {
      rows: '3', placeholder: '制服外套袖口磨白；左手无名指缺一截；说话时习惯摸耳后。',
      oninput: function (ev) { S.looksText = ev.target.value; paintCard(); }
    });
    bd1.appendChild(field('外貌描述', looksTxa));

    var traitWrap = KRH('div.crt-axes');
    for (var ti = 0; ti < TRAITS.length; ti++) {
      (function (t) {
        var out = KRH('span.crt-axis-v.tnum', { text: String(S.traits[t.k]) });
        var range = KRH('input.crt-range', {
          type: 'range', min: '0', max: '100', step: '1', value: String(S.traits[t.k]),
          'data-axis': t.k, 'aria-label': t.label,
          oninput: function (ev) {
            S.traits[t.k] = clampNum(ev.target.value, 0, 100);
            out.textContent = String(S.traits[t.k]);
            paintCard();
          }
        });
        traitWrap.appendChild(KRH('div.crt-axis', {},
          KRH('span.crt-axis-k', { text: t.label }),
          range,
          out
        ));
      })(TRAITS[ti]);
    }
    bd1.appendChild(field('性格四轴', traitWrap, '勇气 / 理性 / 共情 / 纪律'));

    var personaTxa = KRH('textarea.txa', {
      rows: '3', placeholder: '话少，先看出口再看人。不信组织，但会替人挡一次。',
      oninput: function (ev) { S.personaText = ev.target.value; paintCard(); }
    });
    bd1.appendChild(field('性格描述', personaTxa));

    sec1.appendChild(bd1);
    form.appendChild(sec1);

    // ── 02 化身骑士 ──────────────────────────────────────
    var sec2 = KRH('section.crt-sec.panel.panel--quiet');
    sec2.appendChild(KRH('div.crt-sec-hd', {},
      KRH('span.crt-sec-no', { text: '02' }),
      KRH('h2', { text: '化身骑士' }),
      stamp('AVATAR')
    ));
    var bd2 = KRH('div.crt-sec-bd');

    var sw = KRH('label.check.crt-switch', {},
      KRH('input', {
        type: 'checkbox',
        onchange: function (ev) {
          S.noAvatar = !!ev.target.checked;
          bd2.classList.toggle('is-human', S.noAvatar);
          syncAvatarEnabled();
          paintCard();
        }
      }),
      KRH('span', { text: '不化身，以人类身份进入' })
    );
    bd2.appendChild(sw);

    var tabs = KRH('div.crt-tabs', { role: 'tablist', 'aria-label': '化身来源' });
    for (var mi = 0; mi < MODES.length; mi++) {
      (function (m) {
        tabs.appendChild(KRH('button.crt-tab' + (m.k === S.mode ? '.is-on' : ''), {
          type: 'button', 'data-mode': m.k, role: 'tab'
        }, m.label));
      })(MODES[mi]);
    }
    bd2.appendChild(tabs);

    // pane: 原著图鉴
    var paneCodex = KRH('div.crt-pane', { 'data-pane': 'codex' });
    var qInput = KRH('input.ipt', {
      type: 'search', placeholder: '搜骑士名 / 原名 / 系列（例：空我、Agito、昭和）',
      oninput: function (ev) {
        S.query.rider = ev.target.value;
        S.query.page = 0;
        paintRiderList();
      }
    });
    var eraSel = select('sel', buildEraOptions(), function (ev) {
      S.query.era = ev.target.value;
      S.query.page = 0;
      paintRiderList();
    });
    var seriesSel = select('sel', buildSeriesOptions(), function (ev) {
      S.query.series = ev.target.value;
      S.query.page = 0;
      paintRiderList();
    });
    paneCodex.appendChild(KRH('div.crt-filters', {}, qInput, eraSel, seriesSel));
    var riderList = KRH('div.crt-list');
    var riderMore = KRH('button.btn.btn-ghost.btn-sm.crt-more', {
      type: 'button',
      onclick: function () { S.query.page += 1; paintRiderList(); }
    }, '载入更多');
    paneCodex.appendChild(riderList);
    paneCodex.appendChild(riderMore);
    bd2.appendChild(paneCodex);

    // pane: 抽卡
    var paneGacha = KRH('div.crt-pane', { 'data-pane': 'gacha' });
    bd2.appendChild(paneGacha);

    // pane: 原创
    var paneCustom = KRH('div.crt-pane', { 'data-pane': 'custom' });
    var cName = KRH('input.ipt', {
      type: 'text', maxlength: '20', placeholder: '例：铠装 零', 'aria-label': '骑士名',
      oninput: function (ev) { S.custom.name = ev.target.value; paintCard(); }
    });
    var cForm = KRH('input.ipt', {
      type: 'text', maxlength: '16', placeholder: '例：初装 / 苍蓝 / 终式', 'aria-label': '形态名',
      oninput: function (ev) { S.custom.form = ev.target.value; paintCard(); }
    });
    var cCount = KRH('input.ipt.tnum', {
      type: 'number', min: '1', max: '12', step: '1', value: '3', 'aria-label': '形态数',
      oninput: function (ev) {
        S.custom.formCount = clampNum(ev.target.value, 1, 12);
        paintCard();
      }
    });
    var cBelt = KRH('input.ipt', {
      type: 'text', maxlength: '16', placeholder: '例：零式驱动器', 'aria-label': '变身器名',
      oninput: function (ev) { S.custom.belt = ev.target.value; paintCard(); }
    });
    var cBike = KRH('input.ipt', {
      type: 'text', maxlength: '16', placeholder: '例：飓风 零号', 'aria-label': '摩托车名',
      oninput: function (ev) { S.custom.bike = ev.target.value; paintCard(); }
    });

    var wWrap = KRH('div.crt-axes');
    var WEIGHTS = [
      { k: 'pow', label: '力' }, { k: 'spd', label: '速' },
      { k: 'skl', label: '术' }, { k: 'def', label: '防' }
    ];
    for (var wi = 0; wi < WEIGHTS.length; wi++) {
      (function (w) {
        var out = KRH('span.crt-axis-v.tnum', { text: String(S.custom.w[w.k]) });
        var range = KRH('input.crt-range', {
          type: 'range', min: '0', max: '100', step: '1', value: String(S.custom.w[w.k]),
          'data-weight': w.k, 'aria-label': w.label,
          oninput: function (ev) {
            S.custom.w[w.k] = clampNum(ev.target.value, 0, 100);
            out.textContent = String(S.custom.w[w.k]);
            paintCard();
          }
        });
        wWrap.appendChild(KRH('div.crt-axis', {},
          KRH('span.crt-axis-k', { text: w.label }), range, out
        ));
      })(WEIGHTS[wi]);
    }

    paneCustom.appendChild(KRH('div.crt-grid2', {},
      field('骑士名', cName),
      field('形态名', cForm),
      field('形态数', cCount),
      field('变身器', cBelt),
      field('摩托车', cBike)
    ));
    paneCustom.appendChild(field('能力倾向（力 / 速 / 术 / 防）', wWrap, '权重直接决定数值条，确定性换算'));
    paneCustom.appendChild(KRH('p.crt-hint', {
      text: '原创记录不写图片位，立绘位显示「原创」水印；数值由权重与形态数确定性算出，同一个名字每次结果一致。'
    }));
    bd2.appendChild(paneCustom);

    sec2.appendChild(bd2);
    form.appendChild(sec2);

    // ── 03 原著时间线 ────────────────────────────────────
    var sec3 = KRH('section.crt-sec.panel.panel--quiet');
    sec3.appendChild(KRH('div.crt-sec-hd', {},
      KRH('span.crt-sec-no', { text: '03' }),
      KRH('h2', { text: '原著时间线' }),
      stamp('TIMELINE')
    ));
    var bd3 = KRH('div.crt-sec-bd');

    var eraSel3 = select('sel', buildEraTimelineOptions(), function (ev) {
      S.eraIdx = Number(ev.target.value);
      var list = worksOfEra(S.eraIdx);
      S.workId = list.length ? list[0].id : '';
      S.year = list.length ? Number(list[0].year) || 0 : 0;
      paintWorks();
      paintExcerpt();
      paintCard();
    });
    var workSel3 = select('sel', [], function (ev) {
      S.workId = ev.target.value;
      var w = workById(S.workId);
      S.year = w ? Number(w.year) || 0 : 0;
      paintYear();
      paintCard();
    });
    var yearOut = KRH('span.crt-year-v.tnum', { text: '—' });
    var yearBox = KRH('div.crt-year', {},
      KRH('button.btn.btn-ghost.btn-ico', {
        type: 'button', 'aria-label': '年份 -1',
        onclick: function () { S.year = (Number(S.year) || 0) - 1; paintYear(); paintCard(); }
      }, '−'),
      yearOut,
      KRH('button.btn.btn-ghost.btn-ico', {
        type: 'button', 'aria-label': '年份 +1',
        onclick: function () { S.year = (Number(S.year) || 0) + 1; paintYear(); paintCard(); }
      }, '＋')
    );

    var cascade = KRH('div.crt-grid3', {},
      field('纪', eraSel3),
      field('作品', workSel3),
      field('年份', yearBox, '可在作品年份上 ±1 微调')
    );
    var excerpt = KRH('div.crt-excerpt', {});
    bd3.appendChild(KRH('div.crt-tl', {}, cascade, excerpt));
    sec3.appendChild(bd3);
    form.appendChild(sec3);

    // ── 04 援助角色 ──────────────────────────────────────
    var sec4 = KRH('section.crt-sec.panel.panel--quiet');
    sec4.appendChild(KRH('div.crt-sec-hd', {},
      KRH('span.crt-sec-no', { text: '04' }),
      KRH('h2', { text: '援助角色' }),
      stamp('SUPPORT')
    ));
    var bd4 = KRH('div.crt-sec-bd');
    var aidPicked = KRH('div.crt-aids');
    var aidInput = KRH('input.ipt', {
      type: 'search', placeholder: '搜 4038 位人物：本乡猛、一条薰、雾子…',
      disabled: false,
      oninput: KRD.debounce(function (ev) {
        S.query.char = ev.target.value;
        S.query.charPage = 0;
        paintCharList();
      }, 140)
    });
    var aidList = KRH('div.crt-list.crt-list--chars');
    var aidMore = KRH('button.btn.btn-ghost.btn-sm.crt-more', {
      type: 'button',
      onclick: function () { S.query.charPage += 1; paintCharList(); }
    }, '载入更多');
    bd4.appendChild(field('从人物库选（最多 3 位）', aidInput, '按需加载 data/img-chars.js'));
    bd4.appendChild(aidPicked);
    bd4.appendChild(aidList);
    bd4.appendChild(aidMore);
    sec4.appendChild(bd4);
    form.appendChild(sec4);

    // ── 角色卡 ───────────────────────────────────────────
    card.appendChild(KRH('div.crt-card-hd', {},
      KRH('span.crt-card-k', { text: 'KR-BUREAU' }),
      KRH('span.crt-card-n', { text: '档案 / 角色卡' })
    ));
    // 立绘走 base.css 的 .plate：暗底 + 底光 + 金细框 + 径向溶解，浅底官方照不再糊成一片白
    var portrait = KRH('div.crt-portrait.plate');
    var portraitImg = KRH('img.crt-portrait-img', { alt: '' });
    var capK = KRH('span.crt-cap-k', { text: '来源' });
    var capV = KRH('span.crt-cap-v', { text: '未选化身' });
    portrait.appendChild(portraitImg);
    portrait.appendChild(KRH('span.crt-portrait-mask'));
    portrait.appendChild(KRH('span.crt-orig', { text: '原创' }));
    portrait.appendChild(KRH('div.plate-cap', {}, capK, capV));
    card.appendChild(portrait);

    var cardName = KRH('div.crt-card-name', {});
    var cardMeta = KRH('div.crt-card-meta');
    var cardBars = KRH('div.bars.crt-bars');
    var cardRank = KRH('div.crt-card-rank');
    var cardSum = KRH('dl.crt-sum');
    var cardFt = KRH('div.crt-card-ft', {},
      KRH('button.btn.btn-gold.btn-block', {
        type: 'button', 'data-act': 'copy-all'
      }, '复制全部设定'),
      KRH('div.crt-card-row', {},
        // 底栏只剩两个复制：不再提供手动存档入口（存档能力仍在 gacha 侧 + boot 的 KR.restore()）
        KRH('button.btn.btn-ghost.btn-sm', { type: 'button', 'data-act': 'copy-json' }, '复制 JSON')
      )
    );
    card.appendChild(KRH('div.crt-card-bd', {}, cardName, cardMeta, cardBars, cardRank, cardSum));
    card.appendChild(cardFt);

    // ── 渲染 ─────────────────────────────────────────────
    function buildEraOptions() {
      return [
        { v: '', t: '全部时代' }, { v: '昭和', t: '昭和' }, { v: '平成', t: '平成' },
        { v: '令和', t: '令和' }, { v: '未归类', t: '未归类' }
      ];
    }

    function buildSeriesOptions() {
      var out = [{ v: '', t: '全部系列（43）' }];
      var list = (KR.WORLD && KR.WORLD.series) || [];
      for (var i = 0; i < list.length; i++) out.push({ v: String(list[i].i), t: list[i].name });
      return out;
    }

    function buildEraTimelineOptions() {
      var out = [{ v: '-1', t: '未选择' }];
      var tl = (KR.WORLD && KR.WORLD.timeline) || [];
      for (var i = 0; i < tl.length; i++) out.push({ v: String(i), t: tl[i].era + '（' + tl[i].range + '）' });
      return out;
    }

    function filteredRiders() {
      var list = KR.RIDERS || [];
      var kw = String(S.query.rider || '').trim().toLowerCase();
      var era = S.query.era;
      var ser = S.query.series;
      return list.filter(function (r) {
        if (era && r.e !== era) return false;
        if (ser !== '' && String(r.s) !== ser) return false;
        if (!kw) return true;
        var hay = (r.n + ' ' + (r.j || '') + ' ' + (r.work || '') + ' ' + seriesName(r.s)).toLowerCase();
        return hay.indexOf(kw) >= 0;
      });
    }

    var PAGE_RIDER = 60;
    var PAGE_CHAR = 24;

    function paintRiderList() {
      var list = filteredRiders();
      var shown = Math.min(list.length, (S.query.page + 1) * PAGE_RIDER);
      KRD.clear(riderList);
      if (!list.length) {
        riderList.appendChild(KRH('div.empty', {}, KRH('b', { text: '没有匹配的骑士' }), KRH('span', { text: '换个关键词，或把时代/系列重置回「全部」。' })));
        riderMore.setAttribute('hidden', '');
        return;
      }
      for (var i = 0; i < shown; i++) {
        (function (r) {
          var st = Q().statOf('rider', r);
          var row = KRH('button.crt-item' + (r.i === S.riderId ? '.is-on' : ''), {
            type: 'button', 'data-rid': r.i
          },
            KRH('img.crt-item-img', { 'data-kr-img': r.img, 'data-kr-thumb': '1', alt: r.n }),
            KRH('span.crt-item-t', {},
              KRH('b', { text: r.n }),
              KRH('i', { text: seriesName(r.s) + ' · ' + (r.y || '—') + ' · 形态 ' + (r.forms ? r.forms.length : 0) })
            ),
            KRH('span.rank' + (Q().rankIndex(st.rank) >= 6 ? '.rank--max' : (Q().rankIndex(st.rank) >= 4 ? '.rank--hi' : '')), { text: st.rank })
          );
          riderList.appendChild(row);
        })(list[i]);
      }
      if (shown >= list.length) riderMore.setAttribute('hidden', '');
      else riderMore.removeAttribute('hidden');
      if (KRIMG) KRIMG.observe(riderList);
    }

    function paintGachaPane() {
      KRD.clear(paneGacha);
      var mine = (KR.state && KR.state.myRiders) || [];
      var idx = riderIndex();
      var owned = [];
      for (var i = 0; i < mine.length; i++) if (idx[mine[i].i]) owned.push(idx[mine[i].i]);
      if (!owned.length) {
        paneGacha.appendChild(KRH('div.empty', {},
          KRH('b', { text: '还没有抽到的骑士' }),
          KRH('span', { text: '去抽卡页抽一次，这里就会列出可化身对象。' }),
          KRH('button.btn.btn-ghost.btn-sm', {
            type: 'button', onclick: function () { KR.go('/gacha'); }
          }, '去抽卡')
        ));
        return;
      }
      var list = KRH('div.crt-list');
      for (var j = 0; j < owned.length; j++) {
        (function (r) {
          var st = Q().statOf('rider', r);
          list.appendChild(KRH('button.crt-item' + (r.i === S.gachaId ? '.is-on' : ''), {
            type: 'button', 'data-gid': r.i
          },
            KRH('img.crt-item-img', { 'data-kr-img': r.img, 'data-kr-thumb': '1', alt: r.n }),
            KRH('span.crt-item-t', {},
              KRH('b', { text: r.n }),
              KRH('i', { text: seriesName(r.s) + ' · 形态 ' + (r.forms ? r.forms.length : 0) })
            ),
            KRH('span.rank', { text: st.rank })
          ));
        })(owned[j]);
      }
      paneGacha.appendChild(list);
      if (KRIMG) KRIMG.observe(list);
    }

    function paintWorks() {
      KRD.clear(workSel3);
      var list = S.eraIdx >= 0 ? worksOfEra(S.eraIdx) : [];
      if (!S.workId && list.length) S.workId = list[0].id;
      for (var i = 0; i < list.length; i++) {
        workSel3.appendChild(KRH('option', { value: list[i].id }, list[i].no + ' ' + list[i].title + '（' + list[i].year + '）'));
      }
      workSel3.value = S.workId || '';
      var w = workById(S.workId);
      if (w) S.year = Number(w.year) || 0;
      paintYear();
    }

    function paintYear() {
      yearOut.textContent = S.year ? String(S.year) : '—';
    }

    function paintExcerpt() {
      KRD.clear(excerpt);
      var tl = (KR.WORLD && KR.WORLD.timeline) || [];
      var t = S.eraIdx >= 0 ? tl[S.eraIdx] : null;
      if (!t) {
        excerpt.appendChild(KRH('div.empty', {}, KRH('b', { text: '未选择纪' }), KRH('span', { text: '选定纪之后，这里显示该纪统合年表原文。' })));
        return;
      }
      excerpt.appendChild(KRH('div.crt-ex-hd', {},
        KRH('span.crt-ex-era', { text: t.era }),
        KRH('span.crt-ex-range.tnum', { text: t.range })
      ));
      excerpt.appendChild(KRH('pre.crt-ex-body', { text: t.text || '' }));
    }

    function paintAids() {
      KRD.clear(aidPicked);
      if (!S.aids.length) {
        aidPicked.appendChild(KRH('span.crt-aids-empty', { text: '未选援助位（0 / 3）' }));
        return;
      }
      for (var i = 0; i < S.aids.length; i++) {
        (function (id, n) {
          var c = charById(id);
          aidPicked.appendChild(KRH('span.crt-aid', {},
            c ? KRH('img.crt-aid-img', { 'data-kr-img': c.p, 'data-kr-thumb': '1', alt: c.n }) : null,
            KRH('span.crt-aid-n', { text: c ? c.n : id }),
            KRH('button.crt-aid-x', {
              type: 'button', 'aria-label': '移除',
              onclick: function () { S.aids.splice(n, 1); paintAids(); paintCharList(); paintCard(); }
            }, '×')
          ));
        })(S.aids[i], i);
      }
      if (KRIMG) KRIMG.observe(aidPicked);
    }

    function paintCharList() {
      KRD.clear(aidList);
      if (!KR.IMG || !KR.IMG.chars) {
        aidList.appendChild(KRH('div.crt-loading', {},
          KRH('span.skel', { style: { width: '100%', height: '44px' } }),
          KRH('span.crt-loading-t', { text: '读取人物库 data/img-chars.js（4038 条）…' })
        ));
        if (KR.load) {
          KR.load('data/img-chars.js').then(function () { S.ready = true; paintCharList(); }, function (e) {
            KRD.clear(aidList);
            aidList.appendChild(KRH('div.empty', {},
              KRH('b', { text: '人物库未载入' }),
              KRH('span', { text: 'data/img-chars.js 加载失败，援助位暂不可用（其余功能不受影响）。' })
            ));
            if (KR.report) KR.report('char load', e);
          });
        }
        return;
      }
      var kw = String(S.query.char || '').trim().toLowerCase();
      var all = KR.IMG.chars.filter(function (c) {
        if (!kw) return true;
        return (c.n + ' ' + c.j).toLowerCase().indexOf(kw) >= 0;
      });
      var shown = Math.min(all.length, (S.query.charPage + 1) * PAGE_CHAR);
      if (!all.length) {
        aidList.appendChild(KRH('div.empty', {}, KRH('b', { text: '没有匹配的人物' }), KRH('span', { text: '试试角色原名或缩短关键词。' })));
        aidMore.setAttribute('hidden', '');
        return;
      }
      for (var i = 0; i < shown; i++) {
        (function (c) {
          var picked = S.aids.indexOf(c.i) >= 0;
          aidList.appendChild(KRH('button.crt-item.crt-item--char' + (picked ? '.is-on' : ''), {
            type: 'button', 'data-cid': c.i, disabled: picked && S.aids.length >= 3
          },
            KRH('img.crt-item-img.crt-item-img--char', { 'data-kr-img': c.p, 'data-kr-thumb': '1', alt: c.n }),
            KRH('span.crt-item-t', {},
              KRH('b', { text: c.n }),
              KRH('i', { text: seriesName(c.s) + ' · ' + (c.y || '—') })
            ),
            KRH('span.crt-item-flag', { text: picked ? '已选' : '' })
          ));
        })(all[i]);
      }
      if (shown >= all.length) aidMore.setAttribute('hidden', '');
      else aidMore.removeAttribute('hidden');
      if (KRIMG) KRIMG.observe(aidList);
    }

    function paintCard() {
      var av = currentAvatar();
      var st = currentStat();

      var wantImg = av.img || '';
      if (S.portraitPath !== wantImg) {
        S.portraitPath = wantImg;
        portraitImg.removeAttribute('data-krimg-bound');
        if (wantImg) {
          portraitImg.removeAttribute('data-failed');
          portraitImg.setAttribute('data-kr-img', wantImg);
          portraitImg.setAttribute('alt', av.name || '');
          if (KRIMG) KRIMG.attach(portraitImg, wantImg, { alt: av.name || '' });
        } else {
          portraitImg.removeAttribute('data-kr-img');
          portraitImg.setAttribute('data-failed', '1');
          portraitImg.setAttribute('src', KRIMG ? KRIMG.placeholder('rider') : '');
        }
      }
      portrait.classList.toggle('is-orig', av.mode === 'custom');
      portrait.classList.toggle('is-human', av.mode === 'human');
      capK.textContent = S.noAvatar ? '人类身份'
        : (av.mode === 'custom' ? '原创' : (S.mode === 'gacha' ? '抽卡获得' : '原著'));
      capV.textContent = S.noAvatar ? '不化身' : (av.name || '未选化身');

      KRD.clear(cardName);
      cardName.appendChild(KRH('b', { text: S.name || '未命名' }));
      cardName.appendChild(KRH('span.crt-card-gender', { text: S.gender }));
      if (!S.noAvatar && av.name) cardName.appendChild(KRH('span.crt-card-av', { text: av.name }));

      KRD.clear(cardMeta);
      var w = currentWork();
      var tl = (KR.WORLD && KR.WORLD.timeline) || [];
      var met = [];
      if (S.eraIdx >= 0 && tl[S.eraIdx]) met.push(tl[S.eraIdx].era);
      if (w) met.push(w.title + '（' + (Number(S.year) || w.year) + '）');
      if (!met.length) met.push('未选时间线');
      cardMeta.textContent = met.join(' · ');

      KRD.clear(cardBars);
      if (st) {
        for (var i = 0; i < st.bars.length; i++) {
          var b = st.bars[i];
          cardBars.appendChild(KRH('div.bar-row', {},
            KRH('span.bar-k', { text: b.k }),
            KRH('div.bar-track', {}, KRH('div.bar-fill', { style: { '--v': String(b.v) } })),
            KRH('span.bar-v', { text: String(b.v) })
          ));
        }
      }

      KRD.clear(cardRank);
      if (st) {
        var ri = Q().rankIndex(st.rank);
        cardRank.appendChild(KRH('span.rank' + (ri >= 6 ? '.rank--max' : (ri >= 4 ? '.rank--hi' : '')), { text: st.rank }));
        cardRank.appendChild(KRH('span.crt-rank-total.tnum', { text: '总评 ' + st.total }));
        cardRank.appendChild(KRH('span.crt-rank-note', { text: st.note }));
      } else {
        cardRank.appendChild(KRH('span.crt-rank-note', { text: '选择化身骑士后生成数值' }));
      }

      KRD.clear(cardSum);
      function sumRow(k, v) {
        cardSum.appendChild(KRH('div.crt-sum-row', {},
          KRH('dt', { text: k }),
          KRH('dd', { text: v || '—' })
        ));
      }
      sumRow('化身', S.noAvatar ? '人类（不化身）' : (av.name || '未选'));
      sumRow('来源', S.noAvatar ? '禁用化身区' : av.label);
      sumRow('时代', S.eraIdx >= 0 && tl[S.eraIdx] ? tl[S.eraIdx].era : '未选');
      sumRow('作品', w ? w.title : '未选');
      sumRow('舞台', w ? w.stage : '未选');
      sumRow('援助', S.aids.length ? S.aids.length + ' / 3' : '0');
      sumRow('外貌', (S.looks.length ? S.looks.join('、') : '未标注') + (S.looksText ? '；' + S.looksText : ''));
    }

    function syncAvatarEnabled() {
      var panes = KRD.qa('.crt-pane', bd2);
      var TAGS = ['input', 'select', 'textarea', 'button'];
      for (var i = 0; i < panes.length; i++) {
        for (var t = 0; t < TAGS.length; t++) {
          var ctls = panes[i].querySelectorAll(TAGS[t]);
          for (var j = 0; j < ctls.length; j++) ctls[j].disabled = S.noAvatar;
        }
      }
      var tabsBtns = KRD.qa('.crt-tab', tabs);
      for (var k = 0; k < tabsBtns.length; k++) tabsBtns[k].disabled = S.noAvatar;
    }

    function paintPanes() {
      var panes = KRD.qa('.crt-pane', bd2);
      for (var i = 0; i < panes.length; i++) {
        panes[i].classList.toggle('is-on', panes[i].getAttribute('data-pane') === S.mode);
      }
      var tabsBtns = KRD.qa('.crt-tab', tabs);
      for (var k = 0; k < tabsBtns.length; k++) {
        var on = tabsBtns[k].getAttribute('data-mode') === S.mode;
        tabsBtns[k].classList.toggle('is-on', on);
        tabsBtns[k].setAttribute('aria-selected', on ? 'true' : 'false');
      }
    }

    // ── 事件：列表选择 ───────────────────────────────────
    KRD.on(tabs, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-mode]') : null;
      if (!btn || S.noAvatar) return;
      S.mode = btn.getAttribute('data-mode');
      paintPanes();
      paintCard();
    });

    KRD.on(paneCodex, 'click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('[data-rid]') : null;
      if (!row) return;
      S.riderId = row.getAttribute('data-rid');
      var rows = KRD.qa('.crt-item', riderList);
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-on', rows[i].getAttribute('data-rid') === S.riderId);
      paintCard();
    });

    KRD.on(paneGacha, 'click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('[data-gid]') : null;
      if (!row) return;
      S.gachaId = row.getAttribute('data-gid');
      var rows = KRD.qa('.crt-item', paneGacha);
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-on', rows[i].getAttribute('data-gid') === S.gachaId);
      paintCard();
    });

    KRD.on(aidList, 'click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('[data-cid]') : null;
      if (!row) return;
      var id = row.getAttribute('data-cid');
      var at = S.aids.indexOf(id);
      if (at >= 0) S.aids.splice(at, 1);
      else if (S.aids.length < 3) S.aids.push(id);
      else { if (KR.toast) KR.toast('援助位只留 3 个', 'warn'); return; }
      paintAids();
      paintCharList();
      paintCard();
    });

    // ── 角色卡动作：全部走手动复制弹窗，不碰剪贴板 API ────
    // 设定文本只装用户填写的字段：身份 → 化身 → 时间线 → 援助。派生的数值与评级不进文本。
    // 缺省三态：不适用整行省略 / 适用但空着写「未填｜未选」/ 有默认值直接写值。
    function dash(v, fallback) {
      var s = String(v == null ? '' : v).replace(/\s+$/, '').replace(/^\s+/, '');
      return s || (fallback || '未填');
    }

    function modeLabel(mode) {
      if (mode === 'gacha') return '抽卡获得';
      if (mode === 'custom') return '原创自定义';
      return '原著图鉴';
    }

    function setText() {
      var av = currentAvatar();
      // 不读 KR.stat：数值/评级是引擎算出来的，不属于「用户填写的设定」（05 §2.3 末）
      var w = currentWork();
      var tl = (KR.WORLD && KR.WORLD.timeline) || [];
      var t = S.eraIdx >= 0 ? tl[S.eraIdx] : null;
      var L = [];

      L.push('假面骑士 · 角色档案');
      L.push(RULE);

      L.push('【身份】');
      L.push('姓名：' + dash(S.name));
      L.push('性别：' + dash(S.gender, '不明'));
      L.push('外貌倾向：' + (S.looks.length ? S.looks.join('、') : '未选'));
      L.push('外貌描述：' + dash(S.looksText));
      L.push('性格四轴：勇气 ' + S.traits.courage + ' / 理性 ' + S.traits.reason +
        ' / 共情 ' + S.traits.empathy + ' / 纪律 ' + S.traits.discipline);
      L.push('性格描述：' + dash(S.personaText));

      L.push('');
      L.push('【化身】');
      if (S.noAvatar) {
        L.push('化身方式：不化身 · 人类身份');
      } else {
        L.push('化身方式：化身骑士');
        L.push('化身来源：' + modeLabel(S.mode));
        // 原创走 S.custom.name（空则「未选」）；原著 / 抽卡走解析后的骑士名
        L.push('化身骑士：' + (S.mode === 'custom' ? dash(S.custom.name, '未选') : dash(av.name, '未选')));
        if (S.mode === 'custom') {
          L.push('形态名：' + dash(S.custom.form));
          L.push('形态数：' + clampNum(S.custom.formCount, 1, 12));
          L.push('变身器：' + dash(S.custom.belt));
          L.push('摩托车：' + dash(S.custom.bike));
          L.push('能力倾向：力 ' + S.custom.w.pow + ' / 速 ' + S.custom.w.spd +
            ' / 术 ' + S.custom.w.skl + ' / 防 ' + S.custom.w.def);
        }
      }

      L.push('');
      L.push('【时间线】');
      L.push('纪：' + (t ? (t.era + ' ' + t.range) : '未选'));
      L.push('作品：' + (w ? (Q().pad2(w.no) + ' ' + w.title + '（' + (Number(S.year) || w.year) + '）') : '未选'));
      L.push('年份：' + (Number(S.year) ? String(S.year) : '未选'));
      L.push('舞台：' + (w && w.stage ? String(w.stage) : '未选'));
      if (S.src) {
        L.push('来源地点：' + S.src.work + ' · ' + S.src.stage + ' · 节点 ' + Q().pad2(S.src.no));
      }

      L.push('');
      L.push('【援助】');
      var names = [];
      for (var i = 0; i < S.aids.length; i++) {
        var c = charById(S.aids[i]);
        names.push(c ? c.n : S.aids[i]);
      }
      L.push('援助（' + names.length + '/3）：' + (names.length ? names.join('、') : '未选'));

      return L.join('\n');
    }

    function jsonText() { return JSON.stringify(cardData(), null, 2); }

    // 手动复制弹窗：readonly textarea + 打开即全选 + 常驻「全选」。
    // 不做自动复制、不调任何剪贴板 API —— 点完没反应的失败体验比不给按钮更糟。
    function showCopyModal(cfg) {
      var text = String(cfg.text == null ? '' : cfg.text);
      var ready = text.length > 0;
      if (!ready) text = '档案未就绪';

      var hint = KRH('p.crt-hint.crt-copy-hint', {
        id: 'crt-copy-hint', role: 'status', 'aria-live': 'polite',
        text: ready ? cfg.hint : '档案未就绪 · 关掉这个窗口，等页面加载完再试。'
      });

      var note = cfg.note
        ? KRH('p.crt-copy-note', { text: cfg.note })
        : null;

      var allBtn = KRH('button.btn.btn-ghost.btn-sm.crt-copy-all', { type: 'button' }, '全选');
      var selTag = KRH('span.crt-copy-sel');
      var countTag = KRH('span.crt-copy-n', {
        text: text.split('\n').length + ' 行 · ' + text.length + ' 字'
      });

      // readonly 而不是 disabled：disabled 不可聚焦、不可选中，整个方案失效
      var txa = KRH('textarea.crt-copy-txa' + (cfg.mono ? '.crt-copy-txa--mono' : ''), {
        readonly: true, spellcheck: 'false',
        'aria-label': cfg.title || '全部设定全文'
      });
      txa.value = text;

      var body = KRH('div.crt-copy', {},
        KRH('div.crt-copy-bar', {}, hint, allBtn),
        note,
        KRH('p.crt-copy-count', {}, selTag, countTag),
        txa
      );

      var handle = KR.modal({
        title: cfg.title,
        body: body,
        onClose: function () {
          if (offTab) offTab();
          var back = cfg.back ? document.querySelector(cfg.back) : null;
          if (back) { try { back.focus(); } catch (e) {} }
        }
      });

      var dlg = handle && handle.node ? handle.node.querySelector('.modal-dialog') : null;
      if (dlg) dlg.setAttribute('aria-describedby', 'crt-copy-hint');

      // KR.modal 的 × 在 DOM 里先于正文，Tab 从 textarea 出去会直接逃到弹窗后面的页面。
      // 这里补一个三格循环：全选 → textarea → ×，不碰共享的 modal 结构。
      var xBtn = dlg ? dlg.querySelector('.modal-x') : null;
      var seq = xBtn ? [allBtn, txa, xBtn] : [allBtn, txa];
      var offTab = KRD.on(document, 'keydown', function (ev) {
        if (ev.key !== 'Tab') return;
        var at = seq.indexOf(document.activeElement);
        if (at < 0) return;
        ev.preventDefault();
        var next = (at + (ev.shiftKey ? -1 : 1) + seq.length) % seq.length;
        try { seq[next].focus(); } catch (e) {}
      });

      var TOTAL = txa.value.length;

      function paintSel(start, end) {
        if (TOTAL > 0 && start === 0 && end === TOTAL) {
          hint.textContent = HINT_SELECTED;
          selTag.textContent = '';
        } else if (start === end) {
          hint.textContent = HINT_LOST;
          selTag.textContent = '';
        } else {
          if (selTag.textContent === '') hint.textContent = HINT_LOST;
          selTag.textContent = '已选 ' + (end - start) + ' / ' + TOTAL + ' 字';
        }
      }

      function readSel() {
        var a = 0, b = 0;
        try { a = txa.selectionStart; b = txa.selectionEnd; } catch (e) { a = b = 0; }
        paintSel(a, b);
      }

      function selectAll() {
        // 三步都写：select() 单独在部分 WebKit 上对 readonly 不生效
        try {
          txa.focus();
          txa.setSelectionRange(0, TOTAL);
          txa.select();
          // select() 会把视口滚到选区末尾，弹窗一打开就看到文档屁股；按回开头
          txa.scrollTop = 0;
        } catch (e) {}
        paintSel(0, TOTAL);
      }

      allBtn.addEventListener('click', selectAll);
      KRD.on(txa, 'select mouseup keyup', readSel);

      // 晚于 KR.modal 里 dialog 聚焦的 0ms，否则选区会被随后的 focus() 清掉
      setTimeout(selectAll, 35);
      // 少数浏览器在选区渲染的下一帧才滚，补一次
      setTimeout(function () { try { txa.scrollTop = 0; } catch (e) {} }, 120);
      return handle;
    }

    function copyAll() {
      var weak = !String(S.name || '').trim() && !String(S.looksText || '').trim() && !String(S.personaText || '').trim();
      showCopyModal({
        title: '全部设定 · 手动复制',
        hint: HINT_SELECTED,
        text: setText(),
        note: weak ? '这一份还没有名字和描述，复制出去只有默认值。' : '',
        back: '[data-act="copy-all"]'
      });
    }

    function copyJson() {
      showCopyModal({
        title: '角色卡 JSON · 手动复制',
        hint: '给工具读的版本，字段结构与本地存档一致。已全选。',
        text: jsonText(),
        mono: true,
        back: '[data-act="copy-json"]'
      });
    }

    KRD.on(cardFt, 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'copy-all') copyAll();
      else if (act === 'copy-json') copyJson();
    });

    // ── 联动 ?work=&node= ────────────────────────────────
    function applyQuery() {
      var q = (ctx && ctx.query) || {};
      if (!q.work) return;
      var w = workById(q.work);
      if (!w) return;
      var idx = eraIndexOf(Number(w.year) || 0);
      S.eraIdx = idx;
      S.workId = w.id;
      S.year = Number(w.year) || 0;
      S.src = { work: w.title, stage: w.stage, no: Number(q.node) || Number(w.no) || 0 };
      eraSel3.value = String(idx);
      paintWorks();
      paintExcerpt();
      KRD.clear(srcBar);
      srcBar.appendChild(KRH('span.crt-src-k', { text: '来源地点' }));
      srcBar.appendChild(KRH('span.crt-src-v', { text: S.src.work + ' · ' + S.src.stage }));
      srcBar.appendChild(KRH('span.crt-src-no.tnum', { text: '节点 ' + (S.src.no < 10 ? '0' + S.src.no : String(S.src.no)) }));
      srcBar.appendChild(KRH('button.btn.btn-ghost.btn-sm', {
        type: 'button',
        onclick: function () { S.src = null; srcBar.setAttribute('hidden', ''); paintCard(); }
      }, '清除'));
      srcBar.removeAttribute('hidden');
    }

    // ── 首屏 ─────────────────────────────────────────────
    paintRiderList();
    paintGachaPane();
    paintExcerpt();
    paintAids();
    paintCharList();
    paintPanes();
    paintYear();
    applyQuery();
    paintCard();

  }

  function unmount(el) {
    S = null;
    CHAR_INDEX = null;
    if (el) {
      el.removeAttribute('data-own');
      KRD.clear(el);
    }
  }

  KR.views.create = {
    title: '创造角色',
    mount: mount,
    unmount: unmount
  };
})(window);
