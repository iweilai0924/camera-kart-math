// 姿態辨識的背景執行緒。
// 辨識原本和畫面在同一條執行緒上，每辨識一次畫面就會頓一下；搬到這裡之後，主畫面只負責畫圖。
// 做的事：把畫面縮成 640×640 → YOLOv8-pose → 挑出每個人的框與 17 個關節，傳回主畫面。
// 有顯示卡加速（WebGPU）時用較準的模型；沒有就改用 CPU 跑較小的模型，才不會太慢。
importScripts('./vendor/ort/ort.webgpu.min.js');
let sess = null, SIZE = 640, minPerson = 0.4, cv = null, cx = null, inBuf = null;
const iou = (a, b) => {
  const x1 = Math.max(a.x - a.w / 2, b.x - b.w / 2), x2 = Math.min(a.x + a.w / 2, b.x + b.w / 2);
  const y1 = Math.max(a.y - a.h / 2, b.y - b.h / 2), y2 = Math.min(a.y + a.h / 2, b.y + b.h / 2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter);
};
onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      ort.env.wasm.wasmPaths = m.base + 'vendor/ort/'; ort.env.wasm.numThreads = 1;
      SIZE = m.size; minPerson = m.minPerson;
      cv = new OffscreenCanvas(SIZE, SIZE); cx = cv.getContext('2d', { willReadFrequently: true }); inBuf = new Float32Array(3 * SIZE * SIZE);
      let delegate = 'WebGPU';
      try { if (m.forceCpu) throw new Error('指定用 CPU'); sess = await ort.InferenceSession.create(m.model, { executionProviders: ['webgpu'] }); }
      catch (err) { delegate = 'CPU'; sess = await ort.InferenceSession.create(m.modelCpu || m.model, { executionProviders: ['wasm'] }); }
      postMessage({ type: 'ready', delegate });
    } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); }
    return;
  }
  if (m.type !== 'frame' || !sess) return;
  try {
    const bm = m.bitmap, rw = bm.width, rh = bm.height, up = m.w / rw; // 傳進來的圖已經縮小過，up 是換算回原始影像的倍數
    const s = Math.min(SIZE / rw, SIZE / rh), dw = rw * s, dh = rh * s, ox = (SIZE - dw) / 2, oy = (SIZE - dh) / 2;
    cx.fillStyle = '#727272'; cx.fillRect(0, 0, SIZE, SIZE); cx.drawImage(bm, 0, 0, rw, rh, ox, oy, dw, dh); bm.close();
    const px = cx.getImageData(0, 0, SIZE, SIZE).data, N = SIZE * SIZE;
    for (let i = 0, j = 0; i < N; i++, j += 4) { inBuf[i] = px[j] / 255; inBuf[N + i] = px[j + 1] / 255; inBuf[2 * N + i] = px[j + 2] / 255; }
    const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', inBuf, [1, 3, SIZE, SIZE]) });
    const t = out[sess.outputNames[0]], A = t.dims[2], data = t.data; // [1, 56, A]
    const dets = [];
    for (let a = 0; a < A; a++) {
      const conf = data[4 * A + a]; if (conf < minPerson) continue;
      const kp = new Float32Array(51);
      for (let k = 0; k < 17; k++) { kp[k * 3] = (data[(5 + k * 3) * A + a] - ox) / s * up; kp[k * 3 + 1] = (data[(6 + k * 3) * A + a] - oy) / s * up; kp[k * 3 + 2] = data[(7 + k * 3) * A + a]; }
      dets.push({ conf, x: (data[a] - ox) / s * up, y: (data[A + a] - oy) / s * up, w: data[2 * A + a] / s * up, h: data[3 * A + a] / s * up, kp });
    }
    dets.sort((p, q) => q.conf - p.conf);
    const keep = [];
    for (const d of dets) if (!keep.some(k => iou(k, d) > 0.5)) keep.push(d);
    postMessage({ type: 'dets', dets: keep.slice(0, m.max), w: m.w, h: m.h });
  } catch (err) { postMessage({ type: 'dets', dets: [], w: m.w, h: m.h, error: String(err && err.message || err) }); }
};
