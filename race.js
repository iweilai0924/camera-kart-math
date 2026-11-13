// ───────── 賽車：雙手握「空氣方向盤」轉彎，方向盤拿高就加速，開過正確答案的閘門會衝刺並拿到道具 ─────────
// 畫面是車尾後方的立體視角：賽道切成一段一段，由近到遠投影到畫面上（街機賽車的老做法，不需要 3D 引擎）。
// 1 人玩是整個畫面；2、3 人玩左右並排；4 人玩田字形。站在畫面最左邊的人是 1P，往右依序是 2P、3P、4P。
export function createRace(env) {
  const { CFG, state, $, launch, isPrime, getSource, srcSize, params } = env;
  const cv = $('race'), ctx = cv.getContext('2d');
  const FONT = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, p) => a + (b - a) * p;
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 賽道的尺寸（單位是「賽道裡的長度」，不是像素）
  const SEG = 200;            // 一段路的長度
  const ROAD = 2000;          // 路面的半寬
  const CAMH = 1000;          // 鏡頭離地高度
  const DEPTH = 1 / Math.tan(50 * Math.PI / 180); // 視角 100 度
  const PZ = CAMH * DEPTH;    // 鏡頭在車子後面多遠
  const DRAW = 150;           // 往前畫幾段
  const MAXV = SEG * 60;      // 最高速（每秒 60 段）
  const CARW = 640;           // 車寬
  const LANE_COLOR = ['#ff8a5c', '#ffd23f', '#5cc8ff']; // 左、中、右三個車道的牌子顏色
  const P_COLOR = ['#ff5a5f', '#3fa9f5', '#ffc93c', '#34c77b'], AI_COLOR = ['#ffc93c', '#34c77b', '#3fa9f5'];
  const GAS = { high: '拿高', step: '踏步', auto: '自動' }, GAS_NEXT = { high: 'step', step: 'auto', auto: 'high' };
  // 道具：拿到後先存著（最多一個），雙手舉過頭才使用
  const ITEMS = { boost: { name: '衝刺', color: '#ff7a3c', ch: '衝' }, shield: { name: '護盾', color: '#4db8ff', ch: '盾' }, trap: { name: '香蕉皮', color: '#f2c417', ch: '蕉' }, hint: { name: '提示', color: '#ffd23f', ch: '示' } };
  const BOX_LANES = [-0.66, 0, 0.66]; // 一排三個寶箱，各在一個車道的中央
  // 測試模式的鍵盤：每位玩家依序是 左、右、加速、用道具
  const KB = [['arrowleft', 'arrowright', 'arrowup', 'arrowdown'], ['j', 'l', 'i', 'k'], ['a', 'd', 'w', 's'], ['4', '6', '8', '5']];
  const KB_NAME = ['← → 轉彎，↑ 加速，↓ 用道具', 'J L 轉彎，I 加速，K 用道具', 'A D 轉彎，W 加速，S 用道具', '4 6 轉彎，8 加速，5 用道具'];
  const LEVELS = { add: '20 以內加減', mul: '九九乘法', prime: '質數與倍數', off: '不出題' };
  const LEVEL_NEXT = { add: 'mul', mul: 'prime', prime: 'off', off: 'add' };
  // 賽道（由簡單到難）：plan 是八個彎，每個彎是 [彎度（正的往右）, 這一段總共爬升多少]
  //   drift 過彎被往外甩的程度　offCap 開到路外最快能多快　bump 路面顛簸的高度　ai 電腦車的速度倍率
  const TRACKS = {
    meadow: { name: '草原', level: '簡單', grass: ['#86d93a', '#7ccf33'], road: ['#8b90a0', '#858a9a'], rumble: ['#fff', '#ff6b6b'], sky: 'sky', prop: 'prop', propW: [1700, 1300, 950, 1100], skyGrad: ['#2f8fff', '#bfe8ff'], seed: 20261112,
      drift: 0.15, offCap: 0.4, bump: 0, ai: 0.93, // 彎緩、路平、電腦車慢
      plan: [[1.2, 10], [-1.5, -10], [1.8, 0], [-1.2, 15], [1.5, -15], [-1.8, 10], [1.2, -10], [-1.5, 0]] },
    beach: { name: '海邊', level: '一般', grass: ['#f2dc9a', '#ecd28a'], road: ['#9a9488', '#948e82'], rumble: ['#fff', '#38b6c9'], sky: 'skyBeach', prop: 'bprop', propW: [1600, 1300, 1000, 1000], skyGrad: ['#1fa2ff', '#c8f4ff'], seed: 7719,
      drift: 0.2, offCap: 0.3, bump: 0, ai: 1,
      plan: [[2, 20], [-2.5, -20], [3, 0], [-2, 35], [2.5, -35], [-3, 20], [2, -20], [-2.5, 0]] },
    offroad: { name: '越野', level: '難', grass: ['#9aa24e', '#8f9846'], road: ['#b98a55', '#b0824e'], rumble: ['#e8d3a6', '#8a5a2b'], sky: 'skyOffroad', prop: 'oprop', propW: [1500, 1100, 900, 1300], skyGrad: ['#ffb36b', '#ffe9c4'], seed: 4242,
      drift: 0.26, offCap: 0.45, bump: 0.55, ai: 1.04, // 泥土路：一路顛簸、S 形急彎、大起大落；開出路外比較不吃虧
      plan: [[3, 60], [-3.5, -60], [3.5, 50], [-3, -50], [-3.5, 70], [4, -70], [-4, 40], [3, -40]] },
    snow: { name: '雪地', level: '難', grass: ['#f4f8ff', '#e6eefc'], road: ['#7d8799', '#77818f'], rumble: ['#fff', '#5c8dff'], sky: 'skySnow', prop: 'sprop', propW: [1500, 850, 950, 1050], skyGrad: ['#7fb6ff', '#eaf4ff'], seed: 31337,
      drift: 0.32, offCap: 0.25, bump: 0, ai: 1.04, // 路滑：過彎很容易被甩出去，開進雪堆會很慢
      plan: [[-3, 45], [3.5, -45], [-2, 60], [4, -30], [-4, -30], [2.5, 50], [-3.5, -50], [3, 0]] },
  };
  const TRACK_NEXT = { meadow: 'beach', beach: 'offroad', offroad: 'snow', snow: 'meadow' };
  // 四台車各有一點個性（差距不大，選喜歡的就好）：top 極速、acc 加速、grip 過彎被甩出去的程度（越小越穩）
  const KARTS = [{ img: 'karta', name: '紅車', trait: '均衡', top: 1, acc: 1, grip: 1 }, { img: 'kartb', name: '藍車', trait: '極速快', top: 1.06, acc: 0.82, grip: 1 },
    { img: 'kartc', name: '黃車', trait: '加速快', top: 0.97, acc: 1.4, grip: 1 }, { img: 'kartd', name: '綠車', trait: '過彎穩', top: 1, acc: 1, grip: 0.55 }];

  // 設定（按鈕可改；網址也可以帶 ?players=2&level=add&gas=auto）
  // 例：?players=4&level=add&track=snow&gas=step（level2、level3、level4 可以個別指定每位玩家的題目）
  const lvOf = k => LEVELS[params.get(k) || params.get('level')] ? (params.get(k) || params.get('level')) : 'mul';
  const opt = {
    n: clamp(Math.round(+params.get('players')) || 1, 1, 4),
    levels: [lvOf('level'), lvOf('level2'), lvOf('level3'), lvOf('level4')],
    gas: GAS[params.get('gas')] ? params.get('gas') : 'high',
    track: TRACKS[params.get('track')] ? params.get('track') : 'meadow',
    karts: [0, 1, 2, 3].map(i => { const v = 'abcd'.indexOf((params.get('karts') || '')[i]); return v < 0 ? i : v; }), // 每位玩家選的車，例：?karts=dcba
  };
  let TR = TRACKS[opt.track], built = '';

  // ── 素材（AI 生成後去背；還沒載入或載入失敗時，用程式畫的簡易版）──
  const IMGS = {};
  const load = (k, src) => { const im = new Image(); im.src = src; im.decode().then(() => { IMGS[k] = im; }).catch(() => console.warn('素材載入失敗', src)); };
  for (const c of 'abcd') load('kart' + c, `assets/race/kart-${c}.png`);
  for (const i of [0, 1, 2, 3]) load('prop' + i, `assets/race/prop-${i}.png`);
  load('sky', 'assets/race/bg-sky.jpg'); load('skyBeach', 'assets/race/bg-beach.jpg'); load('skySnow', 'assets/race/bg-snow.jpg'); load('skyOffroad', 'assets/race/bg-offroad.jpg');
  for (const i of [0, 1, 2, 3]) { load('bprop' + i, `assets/race/beach-prop-${i}.png`); load('sprop' + i, `assets/race/snow-prop-${i}.png`); load('oprop' + i, `assets/race/offroad-prop-${i}.png`); }
  for (const k of ['box', 'boost', 'shield', 'trap', 'hint', 'trophy']) load('item-' + k, `assets/race/item-${k}.png`);
  const PROP_COLOR = ['#3fa34d', '#2f8f5b', '#6cc24a', '#9aa0a6']; // 素材還沒載入時，路邊物件先畫成這些顏色的圓

  // ── 題目 ──
  const PRIMES = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  const COMPOSITES = [9, 15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 77, 81, 85, 87, 91, 93, 95, 99];
  function makeQ(level) {
    if (level === 'off') return { text: '', opts: null, ans: rint(0, 2) }; // 不出題：三個車道裡有一個是加速拱門
    let text, ans, pool, min = 1;
    if (level === 'add') {
      if (Math.random() < 0.5) { const a = rint(2, 17), b = rint(1, 20 - a); text = `${a} + ${b} = ?`; ans = a + b; }
      else { const a = rint(6, 20), b = rint(1, a - 1); text = `${a} − ${b} = ?`; ans = a - b; }
      pool = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10]; min = 0;
    } else if (level === 'mul') {
      const a = rint(2, 9), b = rint(2, 9); text = `${a} × ${b} = ?`; ans = a * b;
      pool = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, ans + 1, ans - 1, ans + 10, ans - 10];
    } else if (Math.random() < 0.5) {
      text = '哪個是質數？'; ans = pick(PRIMES); pool = COMPOSITES.slice();
    } else {
      const n = pick([3, 4, 6, 7, 8, 9]); ans = n * rint(2, 12); text = `哪個是 ${n} 的倍數？`;
      pool = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, ans - 3, ans + 10, ans - 10].filter(v => v % n !== 0);
    }
    const wrong = [];
    for (const v of shuffle(pool)) { if (v >= min && v !== ans && !wrong.includes(v)) wrong.push(v); if (wrong.length === 2) break; }
    for (let k = 3; wrong.length < 2; k++) if (!wrong.includes(ans + k)) wrong.push(ans + k);
    const opts = shuffle([ans, ...wrong]);
    return { text, opts, ans: opts.indexOf(ans) };
  }

  // ── 賽道 ──
  let segs = [], gates = [], boxRows = [], finishIdx = 0;
  const START = 3; // 起跑線在第幾段
  const easeIn = (a, b, p) => a + (b - a) * p * p, easeInOut = (a, b, p) => a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2);
  const lastY = () => segs.length ? segs[segs.length - 1].y2 : 0;
  function addSeg(curve, y) { const i = segs.length; segs.push({ i, y1: lastY(), y2: y, curve, props: [], dark: Math.floor(i / 3) % 2 }); }
  function addRoad(enter, hold, leave, curve, hill) { // 進彎、彎中、出彎各幾段；curve 正的往右彎；hill 是這一路總共爬升多少
    const y0 = lastY(), y1 = y0 + hill * SEG, tot = enter + hold + leave;
    for (let i = 0; i < enter; i++) addSeg(easeIn(0, curve, i / enter), easeInOut(y0, y1, i / tot));
    for (let i = 0; i < hold; i++) addSeg(curve, easeInOut(y0, y1, (enter + i) / tot));
    for (let i = 0; i < leave; i++) addSeg(easeInOut(curve, 0, i / leave), easeInOut(y0, y1, (enter + hold + i) / tot));
  }
  function build() {
    TR = TRACKS[opt.track]; built = opt.track; segs = []; gates = []; boxRows = [];
    const box = i => { segs[i].box = boxRows.length; boxRows.push(i); }; // 一排寶箱
    addRoad(0, 70, 0, 0, 0); box(45); // 起跑直線（起跑後不久就有第一排寶箱）
    // 每一輪：一段直線（答案閘門在直線尾端）＋一個彎（彎的中段有一排寶箱）。題目在過了上一個閘門後就會出現，過彎時可以先想。
    for (const [curve, hill] of TR.plan) {
      addRoad(10, 110, 10, 0, 0);
      const g = segs.length - 25; segs[g].gate = gates.length; gates.push(g);
      addRoad(50, 110, 50, curve, hill); box(segs.length - 105);
    }
    addRoad(10, 100, 0, 0, 0); finishIdx = segs.length - 10;
    addRoad(0, 320, 0, 0, 0); // 過終點後的緩衝區
    if (TR.bump) { // 顛簸路面：起跑直線之後到終點之前，路面一路小幅起伏
      const f = i => i < 70 || i > finishIdx - 30 ? 0 : TR.bump * SEG * (Math.sin(i * 0.33) + 0.6 * Math.sin(i * 0.71 + 1)) * clamp((i - 70) / 20, 0, 1) * clamp((finishIdx - 30 - i) / 20, 0, 1);
      for (const sg of segs) { sg.y1 += f(sg.i); sg.y2 += f(sg.i + 1); }
    }
    // 路邊的樹和石頭（固定的亂數種子，每次開起來位置都一樣）
    let seed = TR.seed; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 8; i < segs.length; i += 4 + Math.floor(rand() * 7)) {
      const side = rand() < 0.5 ? -1 : 1, k = Math.floor(rand() * 4);
      segs[i].props.push({ k, off: side * (1.45 + rand() * 2.2) });
      if (rand() < 0.4) segs[i].props.push({ k: Math.floor(rand() * 4), off: -side * (1.6 + rand() * 2.5) });
    }
  }
  build();
  const segAt = z => segs[clamp(Math.floor(z / SEG), 0, segs.length - 1)];

  // ── 遊戲狀態 ──
  let R, inp, upSince = 0, nextFw = 0, sized = '';
  const keys = new Set();
  const newInput = () => ({ steer: 0, lift: 0, hands: false, legs: false, up: false, seen: -1e9, lastStep: -1e9, rate: 0, side: 0, mean: undefined, sigT: 0, box: null, pts: null });
  const GRID = [[0], [-0.4, 0.4], [-0.6, 0, 0.6], [-0.75, -0.25, 0.25, 0.75]]; // 起跑時每位玩家排在路面的哪裡
  function reset() {
    const n = opt.n;
    if (built !== opt.track) build();
    R = state.race = {
      phase: 'idle', n, levels: opt.levels, gas: opt.gas, track: opt.track, countAt: 0, t0: 0, overAt: 0, firstFin: 0, order: [], traps: [],
      players: Array.from({ length: n }, (_, i) => ({ i, human: true, x: GRID[n - 1][i], z: START * SEG, v: 0, steer: 0, cad: 0, lift: 0, gas: 0,
        gate: 0, qs: gates.map(() => makeQ(opt.levels[i])), right: 0, wrong: 0, boostT: 0, shakeT: 0, note: null, fin: 0, time: 0, rank: 0, sky: 0, avg: 0,
        item: null, itemAt: 0, shieldT: 0, spinT: 0, slide: 0, hintGate: -1, boxes: new Set(), upAt: 0, upLatch: false,
        kart: KARTS[opt.karts[i]], img: KARTS[opt.karts[i]].img, color: P_COLOR[i], best: getBest(opt.levels[i]), record: false, pickAt: 0, pickLatch: false })),
      ais: [],
    };
    // 電腦車：1 人玩有 3 台，2 人玩 2 台，3 人玩 1 台，4 人玩沒有。速度跟著玩家的油門調整（最快的那台比玩家慢一點點），玩家答對題目衝刺就能超前
    const lanes = [[-0.66, 0.66, 0], [-0.05, 0.75], [0.3], []][n - 1];
    const ks = [[0.82, 0.9, 0.97], [0.85, 0.95], [0.92], []][n - 1];
    const used = opt.karts.slice(0, n), spare = [2, 3, 1, 0].filter(k => !used.includes(k)); // 電腦車盡量開玩家沒選的車
    R.ais = lanes.map((x, j) => ({ j, human: false, lane: x, x, z: (START + 2.2 + j * 1.6) * SEG, v: 0, k: ks[j] * TR.ai, ph: j * 2.1, fin: 0, slipT: 0,
      img: KARTS[spare.length ? spare[j % spare.length] : [2, 3, 1][j]].img, color: AI_COLOR[j] }));
    inp = [newInput(), newInput(), newInput(), newInput()];
    upSince = 0; keys.clear(); sized = '';
  }
  const bestKey = level => `handsup-race-best-${opt.track === 'meadow' ? '' : opt.track + '-'}${level}-${opt.gas}`; // 每條賽道、每種題目、每種油門各記各的
  function getBest(level) { try { return +localStorage.getItem(bestKey(level)) || 0; } catch (e) { return 0; } }
  function setBest(level, s) { try { localStorage.setItem(bestKey(level), String(s)); } catch (e) { /* 無痕視窗等情況存不了就算了 */ } }
  function start() { reset(); R.phase = 'count'; R.countAt = performance.now(); }

  const ctl = () => `<div data-a="race:start">開始／重來</div><div data-a="race:n">人數：${opt.n} 人</div><div data-a="race:track">賽道：${TRACKS[opt.track].name}（${TRACKS[opt.track].level}）</div>`
    + (opt.n > 2 ? `<div data-a="race:lvall">題目：${LEVELS[opt.levels[0]]}</div>` // 3、4 人時按鈕放不下，大家用同一種題目
      : `<div data-a="race:lv0">${opt.n > 1 ? '1P ' : ''}題目：${LEVELS[opt.levels[0]]}</div>` + (opt.n > 1 ? `<div data-a="race:lv1">2P 題目：${LEVELS[opt.levels[1]]}</div>` : ''))
    + `<div data-a="race:gas">油門：${GAS[opt.gas]}</div>`
    + Array.from({ length: opt.n }, (_, i) => `<div data-a="race:kart${i}">${opt.n > 1 ? i + 1 + 'P ' : ''}${KARTS[opt.karts[i]].name}・${KARTS[opt.karts[i]].trait}</div>`).join('');
  function action(a) {
    if (a === 'start') return start();
    if (a === 'n') { opt.n = opt.n % 4 + 1; if (opt.n > 2) opt.levels.fill(opt.levels[0]); }
    else if (a === 'lv0') opt.levels[0] = LEVEL_NEXT[opt.levels[0]];
    else if (a === 'lv1') opt.levels[1] = LEVEL_NEXT[opt.levels[1]];
    else if (a === 'lvall') opt.levels.fill(LEVEL_NEXT[opt.levels[0]]);
    else if (a === 'gas') opt.gas = GAS_NEXT[opt.gas];
    else if (a === 'track') opt.track = TRACK_NEXT[opt.track];
    else if (a.startsWith('kart')) opt.karts[+a[4]] = (opt.karts[+a[4]] + 1) % KARTS.length;
    reset();
  }
  // 測試模式的鍵盤（只接收目前有上場的玩家的按鍵）；空白鍵開始（空白鍵平常也能用）
  function key(k, down) {
    if (k === ' ') { if (down) start(); return true; }
    if (!state.test || !KB.slice(0, R.n).flat().includes(k)) return false;
    down ? keys.add(k) : keys.delete(k); return true;
  }

  // ── 從姿態讀出「方向盤角度」「方向盤高度」和「踏步」──
  // 關節編號：0 鼻、5/6 肩、9/10 腕、11/12 髖、13/14 膝、15/16 踝
  function readPose(s, d, w, h, now) {
    if (!d) { s.hands = s.legs = s.up = false; s.lift = 0; return; }
    const P = i => ({ x: d.kp[i * 3], y: d.kp[i * 3 + 1], v: d.kp[i * 3 + 2] }), ok = (p, th = 0.4) => p.v >= th;
    const nose = P(0), ls = P(5), rs = P(6), lw = P(9), rw = P(10), lh = P(11), rh = P(12), lk = P(13), rk = P(14), la = P(15), ra = P(16);
    const sw = Math.max(Math.hypot(ls.x - rs.x, ls.y - rs.y), d.w * 0.3, 1);
    s.seen = now; s.box = { x: d.x, y: d.y, w: d.w, h: d.h }; s.pts = { lw, rw, lk, rk };
    // 方向盤：兩個手腕連成一條線，這條線歪多少就是方向盤轉多少。左手低、右手高＝左轉。
    // 不看模型標的左右手，直接看位置：面對鏡頭時，原始影像中靠右的那隻是玩家的左手。
    s.hands = ok(lw, 0.35) && ok(rw, 0.35);
    if (s.hands) {
      const [L, Rr] = lw.x > rw.x ? [lw, rw] : [rw, lw];
      const ang = Math.atan2(L.y - Rr.y, Math.max(L.x - Rr.x, 0.3 * sw)), dead = CFG.raceSteerDead;
      const a = Math.abs(ang) < dead ? 0 : ang - Math.sign(ang) * dead;
      s.steer = clamp(-a / (CFG.raceSteerMax - dead), -1, 1);
      const top = ok(nose) ? nose.y : Math.min(ls.y, rs.y) - 0.6 * sw;
      s.up = lw.y < top && rw.y < top; // 雙手舉過頭＝開始（比賽中＝使用道具）
      // 油門（拿高模式）：方向盤（兩手腕的中點）比肩膀低多少個肩寬。舉到肩膀附近＝全速，放低到肚子＝不加速
      const level = ((lw.y + rw.y) / 2 - (ls.y + rs.y) / 2) / sw, top2 = CFG.raceGasTop ?? 0.2, bot = CFG.raceGasBottom ?? 1.1;
      s.lift = ok(ls) && ok(rs) ? clamp((bot - level) / (bot - top2), 0, 1) : 0;
    } else { s.up = false; s.lift = 0; }
    // 踏步：看左右膝蓋（和腳踝）的高度差。踏步時這個差會一正一負來回跳，每跳一次算一步。
    const kn = ok(lk) && ok(rk), an = ok(la) && ok(ra);
    s.legs = kn || an;
    if (!s.legs) return;
    const torso = ok(lh) && ok(rh) && ok(ls) && ok(rs) ? Math.max(Math.hypot((ls.x + rs.x - lh.x - rh.x) / 2, (ls.y + rs.y - lh.y - rh.y) / 2), sw) : sw * 1.4;
    const sig = (kn && an ? (lk.y - rk.y) + 0.5 * (la.y - ra.y) : kn ? 1.5 * (lk.y - rk.y) : la.y - ra.y) / torso;
    const dt = clamp((now - s.sigT) / 1000, 0.001, 0.2); s.sigT = now;
    s.mean = s.mean === undefined ? sig : s.mean + (sig - s.mean) * Math.min(1, dt / 0.7); // 扣掉站姿本來就有的高低差
    const hp = sig - s.mean, side = hp > CFG.raceStepTh ? 1 : hp < -CFG.raceStepTh ? -1 : 0;
    if (side && side !== s.side) {
      s.side = side;
      const iv = now - s.lastStep;
      if (iv > 110) { // 一秒不可能踏超過 9 步，太密的當作雜訊
        const r = iv < 1600 ? 1000 / iv : 0.8;
        s.rate = s.rate && iv < 1600 ? (s.rate + r) / 2 : r; s.lastStep = now;
      }
    }
  }
  function input(dets, w, h, now = performance.now()) {
    if (!R) return;
    // 取畫面中最大的幾個人（人數＝玩家數）。畫面是鏡像，原始影像中 x 越大的人在畫面上越靠左 → 由左到右是 1P、2P、3P、4P
    const big = dets.filter(d => d.h > h * 0.2).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, R.n).sort((a, b) => b.x - a.x);
    let slots = new Array(R.n).fill(null);
    if (big.length === R.n) slots = big;
    else for (const d of big) { // 人沒到齊：把畫面分成幾等分，站在哪一等分就是幾 P
      let i = clamp(Math.floor((1 - d.x / w) * R.n), 0, R.n - 1); while (slots[i]) i = (i + 1) % R.n; slots[i] = d; }
    for (let i = 0; i < 4; i++) readPose(inp[i], slots[i] || null, w, h, now);
  }
  const cadenceOf = (s, now) => now - s.lastStep < 1600 ? Math.min(s.rate, 1000 / Math.max(1, now - s.lastStep)) : 0; // 每秒幾步；停下來就慢慢掉到 0

  // ── 每一格的更新 ──
  // ── 道具 ──
  function giveItem(p, t, why) { // 已經有一個就不再給（要先用掉）
    if (p.item) return false;
    const pool = ['boost', 'shield'];
    if ([...R.players, ...R.ais].some(c => c !== p && c.z < p.z)) pool.push('trap'); // 後面有車才會抽到香蕉皮
    if (R.levels[p.i] !== 'off' && p.gate < gates.length) pool.push('hint');        // 還有題目才會抽到提示
    p.item = pool[Math.floor(Math.random() * pool.length)]; p.itemAt = t;
    p.note = { text: `${why}拿到「${ITEMS[p.item].name}」`, good: true, t };
    return true;
  }
  const laneOf = x => x < -1 / 3 ? 0 : x > 1 / 3 ? 2 : 1; // 路面分成左、中、右三個車道
  function useItem(p, t) {
    const k = p.item; if (!k) return;
    p.item = null;
    if (k === 'boost') { p.boostT = t + 3000; p.v = Math.min(MAXV * 1.35, p.v + MAXV * 0.25); p.note = { text: '衝刺！', good: true, t }; }
    else if (k === 'shield') { p.shieldT = t + 6000; p.note = { text: '護盾 6 秒', good: true, t }; }
    // 香蕉皮落在車子所在那個車道的正中央，只佔那一個車道
    else if (k === 'trap') { R.traps.push({ x: BOX_LANES[laneOf(p.x)], z: Math.max(0, p.z - SEG * 1.5), owner: p.i, t }); p.note = { text: '在車後丟了香蕉皮', good: true, t }; }
    else if (k === 'hint') { p.hintGate = p.gate; p.note = { text: '下一題的答案亮起來了', good: true, t }; }
  }

  // ── 每一格的更新 ──
  function gateResult(p, t) {
    const q = p.qs[p.gate], lane = p.x < -1 / 3 ? 0 : p.x > 1 / 3 ? 2 : 1, off = !q.opts;
    p.gate++;
    if (Math.abs(p.x) > 1.05) p.note = { text: '沒通過閘門', good: false, t };
    else if (lane === q.ans) { // 答對：衝刺，另外再給一個道具
      p.right++; p.boostT = t + CFG.raceBoostMs; p.v = Math.min(MAXV * 1.35, p.v + MAXV * 0.25);
      if (!giveItem(p, t, off ? '衝刺！' : '答對！')) p.note = { text: off ? '衝刺！' : '答對　衝刺！', good: true, t };
    } else if (!off) {
      p.wrong++;
      if (t < p.shieldT) p.note = { text: `答錯（答案是 ${q.opts[q.ans]}），護盾擋住了`, good: false, t };
      else { p.v *= 0.45; p.boostT = 0; p.shakeT = t + 400; p.note = { text: `答錯　答案是 ${q.opts[q.ans]}`, good: false, t }; }
    }
  }
  function update(t, dt) {
    const now = performance.now(), racing = R.phase === 'race', crashMs = CFG.raceCrashMs ?? 1500; // 撞到東西、踩到香蕉皮後暫停多久
    for (const p of R.players) {
      const s = inp[p.i], live = now - s.seen < 500, kb = KB[p.i], z0 = p.z; // 有鏡頭資料用鏡頭，否則（測試模式）用鍵盤
      const spin = t < p.spinT, shield = t < p.shieldT;
      const steerIn = spin ? 0 : live ? (s.hands ? s.steer : 0) : (keys.has(kb[1]) ? 1 : 0) - (keys.has(kb[0]) ? 1 : 0);
      p.steer += (steerIn - p.steer) * Math.min(1, dt * 10);
      const cadIn = live ? cadenceOf(s, now) : keys.has(kb[2]) ? CFG.raceFullCadence : 0;
      p.cad += (cadIn - p.cad) * Math.min(1, dt * 5);
      const liftIn = live ? (s.hands ? s.lift : 0) : keys.has(kb[2]) ? 1 : 0;
      p.lift += (liftIn - p.lift) * Math.min(1, dt * 6);
      p.gas = !racing || p.fin ? 0 : R.gas === 'auto' ? 0.85 : R.gas === 'high' ? p.lift : clamp(p.cad / CFG.raceFullCadence, 0, 1);
      // 使用道具：雙手舉過頭（鏡頭要維持 0.25 秒，避免轉彎時誤觸）；用完要把手放下才能再用下一個
      const up = live ? s.up : keys.has(kb[3]);
      if (!up) { p.upAt = 0; p.upLatch = false; } else if (!p.upAt) p.upAt = t;
      if (racing && !p.fin && up && !p.upLatch && p.item && t - p.upAt >= (live ? (CFG.raceItemHoldMs ?? 250) : 0)) { useItem(p, t); p.upLatch = true; }
      const offroad = Math.abs(p.x) > 1.02, boost = t < p.boostT;
      let target = p.gas * MAXV * p.kart.top * (boost ? 1.35 : 1);
      if (boost) target = Math.max(target, MAXV * 0.8); // 衝刺時就算沒在加速也會往前衝
      if (offroad) target = Math.min(target, MAXV * TR.offCap); // 開到路外會慢下來
      if (spin) target = Math.min(target, MAXV * 0.2);    // 踩到香蕉皮或撞到東西：打滑
      p.v += (target - p.v) * dt * (target > p.v ? 0.9 * p.kart.acc : offroad || spin ? 2.5 : 0.6);
      const sp = p.v / MAXV, seg = segAt(p.z);
      p.x = clamp(p.x + p.steer * dt * 2.0 * Math.min(1, sp * 2.5) - dt * 2 * sp * sp * seg.curve * TR.drift * p.kart.grip, -1.8, 1.8); // 轉彎，再扣掉過彎被往外甩的量
      if (p.slide > 0) { const d = Math.min(p.slide, dt * 1.4); p.x = clamp(p.x + d, -1.8, 1.8); p.slide -= d; } // 踩到香蕉皮：往右滑
      p.z = Math.min(p.z + p.v * dt, (segs.length - 5) * SEG);
      p.sky += seg.curve * sp * dt * 0.04;
      p.avg += (p.gas * MAXV - p.avg) * Math.min(1, dt / 3); // 玩家「想開多快」（看油門，不看實際車速：被擋住時電腦車不會跟著變慢）
      if (!racing) continue;
      if (!shield) for (const a of R.ais) // 撞到電腦車的車尾：被擋下來（有護盾就直接穿過去）
        if (p.v > a.v && Math.abs(a.x - p.x) < 0.3 && p.z < a.z && a.z - p.z < SEG * 1.1) { p.v = a.v * 0.8; p.z = a.z - SEG * 1.1; p.shakeT = t + 250; }
      for (const tr of R.traps) { // 開過別人丟的香蕉皮：打滑（有護盾就沒事，香蕉皮也被清掉）
        if (tr.hit || tr.owner === p.i || !(z0 < tr.z && p.z >= tr.z) || Math.abs(tr.x - p.x) > 1 / 3) continue; // 只有開在同一個車道才會踩到
        tr.hit = true;
        if (shield) p.note = { text: '護盾擋住了香蕉皮', good: true, t };
        else { p.v *= 0.35; p.spinT = t + crashMs; p.shakeT = t + 300; p.boostT = 0; p.slide = 2 / 3; p.note = { text: '踩到香蕉皮！', good: false, t }; } // 往右滑一個車道（已經在最右邊就滑出路外）
      }
      for (let si = Math.floor(z0 / SEG) + 1; si <= Math.floor(p.z / SEG); si++) for (const pr of segs[si].props) { // 開出路外撞到樹或石頭：幾乎停下來，暫停一下才能再開
        if (Math.abs(pr.off - p.x) > 0.22) continue;
        if (shield) p.note = { text: '護盾擋住了', good: true, t };
        else { p.v *= 0.1; p.spinT = t + crashMs; p.shakeT = t + 350; p.boostT = 0; p.note = { text: '撞到了！', good: false, t }; }
      }
      boxRows.forEach((bi, r) => { // 開過寶箱：拿到道具（手上已經有就拿不到，寶箱留著）
        if (p.boxes.has(r) || !(z0 < bi * SEG && p.z >= bi * SEG) || !BOX_LANES.some(lx => Math.abs(lx - p.x) < 0.3)) return;
        if (giveItem(p, t, '')) p.boxes.add(r);
      });
      while (p.gate < gates.length && p.z >= gates[p.gate] * SEG) gateResult(p, t);
      if (p.hintGate >= 0 && p.hintGate < p.gate) p.hintGate = -1;
      if (!p.fin && p.z >= finishIdx * SEG) {
        p.fin = t; p.time = (t - R.t0) / 1000; R.order.push(p); p.rank = R.order.length;
        if (!R.firstFin) { R.firstFin = t; nextFw = 0; }
        const lv = R.levels[p.i];
        if (!p.best || p.time < p.best) { p.record = !!p.best; p.best = p.time; setBest(lv, +p.time.toFixed(1)); }
      }
    }
    // 電腦車
    const pace = Math.max(...R.players.map(p => p.avg)), lead = Math.max(...R.players.map(p => p.z));
    for (const a of R.ais) {
      const ahead = (a.z - lead) / (SEG * 100), z0 = a.z; // 領先玩家太多會放慢等人，落後則稍微追一下
      const band = ahead > 0 ? clamp(1 - ahead * 0.5, 0.5, 1) : clamp(1 - ahead * 0.25, 1, 1.15);
      const target = !racing || a.fin ? 0 : t < a.slipT ? MAXV * 0.2 : Math.max(MAXV * 0.5, pace * a.k) * band;
      a.v += (target - a.v) * dt * (t < a.slipT ? 2.5 : 1.2);
      a.z = Math.min(a.z + a.v * dt, (segs.length - 5) * SEG);
      a.x += (a.lane + 0.1 * Math.sin(t / 1300 + a.ph) - a.x) * Math.min(1, dt * 4); // 換車道時（踩到香蕉皮）滑過去，不是瞬間跳過去
      for (const tr of R.traps) if (!tr.hit && z0 < tr.z && a.z >= tr.z && Math.abs(tr.x - a.x) < 1 / 3) { tr.hit = true; a.v *= 0.35; a.slipT = t + crashMs; a.lane = Math.min(a.lane + 2 / 3, 1.2); } // 電腦車也會踩到香蕉皮
      if (racing && !a.fin && a.z >= finishIdx * SEG) { a.fin = t; R.order.push(a); }
    }
    R.traps = R.traps.filter(tr => !tr.hit && t - tr.t < 40000);
    if (racing) { // 目前名次
      const all = [...R.players, ...R.ais].sort((a, b) => b.z - a.z);
      for (const p of R.players) if (!p.fin) p.rank = all.indexOf(p) + 1;
    }
  }

  // ── 畫圖用的小工具 ──
  function text(str, x, y, size, color = '#fff', align = 'center', outline = true) {
    ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (outline) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = 'rgba(20,24,40,.85)'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }
  function quad(x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2); ctx.fill();
  }
  function drawKart(img, color, x, y, w, tilt = 0, flame = 0) { // (x, y) 是車底中央
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, -w * 0.02, w * 0.5, w * 0.09, 0, 0, Math.PI * 2); ctx.fill(); // 影子
    if (flame > 0) { // 衝刺時排氣管噴火
      for (const sx of [-0.06, 0.06]) { const g = ctx.createRadialGradient(sx * w, -w * 0.1, 0, sx * w, -w * 0.1, w * 0.2 * flame);
        g.addColorStop(0, 'rgba(255,255,220,.95)'); g.addColorStop(0.4, 'rgba(255,190,60,.8)'); g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx * w, -w * 0.02, w * 0.09 * flame, w * 0.2 * flame, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    const im = IMGS[img];
    if (im) { const h = w * im.height / im.width; ctx.drawImage(im, -w / 2, -h, w, h); }
    else { // 簡易版的車
      ctx.fillStyle = '#2b2f3a'; for (const sx of [-1, 1]) { rrect(sx * w * 0.36 - w * 0.12, -w * 0.34, w * 0.24, w * 0.34, w * 0.06); ctx.fill(); }
      ctx.fillStyle = color; rrect(-w * 0.34, -w * 0.5, w * 0.68, w * 0.42, w * 0.08); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -w * 0.56, w * 0.17, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawProp(k, sc, x, y, XS) {
    const w = sc * TR.propW[k] * XS, im = IMGS[TR.prop + k]; if (w < 2) return;
    if (im) { const h = w * im.height / im.width; ctx.drawImage(im, x - w / 2, y - h, w, h); }
    else { ctx.fillStyle = PROP_COLOR[k]; ctx.beginPath(); ctx.arc(x, y - w * 0.5, w * 0.45, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawIcon(k, x, y, size) { // 道具圖示（素材還沒載入時畫成一個色圈加一個字）
    const im = IMGS['item-' + k];
    if (im) { const sc = Math.min(size / im.width, size / im.height); ctx.drawImage(im, x - im.width * sc / 2, y - im.height * sc / 2, im.width * sc, im.height * sc); }
    else { ctx.fillStyle = ITEMS[k].color; ctx.beginPath(); ctx.arc(x, y, size * 0.45, 0, Math.PI * 2); ctx.fill(); text(ITEMS[k].ch, x, y + size * 0.03, size * 0.5, '#fff', 'center', false); }
  }
  function drawBox(x, y, w, t, ph) { // 路上的寶箱，上下浮動
    if (w < 3) return;
    const cy = y - w * (0.62 + 0.07 * Math.sin(t / 280 + ph * 5)), im = IMGS['item-box'];
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.34, w * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    if (im) { const h = w * im.height / im.width; ctx.drawImage(im, x - w / 2, cy - h / 2, w, h); }
    else { ctx.fillStyle = '#ffb53c'; rrect(x - w * 0.4, cy - w * 0.4, w * 0.8, w * 0.8, w * 0.12); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, w * 0.06); ctx.stroke(); if (w > 14) text('★', x, cy + w * 0.03, w * 0.5, '#fff', 'center', false); }
  }
  function drawTrap(x, y, w) { // 路上的香蕉皮
    if (w < 3) return;
    const im = IMGS['item-trap'];
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.42, w * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    if (im) { const h = w * im.height / im.width; ctx.drawImage(im, x - w / 2, y - h * 0.94, w, h); }
    else { ctx.fillStyle = '#f2c417'; ctx.beginPath(); ctx.ellipse(x, y - w * 0.12, w * 0.45, w * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff3a6'; ctx.beginPath(); ctx.ellipse(x, y - w * 0.2, w * 0.12, w * 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawShield(x, y, w, left) { // 車子外面的護盾泡泡；剩不到 1.5 秒會閃爍
    if (left < 1500 && Math.floor(left / 150) % 2) return;
    ctx.fillStyle = 'rgba(77,184,255,.2)'; ctx.strokeStyle = 'rgba(200,238,255,.9)'; ctx.lineWidth = Math.max(1.5, w * 0.03);
    ctx.beginPath(); ctx.ellipse(x, y - w * 0.42, w * 0.66, w * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  function drawGate(p, gi, a, YS) {
    const q = p.qs[gi], W2 = a.w, hgt = a.sc * 2000 * YS, top = a.y - hgt, bh = hgt * 0.4, post = Math.max(2, W2 * 0.035), off = !q.opts, hint = !off && p.hintGate === gi;
    for (let i = 0; i <= 3; i++) {
      if (off && i !== q.ans && i !== q.ans + 1) continue;
      ctx.fillStyle = '#f7f3e6'; ctx.fillRect(a.x - W2 + i * W2 * 2 / 3 - post / 2, top, post, hgt);
    }
    for (let i = 0; i < 3; i++) {
      if (off && i !== q.ans) continue;
      const x0 = a.x - W2 + i * W2 * 2 / 3 + post / 2, w = W2 * 2 / 3 - post, label = off ? '加速' : String(q.opts[i]);
      if (hint && i !== q.ans) ctx.globalAlpha = 0.3; // 用了「提示」：錯的答案變淡，對的答案加一圈黃框
      ctx.fillStyle = off ? '#ffd23f' : LANE_COLOR[i]; rrect(x0, top, w, bh, bh * 0.18); ctx.fill();
      ctx.strokeStyle = hint && i === q.ans ? '#ffe45c' : '#fff'; ctx.lineWidth = Math.max(1, bh * (hint && i === q.ans ? 0.16 : 0.06)); ctx.stroke();
      const size = Math.min(bh * 0.74, w * 0.85 / (label.length * (off ? 1 : 0.62)));
      if (size >= 7) text(label, x0 + w / 2, top + bh * 0.53, size, '#1d2233', 'center', false);
      ctx.globalAlpha = 1;
    }
  }
  function drawFinish(a, YS) {
    const W2 = a.w * 1.08, hgt = a.sc * 2400 * YS, top = a.y - hgt, bh = hgt * 0.3, post = Math.max(2, W2 * 0.05), n = 16, cw = W2 * 2 / n;
    ctx.fillStyle = '#f7f3e6'; ctx.fillRect(a.x - W2 - post / 2, top, post, hgt); ctx.fillRect(a.x + W2 - post / 2, top, post, hgt);
    for (let r = 0; r < 2; r++) for (let c = 0; c < n; c++) { ctx.fillStyle = (r + c) % 2 ? '#1d2233' : '#fff'; ctx.fillRect(a.x - W2 + c * cw, top + r * bh / 2, cw + 0.5, bh / 2 + 0.5); }
  }
  function drawSky(p, vw, vh, CY) {
    const im = IMGS[TR.sky], ih = CY + vh * 0.05;
    if (!im) { const g = ctx.createLinearGradient(0, 0, 0, ih); g.addColorStop(0, TR.skyGrad[0]); g.addColorStop(1, TR.skyGrad[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, vw, ih); }
    else { // 左右接續時每隔一張左右翻轉，接縫才不會露出來
      const iw = Math.round(ih * im.width / im.height), off = Math.round(p.sky * iw);
      for (let k = Math.floor(off / iw); k * iw - off < vw; k++) {
        const x = k * iw - off;
        if (((k % 2) + 2) % 2) { ctx.save(); ctx.translate(x + iw, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, iw, ih); ctx.restore(); }
        else ctx.drawImage(im, x, 0, iw, ih);
      }
    }
    ctx.fillStyle = TR.grass[0]; ctx.fillRect(0, ih - 1, vw, vh - ih + 1);
  }

  // ── 一個玩家的畫面 ──
  function view(p, vx, vy, vw, vh, t) {
    const XS = Math.min(vw, vh * 1.1) / 2, YS = vh / 2, CX = vw / 2, CY = vh * 0.47;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip(); ctx.translate(vx, vy);
    ctx.save();
    if (t < p.shakeT) ctx.translate((Math.random() - 0.5) * vh * 0.02, (Math.random() - 0.5) * vh * 0.02);
    drawSky(p, vw, vh, CY);
    const camZ = p.z - PZ, bi = clamp(Math.floor(camZ / SEG), 0, segs.length - 1), bp = clamp((camZ - bi * SEG) / SEG, 0, 1);
    const ps = segAt(p.z), pp = (p.z - ps.i * SEG) / SEG, camY = lerp(ps.y1, ps.y2, clamp(pp, 0, 1)) + CAMH, camX = p.x * ROAD;
    const proj = (wx, wy, wz) => { const cz = wz - camZ, sc = DEPTH / cz; return { cz, sc, x: CX + sc * (wx - camX) * XS, y: CY - sc * (wy - camY) * YS, w: sc * ROAD * XS }; };
    // 路面：由近到遠，被前面的坡擋住的就不畫
    const list = []; let maxy = vh, x = 0, dx = -segs[bi].curve * bp;
    for (let n = 0; n < DRAW; n++) {
      const s = segs[bi + n]; if (!s) break;
      const a = proj(x, s.y1, s.i * SEG), b = proj(x + dx, s.y2, (s.i + 1) * SEG);
      x += dx; dx += s.curve;
      list.push({ s, a, b, clip: maxy });
      if (a.cz <= DEPTH || b.y >= a.y || b.y >= maxy) continue;
      const y1 = Math.round(Math.min(a.y, maxy)), y2 = Math.round(b.y); // 取整數，相鄰兩段之間才不會露出細縫
      if (y2 >= y1) continue;
      ctx.fillStyle = TR.grass[s.dark]; ctx.fillRect(0, y2, vw, y1 - y2);
      quad(a.x, y1, a.w * 1.12, b.x, y2, b.w * 1.12, TR.rumble[s.dark]); // 路緣的雙色條
      quad(a.x, y1, a.w, b.x, y2, b.w, TR.road[s.dark]);
      if (s.i === START || s.i === finishIdx) { const n2 = 12; for (let c = 0; c < n2; c++) if (c % 2) quad(a.x - a.w + (c + 0.5) * a.w * 2 / n2, y1, a.w / n2, b.x - b.w + (c + 0.5) * b.w * 2 / n2, y2, b.w / n2, '#fff'); }
      else if (s.dark) for (const k of [-1 / 3, 1 / 3]) quad(a.x + a.w * k, y1, a.w / 45, b.x + b.w * k, y2, b.w / 45, '#eef0f6'); // 車道線
      maxy = y2;
    }
    // 路上的東西：由遠到近
    const cars = [...R.ais, ...R.players.filter(q => q !== p)];
    for (let n = list.length - 1; n >= 0; n--) {
      const { s, a, b, clip } = list[n]; if (a.cz <= DEPTH) continue;
      const here = cars.filter(c => Math.floor(c.z / SEG) === s.i), gate = s.gate !== undefined && s.gate >= p.gate;
      const boxes = s.box !== undefined && !p.boxes.has(s.box), traps = R.traps.filter(tr => Math.floor(tr.z / SEG) === s.i);
      if (!s.props.length && !here.length && !gate && !boxes && !traps.length && s.i !== finishIdx) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, vw, clip); ctx.clip();
      for (const pr of s.props) drawProp(pr.k, a.sc, a.x + a.sc * pr.off * ROAD * XS, a.y, XS);
      if (gate) drawGate(p, s.gate, a, YS);
      if (s.i === finishIdx) drawFinish(a, YS);
      for (const tr of traps) { const k = (tr.z - s.i * SEG) / SEG, sc = DEPTH / (tr.z - camZ); if (tr.z - camZ > DEPTH * 40) drawTrap(lerp(a.x, b.x, k) + sc * tr.x * ROAD * XS, lerp(a.y, b.y, k), sc * 560 * XS); }
      if (boxes) BOX_LANES.forEach((lx, i) => drawBox(a.x + a.sc * lx * ROAD * XS, a.y, a.sc * 560 * XS, t, s.i + i));
      for (const c of here) { const k = (c.z - s.i * SEG) / SEG, sc = DEPTH / (c.z - camZ);
        if (c.z - camZ <= DEPTH * 40) continue;
        const cx = lerp(a.x, b.x, k) + sc * c.x * ROAD * XS, cy = lerp(a.y, b.y, k), cw = sc * CARW * XS, slip = Math.max(c.spinT || 0, c.slipT || 0) - t;
        drawKart(c.img, c.color, cx, cy, cw, slip > 0 ? Math.sin(slip / 250 * Math.PI) * 0.5 : 0);
        if (c.human && t < c.shieldT) drawShield(cx, cy, cw, c.shieldT - t); }
      ctx.restore();
    }
    // 自己的車
    const sp = p.v / MAXV, boost = t < p.boostT;
    const spinLeft = p.spinT - t;
    drawKart(p.img, p.color, CX, CY + YS - (sp > 0.02 ? Math.sin(t / 45) * vh * 0.003 * sp : 0), CARW / CAMH * XS, spinLeft > 0 ? Math.sin(spinLeft / 250 * Math.PI) * 0.5 : p.steer * 0.1, boost ? 0.7 + 0.3 * Math.random() : 0);
    if (t < p.shieldT) drawShield(CX, CY + YS, CARW / CAMH * XS, p.shieldT - t);
    if (boost) { // 衝刺的速度線
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(2, vh * 0.004);
      for (let i = 0; i < 14; i++) { const ang = Math.random() * Math.PI * 2, r1 = vh * (0.45 + Math.random() * 0.2), r2 = r1 + vh * 0.25;
        ctx.beginPath(); ctx.moveTo(CX + Math.cos(ang) * r1 * 1.3, CY + Math.sin(ang) * r1); ctx.lineTo(CX + Math.cos(ang) * r2 * 1.3, CY + Math.sin(ang) * r2); ctx.stroke(); }
    }
    ctx.restore();
    hud(p, vw, vh, t);
    ctx.restore();
  }

  // ── 每個玩家畫面上的資訊 ──
  function hud(p, vw, vh, t) {
    const u = Math.min(vw, vh * 1.2) / 100, s = inp[p.i], now = performance.now(), live = now - s.seen < 500, lv = R.levels[p.i];
    // 上方：名次、時間、進度條
    const total = R.players.length + R.ais.length, secs = R.phase === 'race' ? (p.fin ? p.time : (t - R.t0) / 1000) : p.time;
    text(`${R.n > 1 ? p.i + 1 + 'P　' : ''}${p.rank ? `第 ${p.rank} 名` : ''}`, u * 2.5, u * 4.5, u * 4.2, p.color, 'left');
    text(`${secs.toFixed(1)} 秒`, vw - u * 2.5, u * 4.5, u * 4.2, '#fff', 'right');
    if (t < p.shieldT) text(`護盾 ${Math.ceil((p.shieldT - t) / 1000)}`, u * 2.5, u * 9.6, u * 3, '#8fd3ff', 'left');
    const bx = vw * 0.32, bw = vw * 0.36, by = u * 4.5, span = (finishIdx - START) * SEG, pos = c => bx + bw * clamp((c.z - START * SEG) / span, 0, 1);
    ctx.fillStyle = 'rgba(20,24,40,.6)'; rrect(bx - u, by - u * 0.9, bw + u * 2, u * 1.8, u); ctx.fill();
    for (const a of R.ais) { ctx.fillStyle = '#cfd4e0'; ctx.beginPath(); ctx.arc(pos(a), by, u * 0.7, 0, Math.PI * 2); ctx.fill(); }
    for (const q of R.players) { ctx.fillStyle = q.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.3; ctx.beginPath(); ctx.arc(pos(q), by, u * (q === p ? 1.3 : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // 題目與三個車道的選項
    const q = p.qs[p.gate], qy = Math.max(vh * 0.17, 128);
    if (R.phase === 'race' && q && !p.fin) {
      if (q.opts) {
        text(q.text, vw / 2, qy, u * (q.text.length > 8 ? 5.4 : 7.5));
        const cw = u * 13, gap = u * 2, y0 = qy + u * 5.5;
        ctx.globalAlpha = clamp(((gates[p.gate] * SEG - p.z) / SEG - 12) / 10, 0, 1); // 閘門很近時，上面的選項淡出，直接看閘門上的數字
        const fade = ctx.globalAlpha, hint = p.hintGate === p.gate;
        q.opts.forEach((v, i) => { const x0 = vw / 2 + (i - 1) * (cw + gap) - cw / 2, hot = hint && i === q.ans;
          ctx.globalAlpha = fade * (hint && !hot ? 0.3 : 1);
          ctx.fillStyle = LANE_COLOR[i]; rrect(x0, y0, cw, u * 6.4, u * 1.2); ctx.fill(); ctx.strokeStyle = hot ? '#ffe45c' : '#fff'; ctx.lineWidth = u * (hot ? 1 : 0.4); ctx.stroke();
          text(String(v), x0 + cw / 2, y0 + u * 3.4, u * 4.6, '#1d2233', 'center', false); });
        ctx.globalAlpha = fade;
        text('左', vw / 2 - cw - gap, y0 + u * 8.4, u * 2.4); text('中', vw / 2, y0 + u * 8.4, u * 2.4); text('右', vw / 2 + cw + gap, y0 + u * 8.4, u * 2.4);
        ctx.globalAlpha = 1;
      } else text(`加速拱門在${'左中右'[q.ans]}邊`.replace('中邊', '中間'), vw / 2, qy, u * 4.6);
    }
    if (p.note && t - p.note.t < 1600) { ctx.globalAlpha = clamp((1600 - (t - p.note.t)) / 400, 0, 1); text(p.note.text, vw / 2, vh * 0.52, u * 6.2, p.note.good ? '#ffe45c' : '#ff8a8a'); ctx.globalAlpha = 1; }
    // 右下：方向盤與油門
    const wr = u * 6.5, wx = vw - u * 10, wy = vh - u * 10;
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(p.steer * 1.1);
    ctx.strokeStyle = 'rgba(20,24,40,.8)'; ctx.lineWidth = u * 2.4; ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 1.5; ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.moveTo(-wr, 0); ctx.lineTo(wr, 0); ctx.moveTo(0, 0); ctx.lineTo(0, wr); ctx.stroke();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, -wr, u * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const gx = vw - u * 23, gh = u * 14, gy = vh - u * 3.5 - gh, sp = clamp(p.v / MAXV, 0, 1.35) / 1.35;
    ctx.fillStyle = 'rgba(20,24,40,.7)'; rrect(gx, gy, u * 3.2, gh, u); ctx.fill();
    ctx.fillStyle = t < p.boostT ? '#ffe45c' : '#34c77b'; rrect(gx + u * 0.5, gy + u * 0.5 + (gh - u) * (1 - sp), u * 2.2, (gh - u) * sp, u * 0.7); ctx.fill();
    if (R.gas !== 'auto') { ctx.fillStyle = '#fff'; ctx.fillRect(gx - u * 0.6, gy + u * 0.5 + (gh - u) * (1 - clamp(p.gas, 0, 1) / 1.35) - u * 0.2, u * 4.4, u * 0.4); } // 白線：目前油門踩多深
    // 道具格：手上的道具
    const isz = u * 10, ix = vw - u * 31.5, iy = vh - u * 9;
    ctx.fillStyle = 'rgba(20,24,40,.7)'; rrect(ix - isz / 2, iy - isz / 2, isz, isz, u * 2); ctx.fill();
    ctx.strokeStyle = p.item ? ITEMS[p.item].color : 'rgba(255,255,255,.35)'; ctx.lineWidth = u * 0.6; ctx.stroke();
    if (p.item) {
      drawIcon(p.item, ix, iy, isz * 0.8 * (1 + 0.4 * clamp(1 - (t - p.itemAt) / 300, 0, 1)));
      text(ITEMS[p.item].name, ix, iy - isz / 2 - u * 2, u * 2.8);
      if (R.phase === 'race' && !p.fin) text(live || !state.test ? '雙手舉高使用' : `按 ${KB[p.i][3].replace('arrowdown', '↓').toUpperCase()} 使用`, ix, iy + isz / 2 + u * 1.8, u * 2.2, '#ffe45c');
    } else text('道具', ix, iy, u * 2.4, 'rgba(255,255,255,.45)', 'center', false);
    if (R.gas === 'step') { // 兩隻腳的燈：每踏一步亮一下
      const lit = now - s.lastStep < 160;
      for (const sd of [-1, 1]) { ctx.fillStyle = lit && s.side === sd ? '#ffe45c' : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(gx + u * 1.6 + sd * u * 1.6, gy - u * 2.2, u * 1.1, u * 1.7, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // 左下：玩家自己的小畫面，確認鏡頭有沒有拍到手（踏步模式還要拍到膝蓋）
    const src = getSource(), [sw, sh] = srcSize();
    if (live && s.box && sw && !state.test) {
      const b = s.box, bw2 = Math.min(sw, b.w * 1.5), bh2 = Math.min(sh, b.h * 1.12), sx = clamp(b.x - bw2 / 2, 0, sw - bw2), sy = clamp(b.y - bh2 / 2, 0, sh - bh2);
      const ph = vh * 0.3, pw = Math.min(ph * bw2 / bh2, vw * 0.3), px = u * 2, py = vh - ph - u * 2, good = s.hands && (s.legs || R.gas !== 'step');
      ctx.save(); rrect(px, py, pw, ph, u * 1.2); ctx.clip();
      ctx.translate(px + pw, py); ctx.scale(-1, 1); // 鏡像
      try { ctx.drawImage(src, sx, sy, bw2, bh2, 0, 0, pw, ph); } catch (e) { /* 影像還沒準備好 */ }
      const dot = (pt, c, th) => { if (pt.v < th) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc((pt.x - sx) / bw2 * pw, (pt.y - sy) / bh2 * ph, u * 1.1, 0, Math.PI * 2); ctx.fill(); };
      if (s.hands) { ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = u * 0.8; ctx.beginPath(); ctx.moveTo((s.pts.lw.x - sx) / bw2 * pw, (s.pts.lw.y - sy) / bh2 * ph); ctx.lineTo((s.pts.rw.x - sx) / bw2 * pw, (s.pts.rw.y - sy) / bh2 * ph); ctx.stroke(); }
      dot(s.pts.lw, '#ffe45c', 0.35); dot(s.pts.rw, '#ffe45c', 0.35); if (R.gas === 'step') { dot(s.pts.lk, '#5cff9d', 0.4); dot(s.pts.rk, '#5cff9d', 0.4); }
      ctx.restore();
      ctx.strokeStyle = good ? '#5cff9d' : '#ffb347'; ctx.lineWidth = u * 0.6; rrect(px, py, pw, ph, u * 1.2); ctx.stroke();
      const warn = !s.hands ? '看不到雙手' : !s.legs && R.gas === 'step' ? '看不到膝蓋，請退後一點' : '';
      if (warn) text(warn, px, py - u * 2.2, u * 2.6, '#ffb347', 'left');
    } else if (!state.test && R.phase !== 'over') text('找不到玩家，請站到鏡頭前', u * 2.5, vh - u * 4, u * 2.8, '#ffb347', 'left');
    if (R.phase === 'idle') { text(`◀　${p.kart.name}・${p.kart.trait}　▶`, vw / 2, vh * 0.745, u * 3.6, '#ffe45c'); if (!state.test) text('方向盤往左或往右打到底，換一台車', vw / 2, vh * 0.745 + u * 4, u * 2.3); }
    // 跑完的成績
    if (p.fin || R.phase === 'over') {
      const pw = Math.min(vw * 0.8, u * 62), ph = u * 34, px = (vw - pw) / 2, py = vh * 0.5 - ph / 2;
      ctx.fillStyle = 'rgba(20,24,40,.82)'; rrect(px, py, pw, ph, u * 2.5); ctx.fill();
      if (!p.fin) text('沒跑完', vw / 2, py + u * 9, u * 7, '#ffb347');
      else {
        const win = R.n > 1 && R.players.filter(q => q.fin).sort((a, b) => a.fin - b.fin)[0] === p;
        text(win ? `第 ${p.rank} 名　獲勝！` : `第 ${p.rank} 名`, vw / 2, py + u * 7, u * 6.5, p.rank === 1 || win ? '#ffe45c' : '#fff');
        if ((p.rank === 1 || win) && IMGS['item-trophy']) { drawIcon('trophy', px + u * 7, py + u * 8, u * 11); drawIcon('trophy', px + pw - u * 7, py + u * 8, u * 11); }
        text(`${p.time.toFixed(1)} 秒`, vw / 2, py + u * 15.5, u * 5.5);
        if (lv !== 'off') text(`答對 ${p.right} 題　答錯 ${p.wrong} 題`, vw / 2, py + u * 22, u * 3.2, '#cfe3ff');
        text(p.record ? `破紀錄！最佳 ${p.best.toFixed(1)} 秒` : `最佳紀錄 ${p.best.toFixed(1)} 秒`, vw / 2, py + u * 26.5, u * 3, p.record ? '#ffe45c' : '#cfe3ff');
      }
      if (R.phase === 'over') text(state.test ? '按空白鍵再玩一次' : '雙手舉高，再玩一次', vw / 2, py + u * 31, u * 2.8, '#fff');
    }
  }

  // ── 主迴圈（每一格畫面呼叫一次）──
  function tick(t, dt) {
    const W = innerWidth, H = innerHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const now = performance.now();
    // 開始手勢：還沒開始或跑完時，任何一位玩家雙手舉過頭 0.7 秒
    if (R.phase === 'idle' || (R.phase === 'over' && t - R.overAt > 3000)) {
      const up = inp.some(s => now - s.seen < 500 && s.up);
      if (!up) upSince = 0; else if (!upSince) upSince = t; else if (t - upSince > 700) start();
    }
    if (R.phase === 'idle') for (const p of R.players) { // 還沒開始時，把方向盤往左或往右打到底停 0.4 秒＝換一台車
      const s = inp[p.i], dir = now - s.seen < 500 && s.hands && !s.up ? (s.steer > 0.75 ? 1 : s.steer < -0.75 ? -1 : 0) : 0;
      if (!dir) { p.pickAt = 0; if (Math.abs(s.steer) < 0.3 || now - s.seen >= 500) p.pickLatch = false; continue; }
      if (!p.pickAt) p.pickAt = t;
      if (!p.pickLatch && t - p.pickAt > 400) { p.pickLatch = true; setKart(p, (opt.karts[p.i] + dir + KARTS.length) % KARTS.length); }
    }
    if (R.phase === 'count' && t - R.countAt >= 3000) { R.phase = 'race'; R.t0 = t; }
    if (R.phase === 'race') {
      const humans = R.players, done = humans.every(p => p.fin);
      if (done || (R.firstFin && t - R.firstFin > 20000) || t - R.t0 > CFG.raceTimeout * 1000) { R.phase = 'over'; R.overAt = t; }
    }
    update(t, dt);
    if (R.firstFin && t - R.firstFin < 6000 && t >= nextFw) { launch('gold'); launch('color'); nextFw = t + 350 + Math.random() * 300; } // 有人衝過終點：放煙火

    ctx.clearRect(0, 0, W, H);
    // 1 人整個畫面；2、3 人左右並排；4 人田字形
    const n = R.n, hw = Math.floor(W / 2), hh = Math.floor(H / 2), col = i => Math.floor(i * W / n);
    const cells = n === 4 ? [[0, 0, hw, hh], [hw, 0, W - hw, hh], [0, hh, hw, H - hh], [hw, hh, W - hw, H - hh]] : Array.from({ length: n }, (_, i) => [col(i), 0, col(i + 1) - col(i), H]);
    cells.forEach((c, i) => view(R.players[i], c[0], c[1], c[2], c[3], t));
    ctx.fillStyle = '#fff';
    if (n === 4) { ctx.fillRect(hw - 3, 0, 6, H); ctx.fillRect(0, hh - 3, W, 6); } else for (let i = 1; i < n; i++) ctx.fillRect(col(i) - 3, 0, 6, H);
    const u = Math.min(W, H * 1.2) / 100;
    if (R.phase === 'idle') { // 玩法說明
      const lines = state.test ? ['測試模式（不用鏡頭）', ...KB_NAME.slice(0, R.n).map((k, i) => `${i + 1}P：${k}`), '按空白鍵開始']
        : ['雙手握方向盤，左右傾斜就轉彎', R.gas === 'high' ? '方向盤拿高就加速，放低就減速' : R.gas === 'step' ? '原地踏步加速，踏越快車越快' : '油門自動，專心轉彎就好', LEVELS_HINT(), '開過寶箱或答對會拿到道具，雙手舉高使用', '雙手舉高，開始！'];
      const pw = u * 82, ph = u * (10 + lines.length * 7), px = (W - pw) / 2, py = Math.max(H * 0.42 - ph / 2, u * 2); // 放高一點，下面才看得到自己的車和車名
      ctx.fillStyle = 'rgba(20,24,40,.82)'; rrect(px, py, pw, ph, u * 3); ctx.fill();
      lines.forEach((l, i) => text(l, W / 2, py + u * (8.5 + i * 7), u * (i === lines.length - 1 ? 5 : 4), i === lines.length - 1 ? '#ffe45c' : '#fff'));
      if (upSince) { ctx.fillStyle = '#ffe45c'; rrect(px + u * 4, py + ph - u * 2.4, (pw - u * 8) * clamp((t - upSince) / 700, 0, 1), u * 1.2, u); ctx.fill(); }
    } else if (R.phase === 'count') {
      text(String(3 - Math.floor((t - R.countAt) / 1000)), W / 2, H * 0.45, u * 30, '#ffe45c');
    } else if (R.phase === 'race' && t - R.t0 < 900) text('出發！', W / 2, H * 0.45, u * 18, '#ffe45c');
  }
  function setKart(p, k) { opt.karts[p.i] = k; p.kart = KARTS[k]; p.img = KARTS[k].img; $('ctl').innerHTML = ctl(); }
  const LEVELS_HINT = () => R.levels.slice(0, R.n).every(l => l === 'off') ? '開過「加速」拱門會衝刺' : '開過正確答案的閘門會衝刺';

  reset();
  window.__race = { input, makeQ, start, opt, segs: () => segs, gates: () => gates, boxRows: () => boxRows, finishIdx: () => finishIdx, inp: () => inp, SEG, MAXV, ITEMS, TRACKS,
    KARTS, setKart: (i, k) => setKart(R.players[i], k), roll: i => giveItem(R.players[i], performance.now(), ''), give: (i, k) => { const p = R.players[i]; p.item = k; p.itemAt = performance.now(); }, use: i => useItem(R.players[i], performance.now()) };
  return { ctl, action, reset, input, tick, key };
}
