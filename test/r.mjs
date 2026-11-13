// 鏡頭數學賽車的自動檢查：用無頭 Chrome 把每一條操作路徑跑一遍（鍵盤、閘門、終點、按鈕、多人、題庫、合成姿態、道具、賽道、選車、鏡頭與辨識）
// 用法：先啟動本機伺服器（python3 server.py 8932），再執行　node test/r.mjs <放截圖的資料夾> [網址]
// 需要 Node 22 以上與 Google Chrome（路徑寫的是 Mac 的位置，其他系統請自行修改）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const S = process.argv[2] || '/tmp/camera-kart-test', BASE = process.argv[3] || 'http://localhost:8932/index.html';
fs.mkdirSync(`${S}/shots`, { recursive: true });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9377',
  `--user-data-dir=${S}/prof-r`, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--window-size=1280,720', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); let errs = 0;
for (let i = 0; i < 40; i++) { try { const l = await (await fetch('http://127.0.0.1:9377/json')).json();
  ws = new WebSocket(l.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); break; } catch { await sleep(250); } }
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') { errs++; console.log('  [EXC]', (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 400)); }
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) { errs++; console.log('  [console.' + d.params.type + ']', d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); } };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) console.log('  [EVAL ERR]', r.result.exceptionDetails.exception?.description?.slice(0, 300)); return r.result?.result?.value; };
const J = async e => JSON.parse(await ev(e));
const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, ' ': 32, j: 74, l: 76, i: 73, k: 75, a: 65, d: 68, w: 87, s: 83, 4: 52, 6: 54, 8: 56, 5: 53 };
const kd = k => cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: VK[k] });
const ku = k => cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: VK[k] });
const shot = async n => { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(`${S}/shots/${n}.jpg`, Buffer.from(r.result.data, 'base64')); };
const go = async u => { await cmd('Page.navigate', { url: BASE + u }); await sleep(1500); };
const clickSel = async sel => { await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 400 }); await sleep(120); const r = await J(`(() => { const e = document.querySelector('${sel}'); const b = e.getBoundingClientRect(); const x = b.x + b.width/2, y = b.y + b.height/2; return JSON.stringify({x, y, hit: document.elementFromPoint(x, y) === e}); })()`);
  await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y }); await sleep(80);
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 }); await sleep(250); return r.hit; };
await cmd('Runtime.enable'); await cmd('Page.enable');
const rs = () => J(`(() => { const R = __state.race, f = p => ({x:+p.x.toFixed(2), z:Math.round(p.z/200), v:+(p.v/__race.MAXV).toFixed(2), steer:+p.steer.toFixed(2), cad:+p.cad.toFixed(2), gate:p.gate, right:p.right, wrong:p.wrong, item:p.item, shield:p.shieldT > performance.now(), spin:p.spinT > performance.now(), boost:p.boostT > performance.now(), hint:p.hintGate, boxes:p.boxes.size, img:p.img, gas:+p.gas.toFixed(2), fin:!!p.fin, rank:p.rank, time:+p.time.toFixed(1), best:p.best, note:p.note?.text});
  return JSON.stringify({game:__state.game, ph:R.phase, n:R.n, levels:R.levels.join(','), gas:R.gas, P:R.players.map(f), ais:R.ais.map(a=>Math.round(a.z/200)), aiImgs:R.ais.map(a=>a.img).join(','), traps:R.traps.length, track:R.track, order:R.order.length,
  ctl:[...document.querySelectorAll('#ctl div')].map(e=>e.textContent).join('|'), raceShown:getComputedStyle(document.getElementById('race')).display, msg:document.getElementById('msg').textContent, test:__state.test}); })()`);
const ok = (name, cond, detail = '') => console.log((cond ? '  ✓ ' : '  ✗ ') + name + (detail ? '　' + detail : ''));
let s, a, b;

console.log('【1】進入與鍵盤操作');
await go('?test=1&game=race'); await ev(`localStorage.clear()`); await go('?test=1&game=race'); s = await rs();
ok('鍵盤試玩模式：直接進入賽車，不用等鏡頭', s.game === 'race' && s.raceShown === 'block' && s.test === true && s.msg === '', s.ctl);
ok('未開始：停在起跑線', s.ph === 'idle' && s.P.length === 1 && s.P[0].v === 0 && s.ais.length === 3); await shot('race_idle');
await kd('ArrowUp'); await sleep(600); s = await rs(); ok('未開始按加速不會動', s.P[0].z === 3 && s.ph === 'idle'); await ku('ArrowUp');
await kd(' '); await ku(' '); await sleep(300); s = await rs(); ok('空白鍵 → 倒數', s.ph === 'count'); await sleep(1200); await shot('race_count');
await sleep(1900); s = await rs(); ok('倒數 3 秒後出發', s.ph === 'race');
await sleep(1000); s = await rs(); ok('不踩油門不會動', s.P[0].z <= 4, 'z=' + s.P[0].z);
await kd('ArrowUp'); await sleep(2500); s = await rs(); ok('按住 ↑ 加速前進', s.P[0].v > 0.5 && s.P[0].z > 30, `v=${s.P[0].v} z=${s.P[0].z} 名次 ${s.P[0].rank} 電腦車 ${s.ais}`); await shot('race_run');
a = s.P[0].x; await kd('ArrowRight'); await sleep(500); await ku('ArrowRight'); s = await rs(); ok('→ 往右', s.P[0].x > a + 0.2, `${a} → ${s.P[0].x}`);
a = s.P[0].x; await kd('ArrowLeft'); await sleep(800); await ku('ArrowLeft'); s = await rs(); ok('← 往左', s.P[0].x < a - 0.3, `${a} → ${s.P[0].x}`);

console.log('【2】答案閘門');
const toGate = async (pi, right) => { // 把車移到下一個閘門前，放到指定（對或錯）的車道
  return J(`(() => { const p = __state.race.players[${pi}], g = __race.gates()[p.gate], q = p.qs[p.gate], lane = ${right} ? q.ans : (q.ans + 1) % 3;
    p.z = (g - 12) * 200; p.x = [-0.66, 0, 0.66][lane]; p.v = __race.MAXV * 0.8; return JSON.stringify({ q: q.text, opts: q.opts, ans: q.ans, lane }); })()`); };
a = await toGate(0, true); await sleep(250); await shot('race_gate'); await sleep(500); s = await rs();
ok(`開過正確答案（${a.q} → ${a.opts[a.ans]}）→ 衝刺`, s.P[0].right === 1 && s.P[0].gate === 1 && s.P[0].v > 0.95, `v=${s.P[0].v}　${s.P[0].note}`); await shot('race_boost');
a = await toGate(0, false); await sleep(450); s = await rs();
ok(`開過錯的答案 → 減速、衝刺取消`, s.P[0].wrong === 1 && s.P[0].gate === 2 && s.P[0].v < 0.6, `v=${s.P[0].v}　${s.P[0].note}`); await shot('race_wrong');
await ev(`(() => { const p = __state.race.players[0], g = __race.gates()[p.gate]; p.z = (g - 6) * 200; p.x = 1.5; })()`); await sleep(600); s = await rs();
ok('從草地繞過閘門 → 不算對也不算錯', s.P[0].right === 1 && s.P[0].wrong === 1 && s.P[0].gate === 3, s.P[0].note);
await sleep(1500); s = await rs(); ok('在草地上會慢下來', s.P[0].v <= 0.46, 'v=' + s.P[0].v);
await ev(`__state.race.players[0].x = 0`);

console.log('【3】電腦車與終點');
await ev(`(() => { const R = __state.race, a = R.ais[0], p = R.players[0]; p.x = a.lane; a.z = p.z + 3 * 200; a.v = __race.MAXV * 0.3; p.v = __race.MAXV * 0.9; })()`); await sleep(500); s = await rs();
ok('撞到電腦車車尾會被擋下來', s.P[0].v < 0.75 && s.P[0].z <= s.ais[0], `v=${s.P[0].v} 我 ${s.P[0].z} 電腦車 ${s.ais[0]}`);
await ev(`(() => { const p = __state.race.players[0]; p.x = 0.3; p.z = (__race.finishIdx() - 25) * 200; p.v = __race.MAXV; })()`); await sleep(1500); s = await rs();
ok('衝過終點 → 結束、有名次與時間', s.ph === 'over' && s.P[0].fin && s.P[0].rank >= 1 && s.P[0].time > 0, `第 ${s.P[0].rank} 名 ${s.P[0].time} 秒　最佳 ${s.P[0].best}`); await ku('ArrowUp'); await sleep(800); await shot('race_over');
ok('最佳紀錄有存起來', +(await ev(`localStorage.getItem('handsup-race-best-mul-high')`)) > 0);
await kd(' '); await ku(' '); await sleep(300); s = await rs(); ok('空白鍵再玩一次', s.ph === 'count' && s.P[0].z === 3 && s.P[0].best > 0);

console.log('【4】按鈕');
ok('按「人數」→ 2 人', await clickSel('#ctl [data-a="race:n"]')); s = await rs(); ok(' 變成雙人、回到未開始', s.n === 2 && s.P.length === 2 && s.ph === 'idle' && s.ais.length === 2, s.ctl);
await clickSel('#ctl [data-a="race:lv1"]'); s = await rs(); ok('2P 題目切到下一種', s.levels.startsWith('mul,prime'), s.levels);
await clickSel('#ctl [data-a="race:lv0"]'); await clickSel('#ctl [data-a="race:lv0"]'); await clickSel('#ctl [data-a="race:lv0"]'); s = await rs(); ok('1P 題目循環到加減', s.levels.startsWith('add,prime'), s.levels);
await clickSel('#ctl [data-a="race:gas"]'); s = await rs(); ok('油門：拿高 → 踏步', s.gas === 'step', s.ctl);
await clickSel('#ctl [data-a="race:gas"]'); s = await rs(); ok('油門：踏步 → 自動', s.gas === 'auto', s.ctl);
ok('按「開始／重來」', await clickSel('#ctl [data-a="race:start"]')); s = await rs(); ok(' → 倒數', s.ph === 'count');
await sleep(4500); s = await rs(); ok('自動油門：兩台車不用按就會跑', s.P[0].v > 0.3 && s.P[1].v > 0.3, `v=${s.P[0].v},${s.P[1].v}`);
a = s.P[1].x; await kd('l'); await sleep(500); await ku('l'); s = await rs(); ok('2P 按 L 往右，1P 不受影響', s.P[1].x > a + 0.15 && Math.abs(s.P[0].steer) < 0.05, `${a} → ${s.P[1].x}`);
await sleep(600); await shot('race_2p');
a = await toGate(1, true); await sleep(700); s = await rs(); ok(`2P 答對質數題（${a.q} → ${a.opts[a.ans]}）`, s.P[1].right === 1 && s.P[0].right === 0);
await ev(`(() => { const p = __state.race.players[0]; p.z = (__race.finishIdx() - 20) * 200; p.x = -0.4; })()`); await sleep(1800); s = await rs();
ok('1P 先到終點、2P 還在跑', s.P[0].fin && !s.P[1].fin && s.ph === 'race'); await shot('race_2p_fin');
await ev(`(() => { const p = __state.race.players[1]; p.z = (__race.finishIdx() - 20) * 200; p.x = 0.4; })()`); await sleep(1800); s = await rs();
ok('2P 也到終點 → 結束', s.ph === 'over' && s.P[1].fin && s.P[1].rank > s.P[0].rank, `名次 ${s.P[0].rank}, ${s.P[1].rank}`);
await clickSel('#ctl [data-a="race:gas"]'); for (let i = 0; i < 3; i++) await clickSel('#ctl [data-a="race:n"]');
for (let i = 0; i < 3; i++) await clickSel('#ctl [data-a="race:lv0"]'); s = await rs(); ok('油門回到拿高、人數繞一圈回到 1 人、切到「不出題」', s.levels.startsWith('off') && s.n === 1 && s.gas === 'high', s.ctl);
await kd(' '); await ku(' '); await sleep(3300); await kd('ArrowUp'); a = await toGate(0, true); await sleep(250); await shot('race_off_gate'); await sleep(500); s = await rs();
ok('不出題：開過加速拱門會衝刺', s.P[0].gate === 1 && s.P[0].v > 0.95, `${s.P[0].note}`);
a = await toGate(0, false); await sleep(700); s = await rs(); ok('不出題：沒開過拱門不會被罰', s.P[0].wrong === 0 && s.P[0].gate === 2 && s.P[0].v > 0.6, 'v=' + s.P[0].v); await ku('ArrowUp');

console.log('【5】題庫（每種各出 2000 題）');
for (const lv of ['add', 'mul', 'prime']) {
  const r = await J(`(() => { const isP = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }; let bad = 0, n = 0; const ex = [], pos = [0, 0, 0];
    for (let k = 0; k < 2000; k++) { const q = __race.makeQ('${lv}'); n++; pos[q.ans]++; let good;
      if (q.opts.length !== 3 || new Set(q.opts).size !== 3 || q.opts.some(v => !Number.isInteger(v) || v < 0)) good = false;
      else if ('${lv}' === 'prime') { const m = q.text.match(/(\\d+) 的倍數/); const f = m ? (v => v % +m[1] === 0) : isP; good = q.opts.filter(f).length === 1 && f(q.opts[q.ans]); }
      else { const m = q.text.match(/(\\d+) ([+−×]) (\\d+)/), x = +m[1], y = +m[3], v = m[2] === '+' ? x + y : m[2] === '−' ? x - y : x * y; good = q.opts[q.ans] === v && ('${lv}' !== 'add' || (v <= 20 && v >= 0)); }
      if (!good) { bad++; if (ex.length < 3) ex.push(q); } else if (ex.length < 2 && k < 2) ex.push(q); }
    return JSON.stringify({ n, bad, pos, ex }); })()`);
  ok(`${lv}：答案都正確且只有一個`, r.bad === 0, `正解位置（左中右）${r.pos}　例：${r.ex.map(q => q.text + ' ' + q.opts.join('/')).join('；')}`);
}

console.log('【6】合成姿態：方向盤、踏步、雙手舉高');
await go('?test=1&game=race&gas=step');
const MK = `window.__mk = (cx, cy, H, o = {}) => { const kp = new Float32Array(51), set = (i, x, y, v = 0.9) => { kp[i*3] = x; kp[i*3+1] = y; kp[i*3+2] = v; };
  const sw = H * 0.22, top = cy - H / 2, a = o.tilt || 0, hw = sw * 0.6, wy = top + H * (o.up ? 0 : o.hold ?? 0.35), lift = o.lift || 0;
  set(0, cx, top + H * 0.08); set(5, cx + sw / 2, top + H * 0.2); set(6, cx - sw / 2, top + H * 0.2);
  set(9, cx + hw * Math.cos(a), wy + hw * Math.sin(a), o.noHands ? 0.1 : 0.9); set(10, cx - hw * Math.cos(a), wy - hw * Math.sin(a), o.noHands ? 0.1 : 0.9);
  set(11, cx + sw * 0.35, top + H * 0.52); set(12, cx - sw * 0.35, top + H * 0.52);
  const lv = o.noLegs ? 0.1 : 0.9;
  set(13, cx + sw * 0.3, top + H * 0.75 - Math.max(0, lift) * H, lv); set(14, cx - sw * 0.3, top + H * 0.75 - Math.max(0, -lift) * H, lv);
  set(15, cx + sw * 0.3, top + H * 0.95 - Math.max(0, lift) * H * 1.5, lv); set(16, cx - sw * 0.3, top + H * 0.95 - Math.max(0, -lift) * H * 1.5, lv);
  return { x: cx, y: cy, w: H * 0.4, h: H, conf: 0.9, kp }; };
  window.__feed = null; window.__pin = false; setInterval(() => { if (window.__feed) __race.input(window.__feed(performance.now()), 1280, 720); if (window.__pin) __state.race.players[0].x = 0; }, 33);`;
await ev(MK);
const inp = () => J(`JSON.stringify(__race.inp().map(s => ({ steer: +s.steer.toFixed(2), hands: s.hands, legs: s.legs, up: s.up, rate: +s.rate.toFixed(2) })))`);
await ev(`__feed = () => [__mk(640, 380, 560, { tilt: 0.35 })]`); await sleep(400); a = (await inp())[0]; s = await rs();
ok('左手低右手高 → 左轉', a.steer < -0.4 && s.P[0].steer < -0.3, `方向盤 ${a.steer}`);
await ev(`__feed = () => [__mk(640, 380, 560, { tilt: -0.35 })]`); await sleep(400); a = (await inp())[0]; ok('右手低左手高 → 右轉', a.steer > 0.4, `方向盤 ${a.steer}`);
await ev(`__feed = () => [__mk(640, 380, 560, { tilt: 0.04 })]`); await sleep(400); a = (await inp())[0]; ok('歪一點點（2 度）→ 直走', a.steer === 0);
await ev(`__feed = () => [__mk(640, 380, 560, { tilt: -0.9 })]`); await sleep(400); a = (await inp())[0]; ok('歪超過 35 度 → 打到底，不會超過 1', a.steer === 1);
await ev(`__feed = () => [__mk(640, 380, 560, { noHands: true })]`); await sleep(500); a = (await inp())[0]; s = await rs(); ok('看不到雙手 → 方向盤回正', !a.hands && Math.abs(s.P[0].steer) < 0.05);
await ev(`__feed = () => [__mk(640, 380, 560, { up: true })]`); await sleep(400); s = await rs(); ok('雙手舉高不到 0.7 秒 → 還沒開始', s.ph === 'idle');
await sleep(600); s = await rs(); ok('雙手舉高 0.7 秒 → 倒數', s.ph === 'count'); await ev(`__feed = () => [__mk(640, 380, 560)]`); await sleep(3200); s = await rs(); ok(' → 出發', s.ph === 'race');
await ev(`__state.race.ais.forEach(a => { a.lane = 6; }); __state.race.players[0].gate = __race.gates().length; __pin = true`); // 電腦車移到場外、車子固定在路中央、閘門當作都過了（不然開過閘門會衝刺或減速，結果看運氣），單獨量踏步與車速的關係
await ev(`__feed = t => [__mk(640 + Math.sin(t / 37) * 3, 380, 560, { lift: Math.sin(t / 53) * 0.006 })]`); await sleep(2000); s = await rs(); a = (await inp())[0];
ok('站著不動（關節有小抖動）→ 車不會動', s.P[0].v < 0.03 && a.rate === 0, `v=${s.P[0].v}`);
for (const [sps, lo, hi] of [[1.5, 0.45, 0.7], [2.6, 0.85, 1.01]]) {
  await ev(`__feed = t => [__mk(640, 380, 560, { lift: (Math.floor(t / ${1000 / sps}) % 2 ? 1 : -1) * 0.06 })]`); await sleep(5000); s = await rs();
  ok(`每秒踏 ${sps} 步 → 油門約 ${(sps / 2.6 * 100).toFixed(0)}%`, s.P[0].cad > sps * 0.85 && s.P[0].cad < sps * 1.15 && s.P[0].v > lo && s.P[0].v < hi, `偵測到每秒 ${s.P[0].cad} 步，車速 ${s.P[0].v}`);
}
await shot('race_pose');
await ev(`__feed = () => [__mk(640, 380, 560)]`); await sleep(3500); s = await rs(); ok('停止踏步 → 慢慢停下來', s.P[0].cad < 0.1 && s.P[0].v < 0.4, `每秒 ${s.P[0].cad} 步，車速 ${s.P[0].v}`);
await ev(`__feed = t => [__mk(640, 380, 560, { noLegs: true, lift: (Math.floor(t / 400) % 2 ? 1 : -1) * 0.06 })]`); await sleep(2500); a = (await inp())[0]; s = await rs(); ok('看不到膝蓋 → 不會亂加速', !a.legs && s.P[0].cad < 0.1);
await ev(`__feed = null; __pin = false`); await clickSel('#ctl [data-a="race:n"]');
await ev(`__feed = () => [__mk(900, 380, 500, { tilt: 0.35 }), __mk(380, 380, 500, { tilt: -0.35 }), __mk(640, 300, 120, { tilt: 0.5 })]`); await sleep(500); a = await inp();
ok('雙人：畫面左邊（原始影像右邊）的人是 1P；後面的小人不算', a[0].steer < -0.4 && a[1].steer > 0.4, `1P ${a[0].steer}　2P ${a[1].steer}`);
await ev(`__feed = () => [__mk(380, 380, 500, { tilt: -0.35 })]`); await sleep(500); a = await inp(); ok('雙人只剩右邊一個人 → 他還是 2P', !a[0].hands && a[1].steer > 0.4);
await ev(`__feed = null`);

console.log('【8】拿高油門（合成姿態）');
await go('?test=1&game=race'); await ev(MK); s = await rs();
ok('預設油門是「拿高」', s.gas === 'high' && s.ctl.includes('油門：拿高'), s.ctl);
const startRace = async () => { await kd(' '); await ku(' '); await sleep(3300); };
const solo = () => ev(`__state.race.ais.forEach(a => { a.lane = 6; }); __state.race.players.forEach(p => { p.gate = __race.gates().length; p.boxes = new Set(__race.boxRows().map((_, i) => i)); }); __pin = true`); // 電腦車移開、閘門與寶箱當作都過了，單獨量油門
await startRace(); await solo();
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.2 })]`); await sleep(3500); s = await rs();
ok('方向盤舉到肩膀高度 → 全速', s.P[0].gas > 0.95 && s.P[0].v > 0.8, `油門 ${s.P[0].gas}　車速 ${s.P[0].v}`);
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.33 })]`); await sleep(3000); s = await rs();
ok('方向盤在胸口 → 大約一半的油門', s.P[0].gas > 0.4 && s.P[0].gas < 0.7 && s.P[0].v > 0.35 && s.P[0].v < 0.75, `油門 ${s.P[0].gas}　車速 ${s.P[0].v}`);
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.46 })]`); await sleep(4000); s = await rs();
ok('方向盤放低到肚子 → 不加速，慢慢停', s.P[0].gas < 0.03 && s.P[0].v < 0.25, `油門 ${s.P[0].gas}　車速 ${s.P[0].v}`);
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.2, noLegs: true })]`); await sleep(2500); s = await rs();
ok('拍不到腿也能玩（只需要上半身）', s.P[0].gas > 0.95 && s.P[0].v > 0.5, `油門 ${s.P[0].gas}　車速 ${s.P[0].v}`);
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.2, noHands: true })]`); await sleep(1200); s = await rs();
ok('看不到雙手 → 不加速', s.P[0].gas < 0.05, `油門 ${s.P[0].gas}`);
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.2, tilt: 0.35 })]`); await sleep(600); s = await rs();
ok('拿高的同時可以轉彎', s.P[0].gas > 0.9 && s.P[0].steer < -0.3, `油門 ${s.P[0].gas}　方向盤 ${s.P[0].steer}`); await shot('race_high');

console.log('【9】道具');
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.2 })]`); await sleep(300);
await ev(`__race.give(0, 'boost')`); await sleep(400); s = await rs(); ok('手上有道具時，不舉手不會用掉', s.P[0].item === 'boost' && !s.P[0].boost); await shot('race_item_hold');
await ev(`__feed = () => [__mk(640, 380, 560, { up: true })]`); await sleep(120); s = await rs(); ok('雙手舉高不到 0.25 秒 → 還沒用', s.P[0].item === 'boost');
await sleep(400); s = await rs(); ok('雙手舉高 → 用掉「衝刺」，開始衝刺', s.P[0].item === null && s.P[0].boost && s.P[0].v > 0.9, `車速 ${s.P[0].v}　${s.P[0].note}`); await shot('race_item_boost');
await ev(`__race.give(0, 'shield')`); await sleep(500); s = await rs(); ok('手一直舉著不放：新拿到的道具不會馬上被用掉', s.P[0].item === 'shield' && !s.P[0].shield);
await ev(`__feed = () => [__mk(640, 380, 560, { hold: 0.2, tilt: 0.9 })]`); await sleep(500); s = await rs(); ok('方向盤打到底（一手高一手低）不算舉手', s.P[0].item === 'shield');
await ev(`__feed = null; __pin = false`); await sleep(600);
// 以下用鍵盤（測試模式）：↓ 用道具
await kd('ArrowUp'); await kd('ArrowDown'); await sleep(150); await ku('ArrowDown'); s = await rs(); ok('按 ↓ 使用「護盾」', s.P[0].item === null && s.P[0].shield, s.P[0].note);
await ev(`__state.race.players[0].gate = 2`); a = await toGate(0, false); await sleep(500); s = await rs();
ok('有護盾：答錯不會減速（但還是算答錯）', s.P[0].wrong === 1 && s.P[0].v > 0.7 && /護盾/.test(s.P[0].note), `車速 ${s.P[0].v}　${s.P[0].note}`); await shot('race_item_shield');
await ev(`(() => { const R = __state.race, a = R.ais[0], p = R.players[0]; a.lane = 0; a.x = 0; p.x = 0; a.z = p.z + 3 * 200; a.v = __race.MAXV * 0.3; p.v = __race.MAXV * 0.9; p.shieldT = performance.now() + 5000; })()`); await sleep(700); s = await rs();
ok('有護盾：撞到電腦車會直接穿過去', s.P[0].z > s.ais[0] && s.P[0].v > 0.6, `我 ${s.P[0].z} 電腦車 ${s.ais[0]} 車速 ${s.P[0].v}`);
await ev(`(() => { const p = __state.race.players[0]; p.shieldT = 0; p.item = null; p.gate = 3; __race.give(0, 'hint'); })()`); await kd('ArrowDown'); await sleep(120); await ku('ArrowDown'); s = await rs();
ok('使用「提示」→ 下一個閘門的正解會亮起來', s.P[0].item === null && s.P[0].hint === 3, s.P[0].note);
a = await toGate(0, true); await sleep(200); await shot('race_item_hint'); await sleep(600); s = await rs(); ok('過了那個閘門，提示就結束', s.P[0].hint === -1 && s.P[0].gate === 4);
ok('答對閘門 → 另外拿到一個道具', s.P[0].item !== null && s.P[0].right >= 1, `拿到 ${s.P[0].item}　${s.P[0].note}`);
b = s.P[0].item; a = await toGate(0, true); await sleep(700); s = await rs(); ok('手上已經有道具：答對只衝刺，不會換掉', s.P[0].item === b && s.P[0].boost);
// 寶箱
await ev(`(() => { const p = __state.race.players[0]; p.item = null; p.boxes = new Set(); p.gate = __race.gates().length; p.z = (__race.boxRows()[3] - 8) * 200; p.x = 0.66; p.v = __race.MAXV * 0.8; })()`); await sleep(120); await shot('race_boxes'); await sleep(500); s = await rs();
ok('開過寶箱 → 拿到道具，那排寶箱消失', s.P[0].item !== null && s.P[0].boxes === 1, `拿到 ${s.P[0].item}`);
b = s.P[0].item; await ev(`(() => { const p = __state.race.players[0]; p.z = (__race.boxRows()[4] - 6) * 200; p.x = 0; p.v = __race.MAXV * 0.8; })()`); await sleep(500); s = await rs();
ok('手上已經有道具：開過寶箱拿不到，寶箱留著', s.P[0].item === b && s.P[0].boxes === 1);
await ev(`(() => { const p = __state.race.players[0]; p.item = null; p.z = (__race.boxRows()[5] - 6) * 200; p.x = 0.33; p.v = __race.MAXV * 0.8; window.__hold = setInterval(() => { p.x = 0.33; }, 16); })()`); await sleep(500); await ev(`clearInterval(__hold)`); s = await rs();
ok('從兩個寶箱中間穿過去 → 拿不到', s.P[0].item === null && s.P[0].boxes === 1); await ku('ArrowUp');
// 陷阱要兩個人
await go('?test=1&game=race&players=2'); await startRace();
await ev(`(() => { const R = __state.race, [p, q] = R.players; R.ais.forEach(a => { a.lane = 6; }); for (const c of [p, q]) { c.gate = __race.gates().length; c.boxes = new Set(__race.boxRows().map((_, i) => i)); } p.x = 0; q.x = 0; p.z = 120 * 200; q.z = 100 * 200; __race.give(0, 'trap'); })()`);
await kd('ArrowDown'); await sleep(120); await ku('ArrowDown'); s = await rs(); a = await J(`JSON.stringify(__state.race.traps.map(t => ({ x: +t.x.toFixed(2), seg: Math.round(t.z / 200), owner: t.owner })))`);
ok('1P 使用「香蕉皮」→ 車後留下一塊香蕉皮', s.traps === 1 && a[0].owner === 0 && a[0].seg >= 117 && a[0].seg <= 120 && s.P[0].item === null, JSON.stringify(a));
await ev(`(() => { const q = __state.race.players[1]; q.z = (${a[0].seg} - 10) * 200; q.x = ${a[0].x}; q.v = __race.MAXV * 0.9; })()`); await kd('i'); await sleep(150); await shot('race_item_trap'); await sleep(500); s = await rs();
ok('2P 開過香蕉皮 → 打滑減速，香蕉皮消失', s.P[1].spin && s.P[1].v < 0.5 && s.traps === 0 && /香蕉皮/.test(s.P[1].note), `2P 車速 ${s.P[1].v}　${s.P[1].note}`); await ku('i');
ok('丟香蕉皮的人自己不受影響', !s.P[0].spin);
await sleep(700); s = await rs(); ok('打滑持續 1.5 秒：1.2 秒時還在滑', s.P[1].spin); await sleep(600); s = await rs(); ok(' 1.8 秒時已經恢復', !s.P[1].spin);
ok('踩到香蕉皮會往右滑一個車道（中間 → 右邊）', Math.abs(s.P[1].x - (a[0].x + 0.67)) < 0.08, `x：${a[0].x} → ${s.P[1].x}`);
await ev(`(() => { const R = __state.race, a = R.ais[0]; a.lane = 0.5; a.x = 0.5; a.z = 200 * 200; a.v = __race.MAXV * 0.6; R.traps.push({ x: 0.5, z: 203 * 200, owner: 0, t: performance.now() }); })()`); await sleep(500);
a = await J(`JSON.stringify({ slip: __state.race.ais[0].slipT > performance.now(), traps: __state.race.traps.length, lane: +__state.race.ais[0].lane.toFixed(2) })`); ok('電腦車也會踩到香蕉皮，一樣往右滑一個車道', a.slip && a.traps === 0 && Math.abs(a.lane - 1.17) < 0.05, '車道 0.5 → ' + a.lane);
await ev(`(() => { const R = __state.race, q = R.players[1]; q.shieldT = performance.now() + 5000; q.spinT = 0; q.x = 0; q.z = 300 * 200; q.v = __race.MAXV * 0.9; R.traps.push({ x: 0, z: 303 * 200, owner: 0, t: performance.now() }); })()`); await kd('i'); await sleep(500); await ku('i'); s = await rs();
ok('有護盾：開過香蕉皮沒事', !s.P[1].spin && s.traps === 0 && /護盾/.test(s.P[1].note), s.P[1].note);
// 香蕉皮只佔一個車道
await ev(`(() => { const R = __state.race, [p, q] = R.players; R.traps.length = 0; p.x = 0.45; p.z = 420 * 200; p.v = 0; q.shieldT = 0; q.spinT = 0; q.slide = 0; __race.give(0, 'trap'); })()`); await kd('ArrowDown'); await sleep(120); await ku('ArrowDown');
a = await J(`JSON.stringify(__state.race.traps.map(t => ({ x: +t.x.toFixed(2), seg: Math.round(t.z / 200) })))`);
ok('車子偏在右車道（x=0.45）丟香蕉皮 → 落在右車道正中央（x=0.66）', a.length === 1 && a[0].x === 0.66, JSON.stringify(a));
await ev(`(() => { const q = __state.race.players[1]; q.z = (${a[0].seg} - 6) * 200; q.x = 0.2; q.v = __race.MAXV * 0.8; window.__hold = setInterval(() => { q.x = 0.2; }, 16); })()`); await kd('i'); await sleep(500); await ev(`clearInterval(__hold)`); s = await rs();
ok('開在中間車道的車經過 → 踩不到，香蕉皮還在', !s.P[1].spin && s.traps === 1, `2P 車速 ${s.P[1].v}`);
await ev(`(() => { const q = __state.race.players[1]; q.z = (${a[0].seg} - 6) * 200; q.x = 0.4; q.v = __race.MAXV * 0.8; })()`); await sleep(500); await ku('i'); s = await rs();
ok('開在右車道（即使沒對準正中央）→ 踩到', s.P[1].spin && s.traps === 0, s.P[1].note);
a = await J(`(() => { const R = __state.race, [p, q] = R.players; R.ais.forEach(c => { c.z = 900 * 200; }); p.z = 500 * 200; q.z = 400 * 200; q.gate = 0; const got = new Set(); for (let i = 0; i < 300; i++) { q.item = null; __race.roll(1); got.add(q.item); } const lastGot = [...got].sort().join(','); q.z = 600 * 200; const got2 = new Set(); for (let i = 0; i < 300; i++) { q.item = null; __race.roll(1); got2.add(q.item); } q.item = null; return JSON.stringify({ lastGot, notLast: [...got2].sort().join(',') }); })()`);
ok('最後一名不會抽到香蕉皮（後面沒車可以丟）；其他名次四種都會抽到', a.lastGot === 'boost,hint,shield' && a.notLast === 'boost,hint,shield,trap', `最後一名：${a.lastGot}　不是最後：${a.notLast}`);

// 撞到路邊的東西
await go('?test=1&game=race'); await startRace();
a = await J(`(() => { const R = __state.race, p = R.players[0], sg = __race.segs(); R.ais.forEach(c => { c.lane = 6; }); p.gate = 8; p.boxes = new Set([0,1,2,3,4,5,6,7,8]);
  const s = sg.find(x => x.i > 80 && x.props.some(pr => Math.abs(pr.off) < 1.75)), pr = s.props.find(pr => Math.abs(pr.off) < 1.75); for (const x of sg) x.curve = 0;
  p.z = (s.i - 4) * 200; p.x = pr.off; p.v = __race.MAXV * 0.4; window.__hold = setInterval(() => { p.x = pr.off; }, 16); return JSON.stringify({ seg: s.i, off: +pr.off.toFixed(2) }); })()`);
await kd('ArrowUp'); await sleep(450); s = await rs();
ok('開出路外撞到樹或石頭 → 幾乎停下來', s.P[0].spin && s.P[0].v < 0.2 && /撞到/.test(s.P[0].note), `撞的位置 x=${a.off}　車速 ${s.P[0].v}　${s.P[0].note}`); await shot('race_crash');
b = s.P[0].z; await sleep(450); s = await rs(); ok('撞到後的 1.5 秒內，踩油門也幾乎不動', s.P[0].spin && s.P[0].z - b <= 4, `0.45 秒只前進 ${s.P[0].z - b} 段`);
await sleep(400); s = await rs(); ok(' 1.3 秒時還沒恢復', s.P[0].spin);
await sleep(900); await ev(`clearInterval(__hold); __state.race.players[0].x = 0`); await sleep(1500); s = await rs(); ok('1.5 秒後恢復，可以再加速', !s.P[0].spin && s.P[0].v > 0.3, `車速 ${s.P[0].v}`); await ku('ArrowUp');
a = await J(`(() => { const R = __state.race, p = R.players[0], sg = __race.segs(); const s = sg.find(x => x.i > p.z / 200 + 20 && x.props.some(pr => Math.abs(pr.off) < 1.75)), pr = s.props.find(pr => Math.abs(pr.off) < 1.75);
  p.z = (s.i - 4) * 200; p.x = pr.off; p.v = __race.MAXV * 0.4; p.shieldT = performance.now() + 4000; window.__hold = setInterval(() => { p.x = pr.off; }, 16); return 1; })()`); await kd('ArrowUp'); await sleep(450); await ev(`clearInterval(__hold)`); s = await rs(); await ku('ArrowUp');
ok('有護盾：撞到路邊的東西不會停', !s.P[0].spin && /護盾/.test(s.P[0].note), s.P[0].note);

console.log('【10】3–4 人');
await go('?test=1&game=race&players=2'); await ev(MK);
await clickSel('#ctl [data-a="race:n"]'); s = await rs(); ok('人數 2 → 3：三台玩家車、一台電腦車、題目按鈕合併成一顆', s.n === 3 && s.P.length === 3 && s.ais.length === 1 && s.ctl.includes('|題目：'), s.ctl); await shot('race_3p_idle');
await clickSel('#ctl [data-a="race:lvall"]'); s = await rs(); ok('3 人：按「題目」所有人一起換', s.levels === 'prime,prime,prime,prime', s.levels);
await clickSel('#ctl [data-a="race:n"]'); s = await rs(); ok('人數 3 → 4：四台玩家車、沒有電腦車', s.n === 4 && s.P.length === 4 && s.ais.length === 0, s.ctl);
ok('四台車起跑時排成一排、不重疊', s.P.map(p => p.x).join() === '-0.75,-0.25,0.25,0.75');
await startRace(); for (const k of ['ArrowUp', 'i', 'w', '8']) await kd(k); await sleep(2500); s = await rs();
ok('四位玩家各自的加速鍵（↑ I W 8）都有用', s.P.every(p => p.v > 0.4 && p.z > 15), s.P.map(p => p.v).join(','));
a = s.P.map(p => p.x); await kd('d'); await kd('4'); await sleep(500); await ku('d'); await ku('4'); s = await rs();
ok('3P 按 D 往右、4P 按 4 往左，1P 2P 不受影響', s.P[2].x > a[2] + 0.15 && s.P[3].x < a[3] - 0.15 && Math.abs(s.P[0].steer) < 0.05 && Math.abs(s.P[1].steer) < 0.05, `3P ${a[2]} → ${s.P[2].x}　4P ${a[3]} → ${s.P[3].x}`);
await ev(`__race.give(2, 'boost'); __race.give(3, 'shield')`); await kd('s'); await kd('5'); await sleep(150); await ku('s'); await ku('5'); s = await rs();
ok('3P 按 S、4P 按 5 使用道具', s.P[2].boost && s.P[3].shield && !s.P[2].item && !s.P[3].item); await sleep(400); await shot('race_4p');
for (const k of ['ArrowUp', 'i', 'w', '8']) await ku(k);
await ev(`__feed = () => [__mk(1100, 380, 400, { tilt: 0.35 }), __mk(800, 380, 400, { tilt: -0.35 }), __mk(500, 380, 400, { tilt: 0.35 }), __mk(200, 380, 400, { tilt: -0.35 })]`); await sleep(500); a = await inp();
ok('四個人：由畫面左到右（原始影像右到左）是 1P–4P', a[0].steer < -0.4 && a[1].steer > 0.4 && a[2].steer < -0.4 && a[3].steer > 0.4, a.map(x => x.steer).join(','));
await ev(`__feed = () => [__mk(800, 380, 400, { tilt: -0.35 }), __mk(200, 380, 400, { tilt: -0.35 })]`); await sleep(500); a = await inp();
ok('四人局只來兩個人：照站的位置分（第 2、第 4 等分 → 2P、4P）', !a[0].hands && a[1].steer > 0.4 && !a[2].hands && a[3].steer > 0.4, a.map(x => x.hands ? x.steer : '無').join(','));
await ev(`__feed = null`);
for (let i = 0; i < 4; i++) await ev(`(() => { const p = __state.race.players[${i}]; p.z = (__race.finishIdx() - 20 + ${i} * 3) * 200; p.v = __race.MAXV * 0.9; })()`);
for (const k of ['ArrowUp', 'i', 'w', '8']) await kd(k); await sleep(2500); for (const k of ['ArrowUp', 'i', 'w', '8']) await ku(k); s = await rs();
ok('四個人都到終點 → 結束，名次 1–4 不重複', s.ph === 'over' && s.P.map(p => p.rank).sort().join() === '1,2,3,4', '名次 ' + s.P.map(p => p.rank).join(',')); await sleep(600); await shot('race_4p_over');

console.log('【11】賽道與難度');
await go('?test=1&game=race'); s = await rs();
ok('預設是草原（簡單）', s.track === 'meadow' && s.ctl.includes('賽道：草原（簡單）'), s.ctl);
const trackInfo = () => J(`(() => { const sg = __race.segs(), g = __race.gates(), fin = __race.finishIdx(); let maxC = 0, rough = 0; for (const x of sg) maxC = Math.max(maxC, Math.abs(x.curve)); for (let i = 80; i < 180; i++) rough += Math.abs(sg[i].y2 - 2 * sg[i].y1 + sg[i - 1].y1);
  return JSON.stringify({ gates: g.length, boxes: __race.boxRows().length, fin, maxC, rough: Math.round(rough), ai: +(__state.race.ais[2].k).toFixed(3) }); })()`);
const info = { meadow: await trackInfo() }; await kd(' '); await ku(' '); await sleep(3300); await kd('ArrowUp'); await sleep(2500); await shot('race_track_meadow'); await ku('ArrowUp');
for (const [k, name] of [['beach', '海邊（一般）'], ['offroad', '越野（難）'], ['snow', '雪地（難）']]) {
  await clickSel('#ctl [data-a="race:track"]'); s = await rs(); info[k] = await trackInfo();
  ok(`切到${name}：賽道重建，一樣 8 個閘門、9 排寶箱`, s.track === k && s.ctl.includes('賽道：' + name) && s.ph === 'idle' && info[k].gates === 8 && info[k].boxes === 9 && info[k].fin === info.meadow.fin, `最急的彎 ${info[k].maxC}　電腦車倍率 ${info[k].ai}`);
  await kd(' '); await ku(' '); await sleep(3300); await kd('ArrowUp'); await sleep(2500); await shot('race_track_' + k); await ku('ArrowUp');
}
ok('彎度：草原 < 海邊 < 越野、雪地', info.meadow.maxC < info.beach.maxC && info.beach.maxC < info.offroad.maxC && info.beach.maxC < info.snow.maxC, `${info.meadow.maxC} / ${info.beach.maxC} / ${info.offroad.maxC} / ${info.snow.maxC}`);
ok('電腦車：簡單的賽道比較慢，難的比較快', info.meadow.ai < info.beach.ai && info.beach.ai < info.snow.ai, `${info.meadow.ai} / ${info.beach.ai} / ${info.snow.ai}`);
ok('只有越野的路面會顛簸', info.offroad.rough > 20 * Math.max(1, info.meadow.rough, info.beach.rough, info.snow.rough), `起伏量 草原 ${info.meadow.rough}　海邊 ${info.beach.rough}　越野 ${info.offroad.rough}　雪地 ${info.snow.rough}`);
// 過彎被甩出去的程度：同一個彎度、同樣全速、不轉方向盤，雪地甩得比草原遠
const driftOf = async track => { await go('?test=1&game=race&track=' + track); await kd(' '); await ku(' '); await sleep(3300);
  await ev(`(() => { const R = __state.race, p = R.players[0]; R.ais.forEach(a => { a.lane = 6; }); p.gate = 8; p.boxes = new Set([0,1,2,3,4,5,6,7,8]); const sg = __race.segs(); for (const x of sg) x.curve = 2; p.x = 0; p.v = __race.MAXV; })()`); await kd('ArrowUp'); await sleep(900); await ku('ArrowUp'); return (await rs()).P[0].x; };
a = await driftOf('meadow'); b = await driftOf('snow'); ok('雪地路滑：同一個彎，被甩出去的距離是草原的 1.6 倍以上', b < a * 1.6 && a < -0.05, `草原 ${a}　雪地 ${b}`);
await go('?test=1&game=race&track=snow'); await ev(`localStorage.removeItem('handsup-race-best-snow-mul-high')`); await go('?test=1&game=race&track=snow'); await kd(' '); await ku(' '); await sleep(3300);
await ev(`(() => { const p = __state.race.players[0]; p.x = 0; p.z = (__race.finishIdx() - 15) * 200; p.v = __race.MAXV; })()`); await kd('ArrowUp'); await sleep(1500); await ku('ArrowUp'); s = await rs();
ok('每條賽道的最佳紀錄分開記', s.ph === 'over' && +(await ev(`localStorage.getItem('handsup-race-best-snow-mul-high')`)) > 0, '雪地最佳 ' + await ev(`localStorage.getItem('handsup-race-best-snow-mul-high')`)); await sleep(700); await shot('race_snow_over');

console.log('【12】選車');
await go('?test=1&game=race'); await ev(MK); s = await rs();
ok('預設 1P 開紅車，電腦車開另外三台', s.P[0].img === 'karta' && s.aiImgs.split(',').sort().join() === 'kartb,kartc,kartd' && s.ctl.includes('紅車・均衡'), s.ctl);
await clickSel('#ctl [data-a="race:kart0"]'); s = await rs(); ok('按車的按鈕 → 換成藍車，電腦車讓出藍車', s.P[0].img === 'kartb' && !s.aiImgs.includes('kartb') && s.ctl.includes('藍車・極速快'), `${s.ctl}　電腦車 ${s.aiImgs}`);
await ev(`__feed = () => [__mk(640, 380, 560, { tilt: -0.9 })]`); await sleep(250); s = await rs(); ok('方向盤往右打到底不到 0.4 秒 → 還沒換', s.P[0].img === 'kartb');
await sleep(500); s = await rs(); ok('方向盤往右打到底 0.4 秒 → 換下一台（黃車），按鈕文字跟著變', s.P[0].img === 'kartc' && s.ctl.includes('黃車・加速快'), s.ctl); await shot('race_pick');
await sleep(1200); s = await rs(); ok('一直打到底不放：只換一次', s.P[0].img === 'kartc');
await ev(`__feed = () => [__mk(640, 380, 560, {})]`); await sleep(300); await ev(`__feed = () => [__mk(640, 380, 560, { tilt: 0.9 })]`); await sleep(700); s = await rs(); ok('回正後往左打到底 → 換回上一台（藍車）', s.P[0].img === 'kartb');
await ev(`__feed = null`); await sleep(600);
await startRace(); await ev(`__feed = () => [__mk(640, 380, 560, { tilt: -0.9, hold: 0.45 })]`); await sleep(900); s = await rs(); ok('比賽開始後轉方向盤不會換車', s.P[0].img === 'kartb'); await ev(`__feed = null`);
// 四台車的個性：同時起跑、全速直線
await go('?test=1&game=race&players=4'); await startRace();
await ev(`(() => { const R = __state.race; for (const p of R.players) { p.gate = 8; p.boxes = new Set([0,1,2,3,4,5,6,7,8]); } for (const x of __race.segs()) x.curve = 0; })()`);
for (const k of ['ArrowUp', 'i', 'w', '8']) await kd(k); await sleep(1500); a = (await rs()).P.map(p => p.v); await sleep(5500); s = await rs(); b = s.P.map(p => p.v); for (const k of ['ArrowUp', 'i', 'w', '8']) await ku(k);
ok('黃車起步最快', a[2] > a[0] + 0.03 && a[2] > a[1] + 0.03, '起跑 1.5 秒的車速（紅藍黃綠）' + a.join(' / '));
ok('藍車極速最高、黃車極速略低', b[1] > b[0] + 0.03 && b[2] < b[0] - 0.01, '7 秒後的車速（紅藍黃綠）' + b.join(' / '));
await go('?test=1&game=race&players=2&karts=ad'); await startRace();
await ev(`(() => { const R = __state.race; R.ais.forEach(a => { a.lane = 6; }); for (const p of R.players) { p.gate = 8; p.boxes = new Set([0,1,2,3,4,5,6,7,8]); p.x = 0; p.v = __race.MAXV; } for (const x of __race.segs()) x.curve = 2; })()`);
await kd('ArrowUp'); await kd('i'); await sleep(900); await ku('ArrowUp'); await ku('i'); s = await rs();
ok('綠車過彎比較穩（同一個彎被甩出去的距離比紅車短）', s.P[1].img === 'kartd' && s.P[1].x > s.P[0].x + 0.08, `紅車 ${s.P[0].x}　綠車 ${s.P[1].x}`);

console.log('【13】鏡頭、辨識與外框按鈕');
await go('?'); for (let i = 0; i < 40 && !(await ev('__state.ready')); i++) await sleep(500); s = await rs();
ok('開鏡頭（假鏡頭）→ 模型載入完成、提示訊息消失', await ev('__state.ready') === true && s.msg === '' && s.test === false, `辨識用 ${await ev('__state.delegate')}`);
await sleep(3000); a = await ev('__state.fps'); ok('背景辨識有在跑', a >= 3, `每秒 ${a} 次`);
a = await J(`new Promise(r => { const iv = []; let last = performance.now(), n = 0; const f = () => { const t = performance.now(); iv.push(t - last); last = t; if (++n < 300) requestAnimationFrame(f); else r(JSON.stringify({ over40: iv.filter(v => v > 40).length, max: Math.round(Math.max(...iv)) })); }; requestAnimationFrame(f); })`);
ok('一邊辨識一邊畫：300 格裡超過 40 毫秒的不到 3 格', a.over40 < 3, `卡頓 ${a.over40} 格　最長 ${a.max} 毫秒`); await shot('shell_camera');
await kd('t'); await ku('t'); await sleep(200); s = await rs(); ok('按 T → 進入鍵盤試玩，按鈕亮起', s.test === true && await ev(`document.querySelector('#sys [data-s="test"]').classList.contains('on')`));
await kd('t'); await ku('t'); await sleep(200); s = await rs(); ok('再按 T → 回到鏡頭模式', s.test === false && s.msg === '');
await kd('h'); await ku('h'); await sleep(150); a = await J(`JSON.stringify({ shown: getComputedStyle(document.getElementById('help')).display, src: document.getElementById('src').href })`);
ok('按 H → 顯示說明，裡面有原始碼連結', a.shown === 'block' && a.src.includes('github.com/'), a.src); await shot('shell_help');
await clickSel('#sys [data-s="help"]'); ok('按「說明」按鈕 → 收起來', await ev(`getComputedStyle(document.getElementById('help')).display`) === 'none');
await clickSel('#sys [data-s="test"]'); s = await rs(); ok('按「鍵盤試玩」按鈕 → 進入試玩', s.test === true); await clickSel('#sys [data-s="test"]');
await clickSel('#sys [data-s="cam"]'); await sleep(300); s = await rs(); ok('按「切換鏡頭」不會出錯', /鏡頭/.test(s.msg), s.msg); await sleep(1800); s = await rs(); ok(' 訊息 1.6 秒後自動消失', s.msg === '');
await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600, y: 500 }); await sleep(300); a = await ev(`document.getElementById('ctl').classList.contains('idle')`); await sleep(3600);
ok('滑鼠 3.5 秒沒動，上方按鈕淡出', a === false && await ev(`document.getElementById('ctl').classList.contains('idle') && document.getElementById('sys').classList.contains('idle')`));
await go('?cpu=1'); for (let i = 0; i < 60 && !(await ev('__state.ready')); i++) await sleep(500);
ok('沒有顯示卡加速的電腦（強制用 CPU）→ 改用小模型，一樣能辨識', await ev('__state.ready') === true && await ev('__state.delegate') === 'CPU', `辨識用 ${await ev('__state.delegate')}`);
await sleep(4000); a = await ev('__state.fps'); ok(' CPU 模式的辨識速度', a >= 1, `每秒 ${a} 次`);
console.log(errs ? `\n有 ${errs} 個錯誤訊息` : '\n沒有任何錯誤訊息');
chrome.kill(); process.exit(0);
