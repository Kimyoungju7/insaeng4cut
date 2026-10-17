'use strict';

/* ───────── 기본 크기 (캔버스 논리 좌표, 저장 시 2배) ───────── */
const W = 600;
const H = 1800;
const EXPORT_SCALE = 2;
const PHOTO_W = 480;          // 4:3
const PHOTO_H = 360;
const SIDE = (W - PHOTO_W) / 2;
const TOP = 36;
const GAP = 24;               // 컷 사이 여백
const RADIUS = 16;            // 사진 모서리
const TEXT_TOP = TOP + 4 * PHOTO_H + 3 * GAP; // 1548 → 아래 252px(약 14%)는 문구 영역
const CAPTURE_W = PHOTO_W * EXPORT_SCALE;
const CAPTURE_H = PHOTO_H * EXPORT_SCALE;
const FONT_FAMILY = "'Gaegu', sans-serif";

const state = {
  mode: null,                       // 'camera' | 'upload'
  photos: [null, null, null, null], // 4:3으로 잘라 둔 캔버스
  frame: 'argyle',
  stickers: [],                     // { id, type, x, y, size }
  selectedId: null,
  text: '인생 네컷',
  showDate: true,
};

const $ = (id) => document.getElementById(id);
const els = {
  modeCamera: $('modeCamera'),
  modeUpload: $('modeUpload'),
  cameraPanel: $('cameraPanel'),
  uploadPanel: $('uploadPanel'),
  video: $('video'),
  countdown: $('countdown'),
  flash: $('flash'),
  shootAll: $('shootAll'),
  pickFiles: $('pickFiles'),
  fileInput: $('fileInput'),
  fileInputOne: $('fileInputOne'),
  message: $('message'),
  retakeRow: $('retakeRow'),
  retakeBtns: [...document.querySelectorAll('.retake-btn')],
  preview: $('preview'),
  frameList: $('frameList'),
  stickerList: $('stickerList'),
  sizeRange: $('sizeRange'),
  deleteSticker: $('deleteSticker'),
  textInput: $('textInput'),
  dateToggle: $('dateToggle'),
  saveBtn: $('saveBtn'),
  qrBtn: $('qrBtn'),
  qrDialog: $('qrDialog'),
  qrBox: $('qrBox'),
  qrUrl: $('qrUrl'),
  qrNote: $('qrNote'),
  qrClose: $('qrClose'),
};

/* ───────── 프레임 5종 ───────── */
function fillAll(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

const FRAMES = {
  argyle: {
    name: '하늘색 체크',
    ink: '#1f4a6b',
    outline: '#ffffff',
    slot: 'rgba(255,255,255,0.7)',
    draw(ctx) {
      const dw = 100;
      const dh = 140;
      fillAll(ctx, '#9fd3f0');
      ctx.fillStyle = '#d3edfb';
      for (let y = 0; y <= H + dh; y += dh) {
        for (let x = 0; x <= W + dw; x += dw) {
          ctx.beginPath();
          ctx.moveTo(x, y - dh / 2);
          ctx.lineTo(x + dw / 2, y);
          ctx.lineTo(x, y + dh / 2);
          ctx.lineTo(x - dw / 2, y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // 마름모 가운데를 지나는 흰 점선
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      const slope = dh / dw;
      for (let x0 = -H / slope; x0 <= W + H / slope; x0 += dw) {
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + H / slope, H);
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 - H / slope, H);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  pink: {
    name: '분홍 체크',
    ink: '#8c1f4d',
    outline: '#ffffff',
    slot: 'rgba(255,255,255,0.75)',
    draw(ctx) {
      const band = 40;
      fillAll(ctx, '#fff2f7');
      ctx.fillStyle = 'rgba(255,128,176,0.35)';
      for (let y = 0; y < H; y += band * 2) ctx.fillRect(0, y, W, band);
      for (let x = 0; x < W; x += band * 2) ctx.fillRect(x, 0, band, H);
    },
  },
  dots: {
    name: '노랑 도트',
    ink: '#6b4a00',
    outline: '#ffffff',
    slot: 'rgba(255,255,255,0.75)',
    draw(ctx) {
      const step = 60;
      fillAll(ctx, '#ffe066');
      ctx.fillStyle = '#ffffff';
      let row = 0;
      for (let y = step / 2; y < H + step; y += step / 2, row++) {
        const offset = row % 2 ? step / 2 : 0;
        for (let x = offset; x < W + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  white: {
    name: '흰색',
    ink: '#222222',
    outline: null,
    slot: '#eef1f4',
    draw(ctx) {
      fillAll(ctx, '#ffffff');
    },
  },
  black: {
    name: '검정',
    ink: '#ffffff',
    outline: null,
    slot: '#333333',
    draw(ctx) {
      fillAll(ctx, '#1b1b1b');
    },
  },
};

/* ───────── 스티커 (인라인 SVG, 굵은 검정 외곽선) ───────── */
const outline = (w = 5) => `stroke="#222" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const S = outline();
const face = (cx, cy, gap = 8) =>
  `<circle cx="${cx - gap}" cy="${cy}" r="3.5" fill="#222"/><circle cx="${cx + gap}" cy="${cy}" r="3.5" fill="#222"/>` +
  `<path d="M${cx - 5} ${cy + 7} Q${cx} ${cy + 12} ${cx + 5} ${cy + 7}" fill="none" stroke="#222" stroke-width="3.5" stroke-linecap="round"/>`;
const blush = (cx, cy, gap = 17) =>
  `<ellipse cx="${cx - gap}" cy="${cy}" rx="5" ry="3" fill="#ff9fb8"/><ellipse cx="${cx + gap}" cy="${cy}" rx="5" ry="3" fill="#ff9fb8"/>`;

const STICKERS = [
  { type: 'drink', name: '음료', body:
    `<polygon points="55,4 64,7 56,32 47,29" fill="#ff6b6b" ${S}/>` +
    `<path d="M27 38 L73 38 L66 90 Q65 95 60 95 L40 95 Q35 95 34 90 Z" fill="#ffd8a8" ${S}/>` +
    `<rect x="21" y="27" width="58" height="12" rx="5" fill="#ffffff" ${S}/>` +
    `<circle cx="42" cy="84" r="4" fill="#222"/><circle cx="52" cy="87" r="4" fill="#222"/><circle cx="61" cy="82" r="4" fill="#222"/>` +
    face(50, 58) + blush(50, 66, 14) },
  { type: 'beer', name: '맥주잔', body:
    `<path d="M72 44 Q92 44 92 60 Q92 78 72 78" fill="none" ${outline(14)}/>` +
    `<path d="M72 44 Q92 44 92 60 Q92 78 72 78" fill="none" stroke="#ffe08a" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="22" y="34" width="52" height="60" rx="7" fill="#ffc53d" ${S}/>` +
    `<line x1="36" y1="50" x2="36" y2="84" stroke="#e09b00" stroke-width="4" stroke-linecap="round"/>` +
    `<line x1="60" y1="50" x2="60" y2="84" stroke="#e09b00" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="48" cy="72" r="3" fill="#fff6d6"/><circle cx="44" cy="60" r="2.5" fill="#fff6d6"/><circle cx="52" cy="82" r="2.5" fill="#fff6d6"/>` +
    `<path d="M17 38 Q14 24 28 23 Q32 12 45 15 Q56 6 65 17 Q80 15 79 30 Q82 42 72 42 L25 42 Q17 42 17 38 Z" fill="#ffffff" ${S}/>` },
  { type: 'heart', name: '하트', body:
    `<path d="M50 88 C20 68 7 50 11 33 C15 16 38 11 50 30 C62 11 85 16 89 33 C93 50 80 68 50 88 Z" fill="#ff5c8a" ${S}/>` +
    `<ellipse cx="30" cy="34" rx="7" ry="5" fill="#ffffff" transform="rotate(-30 30 34)"/>` },
  { type: 'star', name: '별', body:
    `<polygon points="50,10 61,37 90,39 68,58 75,87 50,71 25,87 32,58 10,39 39,37" fill="#ffd43b" ${S}/>` +
    face(50, 50, 7) },
  { type: 'crown', name: '왕관', body:
    `<polygon points="14,80 10,32 31,54 50,22 69,54 90,32 86,80" fill="#ffc93c" ${S}/>` +
    `<rect x="14" y="70" width="72" height="14" rx="4" fill="#ffa94d" ${S}/>` +
    `<circle cx="10" cy="30" r="7" fill="#ff5c8a" ${S}/><circle cx="50" cy="19" r="7" fill="#4dabf7" ${S}/><circle cx="90" cy="30" r="7" fill="#ff5c8a" ${S}/>` },
  { type: 'cake', name: '케이크', body:
    `<rect x="46" y="22" width="8" height="24" rx="2" fill="#74c0fc" ${S}/>` +
    `<path d="M50 4 C57 11 57 18 50 21 C43 18 43 11 50 4 Z" fill="#ffa94d" ${S}/>` +
    `<rect x="16" y="46" width="68" height="44" rx="8" fill="#ffe3c2" ${S}/>` +
    `<path d="M16 54 Q16 46 24 46 L76 46 Q84 46 84 54 L84 60 Q77 68 70 60 Q63 68 57 60 Q50 68 43 60 Q36 68 30 60 Q23 68 16 60 Z" fill="#ff8fb1" ${S}/>` +
    `<circle cx="30" cy="77" r="3" fill="#ff6b6b"/><circle cx="50" cy="80" r="3" fill="#51cf66"/><circle cx="70" cy="77" r="3" fill="#339af0"/>` },
  { type: 'sparkle', name: '반짝이', body:
    `<path d="M42 14 Q47 48 80 54 Q47 60 42 94 Q37 60 6 54 Q37 48 42 14 Z" fill="#fff3a0" ${S}/>` +
    `<path d="M80 6 Q82 18 94 20 Q82 22 80 34 Q78 22 66 20 Q78 18 80 6 Z" fill="#ffffff" ${outline(4)}/>` },
  { type: 'ribbon', name: '리본', body:
    `<path d="M45 54 L32 92 L42 87 L48 95 L54 56 Z" fill="#e64980" ${S}/>` +
    `<path d="M55 54 L68 92 L58 87 L52 95 L46 56 Z" fill="#e64980" ${S}/>` +
    `<path d="M50 48 Q22 18 11 32 Q3 48 11 64 Q22 78 50 48 Z" fill="#ff6fa5" ${S}/>` +
    `<path d="M50 48 Q78 18 89 32 Q97 48 89 64 Q78 78 50 48 Z" fill="#ff6fa5" ${S}/>` +
    `<circle cx="50" cy="48" r="10" fill="#ff8fbd" ${S}/>` },
  { type: 'flower', name: '꽃', body:
    `<circle cx="50" cy="26" r="16" fill="#ffb3d1" ${S}/><circle cx="72.8" cy="42.6" r="16" fill="#ffb3d1" ${S}/>` +
    `<circle cx="64.1" cy="69.4" r="16" fill="#ffb3d1" ${S}/><circle cx="35.9" cy="69.4" r="16" fill="#ffb3d1" ${S}/>` +
    `<circle cx="27.2" cy="42.6" r="16" fill="#ffb3d1" ${S}/>` +
    `<circle cx="50" cy="50" r="15" fill="#ffd43b" ${S}/>` + face(50, 47, 5) },
  { type: 'cloud', name: '구름', body:
    `<path d="M24 76 Q7 76 7 60 Q7 45 23 45 Q25 26 44 26 Q58 26 64 38 Q71 31 80 34 Q93 39 91 54 Q97 61 93 69 Q89 76 80 76 Z" fill="#ffffff" ${S}/>` +
    face(50, 54) + blush(50, 63, 15) },
  { type: 'smile', name: '스마일', body:
    `<circle cx="50" cy="50" r="40" fill="#ffe066" ${S}/>` +
    `<ellipse cx="37" cy="42" rx="5" ry="7" fill="#222"/><ellipse cx="63" cy="42" rx="5" ry="7" fill="#222"/>` +
    `<path d="M30 58 Q50 80 70 58" fill="none" ${S}/>` + blush(50, 58, 26) },
  { type: 'icecream', name: '아이스크림', body:
    `<polygon points="30,52 70,52 50,95" fill="#f4b860" ${S}/>` +
    `<path d="M38 62 L58 82 M50 58 L64 70 M60 60 L44 80 M46 58 L40 66" stroke="#c9822b" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="38" cy="44" r="15" fill="#ff9ebd" ${S}/><circle cx="62" cy="44" r="15" fill="#b2f2bb" ${S}/>` +
    `<circle cx="50" cy="26" r="16" fill="#fff3bf" ${S}/>` },
  { type: 'note', name: '음표', body:
    `<path d="M38 76 L38 24 L82 15 L82 67" fill="none" ${outline(7)}/>` +
    `<polygon points="38,22 82,13 82,27 38,36" fill="#222"/>` +
    `<ellipse cx="29" cy="76" rx="13" ry="10" fill="#845ef7" ${S} transform="rotate(-20 29 76)"/>` +
    `<ellipse cx="73" cy="67" rx="13" ry="10" fill="#845ef7" ${S} transform="rotate(-20 73 67)"/>` },
  { type: 'rainbow', name: '무지개', body:
    `<path d="M14 74 A36 36 0 0 1 86 74" fill="none" stroke="#222" stroke-width="37"/>` +
    `<path d="M14 74 A36 36 0 0 1 86 74" fill="none" stroke="#ff6b6b" stroke-width="7"/>` +
    `<path d="M21 74 A29 29 0 0 1 79 74" fill="none" stroke="#ffd43b" stroke-width="7"/>` +
    `<path d="M28 74 A22 22 0 0 1 72 74" fill="none" stroke="#69db7c" stroke-width="7"/>` +
    `<path d="M35 74 A15 15 0 0 1 65 74" fill="none" stroke="#4dabf7" stroke-width="7"/>` +
    `<ellipse cx="16" cy="78" rx="14" ry="10" fill="#fff" ${S}/><ellipse cx="84" cy="78" rx="14" ry="10" fill="#fff" ${S}/>` },
];

const stickerSvg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${s.body}</svg>`;
const stickerImages = {};
STICKERS.forEach((s) => {
  const img = new Image();
  img.onload = () => render();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stickerSvg(s));
  stickerImages[s.type] = img;
});

/* ───────── 그리기 (미리보기·저장 공용) ───────── */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function slotRect(i) {
  return { x: SIDE, y: TOP + i * (PHOTO_H + GAP), w: PHOTO_W, h: PHOTO_H };
}

function formatDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function drawText(ctx, frame, text, y, size) {
  ctx.font = `700 ${size}px ${FONT_FAMILY}`;
  // 길면 글자 크기를 줄인다
  const maxW = W - 80;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size = Math.floor(size * maxW / measured);
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
  }
  if (frame.outline) {
    ctx.lineWidth = Math.max(6, size * 0.16);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = frame.outline;
    ctx.strokeText(text, W / 2, y);
  }
  ctx.fillStyle = frame.ink;
  ctx.fillText(text, W / 2, y);
}

function drawStrip(ctx, { preview }) {
  const frame = FRAMES[state.frame];
  ctx.save();
  frame.draw(ctx);
  ctx.restore();

  // 사진 4컷
  state.photos.forEach((photo, i) => {
    const r = slotRect(i);
    ctx.save();
    roundRectPath(ctx, r.x, r.y, r.w, r.h, RADIUS);
    if (photo) {
      ctx.clip();
      ctx.drawImage(photo, r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = frame.slot;
      ctx.fill();
      ctx.fillStyle = state.frame === 'black' ? '#8a8a8a' : '#9aa7b3';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 110px ${FONT_FAMILY}`;
      ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + r.h / 2 - 20);
      ctx.font = `700 34px ${FONT_FAMILY}`;
      ctx.fillText('사진을 넣어요', r.x + r.w / 2, r.y + r.h / 2 + 62);
    }
    ctx.restore();
  });

  // 하단 문구·날짜
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = state.text.trim();
  const dateText = state.showDate ? formatDate(new Date()) : '';
  const mid = TEXT_TOP + (H - TEXT_TOP) / 2;
  if (text && dateText) {
    drawText(ctx, FRAMES[state.frame], text, mid - 26, 80);
    drawText(ctx, FRAMES[state.frame], dateText, mid + 56, 40);
  } else if (text) {
    drawText(ctx, FRAMES[state.frame], text, mid, 84);
  } else if (dateText) {
    drawText(ctx, FRAMES[state.frame], dateText, mid, 48);
  }
  ctx.restore();

  // 스티커
  state.stickers.forEach((s) => {
    const img = stickerImages[s.type];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    if (preview && s.id === state.selectedId) {
      ctx.save();
      ctx.strokeStyle = '#2f8fd8';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(s.x - s.size / 2 - 6, s.y - s.size / 2 - 6, s.size + 12, s.size + 12);
      ctx.restore();
    }
  });
}

/* 미리보기 캔버스 */
const previewCtx = els.preview.getContext('2d');
const dpr = Math.min(2, window.devicePixelRatio || 1);
els.preview.width = W * dpr;
els.preview.height = H * dpr;

let renderPending = false;
function render() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStrip(previewCtx, { preview: true });
  });
}

/* ───────── 안내 메시지 ───────── */
function say(text, warn = false) {
  els.message.textContent = text;
  els.message.classList.toggle('warn', warn);
}

/* ───────── 사진 자르기 (가운데 4:3) ───────── */
function cropToSlot(source, sw, sh, mirror) {
  const c = document.createElement('canvas');
  c.width = CAPTURE_W;
  c.height = CAPTURE_H;
  const ctx = c.getContext('2d');
  const target = CAPTURE_W / CAPTURE_H;
  let cw = sw;
  let ch = sh;
  if (sw / sh > target) cw = sh * target;
  else ch = sw / target;
  const cx = (sw - cw) / 2;
  const cy = (sh - ch) / 2;
  if (mirror) {
    ctx.translate(CAPTURE_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, CAPTURE_W, CAPTURE_H);
  return c;
}

/* ───────── 입력 방식 ───────── */
function updateRetakeButtons() {
  const label = state.mode === 'camera' ? '다시 찍기' : '다시 고르기';
  els.retakeBtns.forEach((b, i) => {
    b.textContent = `${i + 1}번 ${label}`;
  });
  els.retakeRow.hidden = !state.mode;
}

function setMode(mode) {
  state.mode = mode;
  els.modeCamera.setAttribute('aria-pressed', String(mode === 'camera'));
  els.modeUpload.setAttribute('aria-pressed', String(mode === 'upload'));
  els.cameraPanel.hidden = mode !== 'camera';
  els.uploadPanel.hidden = mode !== 'upload';
  if (mode !== 'camera') stopCamera();
  updateRetakeButtons();
}

/* ───────── 업로드 ───────── */
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = cropToSlot(img, img.naturalWidth, img.naturalHeight, false);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load'));
    };
    img.src = url;
  });
}

async function putFiles(files, targets) {
  let failed = 0;
  for (let k = 0; k < files.length && k < targets.length; k++) {
    try {
      state.photos[targets[k]] = await loadImageFile(files[k]);
    } catch {
      failed++;
    }
    render();
  }
  const empty = state.photos.filter((p) => !p).length;
  if (failed) say(`열 수 없는 사진이 ${failed}장 있어요. 다른 사진을 골라 주세요.`, true);
  else if (empty) say(`좋아요! ${empty}칸이 남았어요. 사진을 더 골라 주세요.`);
  else say('4컷이 모두 채워졌어요! 아래에서 꾸며 보세요.');
}

els.pickFiles.addEventListener('click', () => els.fileInput.click());

els.fileInput.addEventListener('change', async () => {
  const files = [...els.fileInput.files].filter((f) => f.type.startsWith('image/') || f.type === '');
  els.fileInput.value = '';
  if (!files.length) return;
  const empties = [0, 1, 2, 3].filter((i) => !state.photos[i]);
  // 4장 이상 고르거나 빈칸이 없으면 1번부터 채운다
  const targets = files.length >= 4 || !empties.length ? [0, 1, 2, 3] : empties;
  if (files.length > 4) say('사진이 4장보다 많아서 앞의 4장만 넣었어요.');
  await putFiles(files, targets);
});

let retakeIndex = null;
els.fileInputOne.addEventListener('change', async () => {
  const file = els.fileInputOne.files[0];
  els.fileInputOne.value = '';
  if (!file || retakeIndex === null) return;
  await putFiles([file], [retakeIndex]);
  retakeIndex = null;
});

/* ───────── 웹캠 ───────── */
let stream = null;
let shooting = false;

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  els.video.srcObject = null;
}

function cameraFailed(err) {
  const name = err && err.name;
  let reason = '카메라를 쓸 수 없어요.';
  if (name === 'NotAllowedError' || name === 'SecurityError') reason = '카메라 사용이 허락되지 않았어요.';
  else if (name === 'NotFoundError' || name === 'OverconstrainedError') reason = '카메라를 찾지 못했어요.';
  else if (name === 'NotReadableError') reason = '다른 앱이 카메라를 쓰고 있어요.';
  setMode('upload');
  say(`${reason} 대신 "사진 4장 고르기"로 사진을 올려 주세요.`, true);
}

async function startCamera() {
  if (stream) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraFailed({ name: 'NotSupported' });
    return false;
  }
  say('카메라를 켜는 중이에요… "허용"을 눌러 주세요.');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    els.video.srcObject = stream;
    await els.video.play();
    // 화면 크기를 알 때까지 기다린다
    if (!els.video.videoWidth) {
      await new Promise((r) => els.video.addEventListener('loadedmetadata', r, { once: true }));
    }
    if (state.mode !== 'camera') {
      stopCamera();
      return false;
    }
    say('준비됐어요! "촬영 시작"을 누르면 3초 뒤에 찍어요.');
    return true;
  } catch (err) {
    stopCamera();
    cameraFailed(err);
    return false;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setBusy(busy) {
  shooting = busy;
  [els.shootAll, els.modeCamera, els.modeUpload, ...els.retakeBtns].forEach((b) => {
    b.disabled = busy;
  });
}

function capture(i) {
  const v = els.video;
  state.photos[i] = cropToSlot(v, v.videoWidth, v.videoHeight, true);
  els.flash.classList.remove('on');
  void els.flash.offsetWidth; // 애니메이션 다시 시작
  els.flash.classList.add('on');
  render();
}

async function shoot(indices) {
  if (shooting) return;
  if (!(await startCamera())) return;
  setBusy(true);
  try {
    for (const i of indices) {
      for (let n = 3; n >= 1; n--) {
        if (!stream) throw new Error('stopped');
        els.countdown.innerHTML = `<div><small>${i + 1}번째 컷</small>${n}</div>`;
        await wait(1000);
      }
      els.countdown.textContent = '';
      if (!stream) throw new Error('stopped');
      capture(i);
    }
    say(indices.length > 1 ? '4컷 촬영 끝! 아래에서 꾸며 보세요.' : `${indices[0] + 1}번 컷을 다시 찍었어요.`);
  } catch {
    say('촬영이 멈췄어요. 다시 시도해 주세요.', true);
  } finally {
    els.countdown.textContent = '';
    setBusy(false);
  }
}

els.modeCamera.addEventListener('click', () => {
  setMode('camera');
  startCamera();
});

els.modeUpload.addEventListener('click', () => {
  setMode('upload');
  say('"사진 4장 고르기"를 눌러 사진을 골라 주세요.');
});

els.shootAll.addEventListener('click', () => shoot([0, 1, 2, 3]));

els.retakeBtns.forEach((b) => {
  b.addEventListener('click', () => {
    const i = Number(b.dataset.index);
    if (state.mode === 'camera') {
      shoot([i]);
    } else {
      retakeIndex = i;
      els.fileInputOne.click();
    }
  });
});

/* ───────── 프레임 선택 ───────── */
Object.entries(FRAMES).forEach(([key, frame]) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'frame-btn';
  btn.dataset.frame = key;
  btn.setAttribute('aria-pressed', String(key === state.frame));
  const thumb = document.createElement('canvas');
  thumb.width = 88;
  thumb.height = 132;
  const tctx = thumb.getContext('2d');
  tctx.scale(88 / 300, 132 / 450); // 프레임 왼쪽 위 300×450 부분을 축소
  frame.draw(tctx);
  btn.append(thumb, document.createTextNode(frame.name));
  btn.addEventListener('click', () => {
    state.frame = key;
    els.frameList.querySelectorAll('.frame-btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.frame === key));
    });
    render();
  });
  els.frameList.append(btn);
});

/* ───────── 탭 ───────── */
const tabs = [...document.querySelectorAll('.tab')];
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
  });
});

/* ───────── 스티커 ───────── */
let nextStickerId = 1;

function selectedSticker() {
  return state.stickers.find((s) => s.id === state.selectedId) || null;
}

function selectSticker(id) {
  state.selectedId = id;
  const s = selectedSticker();
  els.sizeRange.disabled = !s;
  els.deleteSticker.disabled = !s;
  if (s) els.sizeRange.value = String(s.size);
  render();
}

// 화면에 보이는 미리보기 부분의 가운데 (논리 좌표)
function visibleCenter() {
  const rect = els.preview.getBoundingClientRect();
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const ratio = H / rect.height;
  let y = H / 2;
  if (bottom - top > 40) {
    const visTop = (top - rect.top) * ratio;
    y = ((top + bottom) / 2 - rect.top) * ratio;
    // 보이는 범위 안에서 되도록 사진 쪽에 붙인다 (문구를 덜 가리게)
    if (y > TEXT_TOP - 140) y = Math.max(visTop + 100, TEXT_TOP - 140);
  }
  return { x: W / 2, y: Math.min(H - 100, Math.max(100, y)) };
}

STICKERS.forEach((s) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sticker-btn';
  btn.title = s.name;
  btn.setAttribute('aria-label', `${s.name} 스티커 붙이기`);
  btn.dataset.sticker = s.type;
  btn.innerHTML = stickerSvg(s);
  btn.addEventListener('click', () => {
    const c = visibleCenter();
    const jitter = () => Math.round((Math.random() - 0.5) * 120);
    const sticker = { id: nextStickerId++, type: s.type, x: c.x + jitter(), y: c.y + jitter(), size: 120 };
    state.stickers.push(sticker);
    selectSticker(sticker.id);
  });
  els.stickerList.append(btn);
});

els.sizeRange.addEventListener('input', () => {
  const s = selectedSticker();
  if (!s) return;
  s.size = Number(els.sizeRange.value);
  render();
});

els.deleteSticker.addEventListener('click', () => {
  state.stickers = state.stickers.filter((s) => s.id !== state.selectedId);
  selectSticker(null);
});

// 드래그 (마우스·터치 공통: Pointer Events)
function toLogical(e) {
  const rect = els.preview.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function hitSticker(p) {
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i];
    const half = s.size / 2 + 8;
    if (Math.abs(p.x - s.x) <= half && Math.abs(p.y - s.y) <= half) return s;
  }
  return null;
}

let drag = null;

els.preview.addEventListener('pointerdown', (e) => {
  const p = toLogical(e);
  const s = hitSticker(p);
  if (!s) {
    if (state.selectedId !== null) selectSticker(null);
    return;
  }
  e.preventDefault();
  // 고른 스티커를 맨 위로
  state.stickers = state.stickers.filter((x) => x !== s).concat(s);
  selectSticker(s.id);
  drag = { id: s.id, dx: p.x - s.x, dy: p.y - s.y, pointerId: e.pointerId };
  try {
    els.preview.setPointerCapture(e.pointerId);
  } catch { /* 일부 브라우저 */ }
});

els.preview.addEventListener('pointermove', (e) => {
  const p = toLogical(e);
  if (!drag) {
    if (e.pointerType === 'mouse') els.preview.style.cursor = hitSticker(p) ? 'grab' : '';
    return;
  }
  if (e.pointerId !== drag.pointerId) return;
  const s = selectedSticker();
  if (!s) return;
  s.x = Math.min(W, Math.max(0, p.x - drag.dx));
  s.y = Math.min(H, Math.max(0, p.y - drag.dy));
  render();
});

function endDrag(e) {
  if (drag && e.pointerId === drag.pointerId) drag = null;
}
els.preview.addEventListener('pointerup', endDrag);
els.preview.addEventListener('pointercancel', endDrag);

// 스티커를 잡았을 때만 화면 스크롤을 막는다
els.preview.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1 && hitSticker(toLogical(e.touches[0]))) e.preventDefault();
}, { passive: false });
els.preview.addEventListener('touchmove', (e) => {
  if (drag) e.preventDefault();
}, { passive: false });

/* ───────── 문구 ───────── */
els.textInput.addEventListener('input', () => {
  state.text = els.textInput.value;
  render();
});
els.dateToggle.addEventListener('change', () => {
  state.showDate = els.dateToggle.checked;
  render();
});

// 손글씨체가 늦게 도착하면 다시 그린다 (실패 시 sans-serif)
function loadFont(timeout) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load(`700 80px Gaegu`, '인생네컷0123'),
    wait(timeout),
  ]).catch(() => {});
}
loadFont(5000).then(render);

/* ───────── PNG 저장 ───────── */
function fileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `insaeng4cut_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.png`;
}

els.saveBtn.addEventListener('click', async () => {
  const empty = state.photos.filter((p) => !p).length;
  if (empty && !confirm(`아직 빈 칸이 ${empty}개 있어요. 그래도 저장할까요?`)) return;
  els.saveBtn.disabled = true;
  try {
    await loadFont(1500);
    const c = document.createElement('canvas');
    c.width = W * EXPORT_SCALE;
    c.height = H * EXPORT_SCALE;
    const ctx = c.getContext('2d');
    ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
    drawStrip(ctx, { preview: false });
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (!blob) throw new Error('blob');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say('사진을 저장했어요! 다운로드 폴더(또는 갤러리)를 확인해 보세요.');
  } catch {
    say('저장하지 못했어요. 다시 눌러 주세요.', true);
  } finally {
    els.saveBtn.disabled = false;
  }
});

/* ───────── QR 공유 ───────── */
els.qrBtn.addEventListener('click', () => {
  const url = location.href.split('#')[0];
  els.qrUrl.textContent = url;
  els.qrBox.innerHTML = '';
  if (typeof qrcode === 'function') {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    els.qrBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
  } else {
    els.qrBox.textContent = 'QR을 만들지 못했어요. 아래 주소를 알려 주세요.';
  }
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  els.qrNote.textContent = local
    ? '지금 주소는 이 컴퓨터에서만 열려요. 인터넷에 올린 주소에서 QR을 보여 주세요.'
    : '';
  if (els.qrDialog.showModal) els.qrDialog.showModal();
  else els.qrDialog.setAttribute('open', '');
});

els.qrClose.addEventListener('click', () => {
  if (els.qrDialog.close) els.qrDialog.close();
  else els.qrDialog.removeAttribute('open');
});
els.qrDialog.addEventListener('click', (e) => {
  if (e.target === els.qrDialog) els.qrDialog.close();
});

/* 시작 */
updateRetakeButtons();
render();
