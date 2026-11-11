import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

// =====================================================================
// Four-panel storyboard: character-driven caricature version.
// One shared set (world coords), four camera framings, four poses.
// =====================================================================

type P = [number, number];
const D = Math.PI / 180;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rot = (p: P, deg: number): P => {
  const a = deg * D;
  return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
};
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const ik = (S: P, T: P, L1: number, L2: number, s: number): P => {
  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 1);
  const th = Math.atan2(dy, dx);
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  return [S[0] + L1 * Math.cos(th + s * a), S[1] + L1 * Math.sin(th + s * a)];
};
const reach = (S: P, T: P, L: number): P => {
  const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
  const k = Math.min(1, L / d);
  return [S[0] + dx * k, S[1] + dy * k];
};
const limb = (a: P, b: P, w0: number, w1: number) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const n: P = [-dy / d, dx / d];
  return [
    [a[0] + n[0] * w0, a[1] + n[1] * w0], [b[0] + n[0] * w1, b[1] + n[1] * w1],
    [b[0] - n[0] * w1, b[1] - n[1] * w1], [a[0] - n[0] * w0, a[1] - n[1] * w0],
  ] as P[];
};
const Limb: React.FC<{a: P; b: P; w0: number; w1: number; fill: string}> = ({a, b, w0, w1, fill}) => (
  <g fill={fill}>
    <polygon points={pts(limb(a, b, w0, w1))} />
    <circle cx={a[0]} cy={a[1]} r={w0} />
    <circle cx={b[0]} cy={b[1]} r={w1} />
  </g>
);
const pts = (a: P[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

// ---------------- lighting / materials ----------------
type Tones = [string, string, string]; // lit, mid, shadow
type Light = {
  warm: boolean;
  skin: Tones; hair: Tones; dress: Tones; scarf: Tones; cream: Tones; iron: Tones; box: Tones; boxB: Tones; wood: Tones; stocking: Tones;
  wallTop: string; wallBot: string; floor: string; ink: string; lens: [string, string, string];
};
const WARM: Light = {
  warm: true,
  skin: ['#ffd3a6', '#e0956a', '#a5573f'],
  hair: ['#c25a2f', '#7a3322', '#3c1c18'],
  dress: ['#4b7378', '#2c4a52', '#1a2c33'],
  scarf: ['#ffa05a', '#e2642f', '#9a3c22'],
  cream: ['#fff4e2', '#ecc9a0', '#a57a62'],
  iron: ['#4a6a70', '#24393f', '#10191d'],
  box: ['#ff9a5c', '#de6435', '#96402a'],
  boxB: ['#f7caa0', '#d79a78', '#93604c'],
  wood: ['#c26a42', '#8b4d3c', '#4a2a24'],
  stocking: ['#3a5058', '#22333a', '#121c21'],
  wallTop: '#b25a36', wallBot: '#3e1e1c', floor: '#2e1816', ink: '#2a1410',
  lens: ['#fffdf4', '#ffe9c8', '#f5b886'],
};
const NIGHT: Light = {
  warm: false,
  skin: ['#ffcf98', '#dc8d64', '#5e4048'],
  hair: ['#d0632f', '#6a2e22', '#24161a'],
  dress: ['#6b8f88', '#2b4a55', '#12222a'],
  scarf: ['#ff9b55', '#da603a', '#6e2a1e'],
  cream: ['#ffe7c4', '#b8a08a', '#3e3e46'],
  iron: ['#55605a', '#1d313c', '#0b151a'],
  box: ['#ffa362', '#d65d33', '#5e2a22'],
  boxB: ['#ffd2a4', '#c4927a', '#4e3a3e'],
  wood: ['#d07a48', '#6e3a2e', '#24171a'],
  stocking: ['#40585a', '#1a2a32', '#0b151a'],
  wallTop: '#26404c', wallBot: '#0e1a20', floor: '#101c22', ink: '#120e12',
  lens: ['#fffcf2', '#ffefcf', '#ffbf80'],
};

// ---------------- pose ----------------
type Expr = 'focus' | 'squint' | 'tired' | 'joy';
type Pose = {
  lean: number; neckLean: number; headTilt: number; expr: Expr;
  arms: 'work' | 'chin' | 'cheer'; legs: 'treadle' | 'kick'; tip: number; scarfWave: number;
};

// ---------------- world layout ----------------
const HIP: P = [460, 1880];
const FLOOR = 2400;
const TABLE_Y = 1560;
const NEEDLE: P = [930, 1490];
const STACK_X = 1392, BOX_W = 204, BOX_H = 100;
const BOARD = {x: 930, y: 760, w: 330, h: 280};
const LAMP = {base: [1120, 1556] as P, j1: [1158, 1190] as P, head: [1046, 1108] as P, target: [915, 1480] as P};

// ---------------- small parts ----------------
const Finger: React.FC<{b: P; a: number; L: number; w: number; curl: number; fill: string}> = ({b, a, L, w, curl, fill}) => {
  const d1: P = [Math.cos(a * D), Math.sin(a * D)];
  const mid: P = [b[0] + (d1[0] * L) / 2, b[1] + (d1[1] * L) / 2];
  const a2 = a + curl;
  const d2: P = [Math.cos(a2 * D), Math.sin(a2 * D)];
  const tip: P = [mid[0] + (d2[0] * L) / 2, mid[1] + (d2[1] * L) / 2];
  const n1: P = [-d1[1], d1[0]], nm: P = [-(d1[1] + d2[1]) / 2, (d1[0] + d2[0]) / 2], n2: P = [-d2[1], d2[0]];
  const w0 = w / 2, wm = w * 0.46, w1 = w * 0.36;
  const p = [
    [b[0] + n1[0] * w0, b[1] + n1[1] * w0], [mid[0] + nm[0] * wm, mid[1] + nm[1] * wm], [tip[0] + n2[0] * w1, tip[1] + n2[1] * w1],
  ];
  const q = [
    [tip[0] - n2[0] * w1, tip[1] - n2[1] * w1], [mid[0] - nm[0] * wm, mid[1] - nm[1] * wm], [b[0] - n1[0] * w0, b[1] - n1[1] * w0],
  ];
  const cap: P = [tip[0] + d2[0] * w1 * 1.3, tip[1] + d2[1] * w1 * 1.3];
  return (
    <path
      d={`M${p[0][0]} ${p[0][1]} L${p[1][0]} ${p[1][1]} L${p[2][0]} ${p[2][1]} Q${cap[0]} ${cap[1]} ${q[0][0]} ${q[0][1]} L${q[1][0]} ${q[1][1]} L${q[2][0]} ${q[2][1]} Z`}
      fill={fill}
    />
  );
};

// Big expressive hand. Local +x = direction fingers point. type flat|fist|cup
const Hand: React.FC<{at: P; ang: number; type: 'flat' | 'fist' | 'cup'; fill: string; shade: string; flip?: boolean; s?: number}> = ({at, ang, type, fill, shade, flip, s = 1}) => {
  const sy = flip ? -1 : 1;
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${ang}) scale(${s} ${s * sy})`}>
      {type === 'flat' && (
        <>
          <path d="M-6 -24 L64 -34 L86 -14 L84 18 L58 30 L-4 24 Z" fill={fill} />
          <Finger b={[66, -28]} a={-12} L={70} w={19} curl={14} fill={fill} />
          <Finger b={[80, -14]} a={-3} L={78} w={20} curl={18} fill={fill} />
          <Finger b={[84, 2]} a={6} L={72} w={19} curl={22} fill={fill} />
          <Finger b={[78, 17]} a={16} L={56} w={17} curl={24} fill={fill} />
          <Finger b={[20, -24]} a={-52} L={62} w={21} curl={40} fill={fill} />
          <path d="M-4 24 L58 30 L84 18 L80 8 L56 20 L0 16 Z" fill={shade} opacity={0.8} />
        </>
      )}
      {type === 'fist' && (
        <>
          <path d="M-6 -30 L58 -40 L78 -20 L80 30 L50 44 L-4 30 Z" fill={fill} />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={60} y={-36 + k * 19} width={34} height={19} rx={9} fill={k % 2 ? fill : fill} stroke={shade} strokeWidth={3} />
          ))}
          <Finger b={[18, -32]} a={-8} L={70} w={22} curl={10} fill={fill} />
          <path d="M-4 30 L50 44 L80 30 L78 22 L48 34 L0 22 Z" fill={shade} opacity={0.8} />
        </>
      )}
      {type === 'cup' && (
        <>
          <path d="M-6 -24 L60 -30 L80 -10 L78 18 L54 28 L-4 22 Z" fill={fill} />
          <Finger b={[64, -24]} a={10} L={66} w={19} curl={50} fill={fill} />
          <Finger b={[76, -10]} a={18} L={72} w={20} curl={52} fill={fill} />
          <Finger b={[78, 6]} a={26} L={66} w={19} curl={54} fill={fill} />
          <Finger b={[70, 18]} a={34} L={52} w={17} curl={50} fill={fill} />
        </>
      )}
    </g>
  );
};

// ---------------- the head (local coords: origin at neck joint, nose points +x) ----------------
const Head: React.FC<{pre: string; L: Light; expr: Expr; sil?: string}> = ({pre, L, expr, sil}) => {
  const g = (m: string) => (sil ? sil : `url(#${pre}${m})`);
  const ink = sil || L.ink;
  // brows: thick wedges; angle by expression (+ = inner/front end lower = cross)
  const brow = {focus: [0, 0], squint: [12, 10], tired: [-16, -4], joy: [-6, -18]}[expr];
  const mouth = {
    focus: <path d="M104 18 L124 14" stroke={ink} strokeWidth={6} strokeLinecap="round" />,
    squint: <ellipse cx={116} cy={18} rx={6} ry={7} fill={ink} />,
    tired: <path d="M100 22 Q108 16 114 22 Q120 27 126 20" stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />,
    joy: <path d="M98 12 Q112 30 130 8" stroke={ink} strokeWidth={6} fill="none" strokeLinecap="round" />,
  }[expr];
  return (
    <g>
      {/* hair back mass: stiff bob */}
      <path d="M122 -214 C126 -300 34 -338 -50 -310 L-112 -246 L-132 -70 L-124 46 L-14 16 L-40 -40 Z" fill={g('hair')} />
      {/* face: angular jaw, pointed chin */}
      <path d="M-70 -150 L-56 -252 L40 -286 L118 -232 L130 -150 L122 -112 L118 -42 L124 0 L114 30 L100 64 L72 60 L-8 24 L-44 -16 L-70 -60 Z" fill={g('skin')} />
      {!sil && <path d="M-44 -16 L-8 24 L72 60 L100 64 L96 54 L66 46 L0 12 Z" fill={L.skin[2]} opacity={0.55} />}
      {!sil && <ellipse cx={64} cy={-30} rx={22} ry={14} fill={L.scarf[1]} opacity={0.35} />}
      {/* far lens (behind nose) */}
      {!sil && (
        <>
          <circle cx={156} cy={-96} r={44} fill={`url(#${pre}glow)`} />
          <circle cx={156} cy={-96} r={29} fill={`url(#${pre}lens)`} stroke={L.ink} strokeWidth={7} />
        </>
      )}
      {/* nose: big and pointed */}
      <path d="M116 -132 L204 -46 L178 -34 L136 -28 L116 -42 Z" fill={g('skin')} />
      {!sil && <path d="M204 -46 L178 -34 L136 -28 L140 -38 L182 -42 Z" fill={L.skin[2]} opacity={0.7} />}
      {mouth && !sil && mouth}
      {/* near lens: glowing cream disc that hides the eye */}
      {!sil && (
        <>
          <circle cx={76} cy={-96} r={62} fill={`url(#${pre}glow)`} />
          <circle cx={76} cy={-96} r={42} fill={`url(#${pre}lens)`} stroke={L.ink} strokeWidth={8} />
          <path d="M60 -120 Q70 -128 84 -126" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.75} />
          <path d="M118 -100 Q124 -108 128 -100" stroke={L.ink} strokeWidth={7} fill="none" />
          <path d="M34 -98 L-20 -104" stroke={L.ink} strokeWidth={7} />
        </>
      )}
      {sil && <circle cx={76} cy={-96} r={46} fill={sil} />}
      {/* brows: thick and bold */}
      {!sil && (
        <>
          <g transform={`translate(0 ${brow[1]}) rotate(${brow[0]} 84 -156)`}>
            <path d="M34 -150 L72 -170 L132 -166 L130 -146 L74 -152 L38 -136 Z" fill={L.ink} />
          </g>
          <g transform={`translate(0 ${brow[1]}) rotate(${-brow[0] * 0.8} 156 -152)`}>
            <path d="M140 -160 L184 -158 L182 -142 L142 -146 Z" fill={L.ink} />
          </g>
        </>
      )}
      {/* fringe: hard straight cut */}
      <path d="M132 -206 L136 -176 L44 -184 L-24 -168 L-36 -244 C6 -310 104 -296 132 -206 Z" fill={g('hair')} />
      {/* side panel of the bob, sharp point at the jaw */}
      <path d="M-24 -168 L4 -160 L18 30 L-22 34 L-50 -96 Z" fill={g('hair')} />
      {!sil && (
        <>
          <path d="M-30 -262 C18 -300 86 -290 118 -232" stroke={L.hair[0]} strokeWidth={12} fill="none" opacity={0.9} />
          <circle cx={4} cy={44} r={9} fill={L.scarf[0]} />
        </>
      )}
    </g>
  );
};

const Box: React.FC<{c: P; i: number; pre: string; L: Light}> = ({c, i, pre, L}) => {
  const b = i % 3 === 1 ? 'boxB' : 'box';
  const lid = i % 2 ? L.iron[0] : L.wood[1];
  const tilt = ((i * 37) % 7) - 3;
  return (
    <g transform={`translate(${c[0] + (((i * 53) % 13) - 6)} ${c[1]}) rotate(${tilt * 0.6})`}>
      <rect x={-BOX_W / 2} y={-BOX_H / 2} width={BOX_W} height={BOX_H} fill={`url(#${pre}${b})`} />
      <path d={`M${-BOX_W / 2 - 8} ${-BOX_H / 2 - 6} L${BOX_W / 2 + 6} ${-BOX_H / 2 - 8} L${BOX_W / 2 + 8} ${-BOX_H / 2 + 22} L${-BOX_W / 2 - 6} ${-BOX_H / 2 + 22} Z`} fill={lid} />
      <rect x={8} y={-4} width={70} height={36} fill={L.cream[0]} opacity={0.9} transform="rotate(-2)" />
      <path d="M16 24 L16 10 Q26 6 34 14 L58 18 Q70 20 70 26 L70 28 L16 28 Z" fill={L.iron[1]} />
    </g>
  );
};

// ---------------- one panel ----------------
type PanelSpec = {n: number; cam: [number, number, number]; pose: Pose; L: Light; count: number; lampOn: boolean};

const Panel: React.FC<PanelSpec> = ({n, cam, pose, L, count, lampOn}) => {
  const pre = `p${n}`;
  const [cx, cy, cw] = cam;
  const ch = (cw * 16) / 9;
  const zoom = 1080 / cw;
  const lightRight = !L.warm;

  // ----- skeleton -----
  const lean = pose.lean;
  const NB = add(HIP, rot([20, -535], lean));
  const na = lean + pose.neckLean;
  const HO = add(NB, [170 * Math.sin(na * D), -170 * Math.cos(na * D)]);
  const headRot = pose.headTilt;
  const headPt = (p: P) => add(HO, rot(p, headRot));
  const chin = headPt([96, 62]);
  const sN = add(HIP, rot([28, -492], lean));
  const sF = add(HIP, rot([52, -505], lean));

  let wN: P, wF: P, angN: number, angF: number, typeN: 'flat' | 'fist' | 'cup', typeF: 'flat' | 'fist' | 'cup', sgnN = 1, sgnF = 1;
  if (pose.arms === 'work') {
    wN = [838, 1500]; wF = [960, 1486]; angN = -6; angF = 6; typeN = 'flat'; typeF = 'flat';
  } else if (pose.arms === 'chin') {
    wN = add(chin, [-30, 70]); angN = -70; typeN = 'fist'; sgnN = 1;
    wF = [930, 1500]; angF = 18; typeF = 'flat';
  } else {
    wN = add(HO, [190, -400]); angN = -64; typeN = 'flat'; sgnN = 1;
    wF = add(HO, [-120, -390]); angF = -112; typeF = 'flat'; sgnF = -1;
  }
  wN = reach(sN, wN, 405); wF = reach(sF, wF, 405);
  const eN = ik(sN, wN, 210, 200, sgnN), eF = ik(sF, wF, 210, 200, sgnF);

  // legs
  let knee: P, foot: P, knee2: P, foot2: P;
  if (pose.legs === 'treadle') {
    foot = [760, 2330]; knee = ik(HIP, foot, 270, 470, -1);
    foot2 = [700, 2340]; knee2 = ik(add(HIP, [-20, 0]), foot2, 270, 470, -1);
  } else {
    foot = [1010, 2050]; knee = ik(HIP, foot, 270, 470, -1);
    foot2 = [620, 2230]; knee2 = ik(add(HIP, [-20, 0]), foot2, 270, 470, -1);
  }

  // lamp shade geometry
  const dv: P = [LAMP.target[0] - LAMP.head[0], LAMP.target[1] - LAMP.head[1]];
  const dl = Math.hypot(dv[0], dv[1]);
  const u: P = [dv[0] / dl, dv[1] / dl], nrm: P = [-u[1], u[0]];
  const mouthC: P = [LAMP.head[0] + u[0] * 120, LAMP.head[1] + u[1] * 120];
  const shade: P[] = [
    [LAMP.head[0] + nrm[0] * 20, LAMP.head[1] + nrm[1] * 20], [mouthC[0] + nrm[0] * 74, mouthC[1] + nrm[1] * 74],
    [mouthC[0] - nrm[0] * 74, mouthC[1] - nrm[1] * 74], [LAMP.head[0] - nrm[0] * 20, LAMP.head[1] - nrm[1] * 20],
  ];

  // tally marks
  const tally = (k: number): [P, P] => {
    const g = Math.floor(k / 5), j = k % 5, gx = BOARD.x + 44 + g * 130;
    if (j < 4) return [[gx + j * 24, BOARD.y + 120], [gx + j * 24 + 3, BOARD.y + 232]];
    return [[gx - 14, BOARD.y + 214], [gx + 90, BOARD.y + 138]];
  };

  const grad = (id: string, t: Tones) => (
    <linearGradient id={pre + id} x1={lightRight ? '1' : '0'} y1="0" x2={lightRight ? '0' : '1'} y2="0.5">
      <stop offset="0" stopColor={t[0]} />
      <stop offset="0.34" stopColor={t[0]} />
      <stop offset="0.5" stopColor={t[1]} />
      <stop offset="0.68" stopColor={t[1]} />
      <stop offset="0.86" stopColor={t[2]} />
      <stop offset="1" stopColor={t[2]} />
    </linearGradient>
  );

  const shadowC = L.warm ? '#5a2318' : '#04090c';
  const silOffset: P = L.warm ? [330, -40] : [-360, -90];
  const silScale = L.warm ? 1.12 : 1.32;

  const Character = (
    <g>
      {/* stool */}
      <g>
        <path d={`M372 1912 L330 ${FLOOR} L352 ${FLOOR} L398 1912 Z`} fill={`url(#${pre}wood)`} />
        <path d={`M548 1912 L596 ${FLOOR} L574 ${FLOOR} L526 1912 Z`} fill={`url(#${pre}wood)`} />
        <path d={`M352 2200 L584 2196 L582 2212 L350 2216 Z`} fill={L.wood[2]} />
        <path d="M336 1890 L590 1884 L598 1918 L330 1924 Z" fill={L.scarf[1]} />
      </g>
      {/* far leg */}
      <Limb a={[HIP[0] - 20, HIP[1]]} b={knee2} w0={40} w1={26} fill={L.dress[2]} />
      <Limb a={knee2} b={foot2} w0={20} w1={11} fill={L.stocking[2]} />
      <path d={`M${foot2[0] - 24} ${foot2[1] - 14} L${foot2[0] + 66} ${foot2[1] + 4} L${foot2[0] + 60} ${foot2[1] + 18} L${foot2[0] - 26} ${foot2[1] + 14} Z`} fill={L.ink} />
      {/* far arm (behind torso) */}
      <Limb a={sF} b={eF} w0={25} w1={19} fill={L.dress[2]} />
      <Limb a={eF} b={wF} w0={17} w1={12} fill={L.skin[2]} />
      <Hand at={wF} ang={angF} type={typeF} fill={L.skin[1]} shade={L.skin[2]} flip={pose.arms === 'cheer'} />
      {/* torso: long and slim */}
      <g transform={`translate(${HIP[0]} ${HIP[1]}) rotate(${lean})`}>
        <path d="M-78 30 L-70 -120 L-62 -320 L-48 -486 L-18 -538 L44 -544 L76 -500 L98 -404 L62 -262 L90 -96 L100 30 Z" fill={`url(#${pre}dress)`} />
        <path d="M-66 -268 L70 -276 L66 -250 L-64 -244 Z" fill={L.dress[2]} />
        <circle cx={60} cy={-262} r={9} fill={L.cream[1]} />
        {/* collar */}
        <path d="M-6 -538 L38 -486 L30 -546 Z" fill={`url(#${pre}cream)`} />
        <path d="M30 -546 L82 -506 L56 -548 Z" fill={`url(#${pre}cream)`} />
      </g>
      {/* near leg: thigh in skirt, slim shin, pointed shoe */}
      <Limb a={HIP} b={knee} w0={40} w1={24} fill={L.dress[1]} />
      {(() => {
        const dx = knee[0] - HIP[0], dy = knee[1] - HIP[1], d = Math.hypot(dx, dy);
        const u2: P = [dx / d, dy / d], n2: P = [-u2[1], u2[0]];
        const hem = add(knee, [u2[0] * 34, u2[1] * 34]);
        return (
          <polygon
            points={pts([
              add(HIP, [-80, -30]), add(HIP, [96, -40]),
              add(hem, [-n2[0] * 52, -n2[1] * 52]), add(hem, [n2[0] * 58, n2[1] * 58]), add(HIP, [-60, 70]),
            ])}
            fill={`url(#${pre}dress)`}
          />
        );
      })()}
      <Limb a={knee} b={foot} w0={21} w1={11} fill={`url(#${pre}stocking)`} />
      <path d={`M${foot[0] - 26} ${foot[1] - 16} L${foot[0] + 80} ${foot[1] + 2} L${foot[0] + 70} ${foot[1] + 20} L${foot[0] - 28} ${foot[1] + 16} Z`} fill={L.ink} />
      <rect x={foot[0] - 30} y={foot[1] + 10} width={14} height={22} fill={L.ink} />
      {/* neck: long and thin */}
      <polygon
        points={pts([
          add(NB, rot([-24, 10], na)), add(NB, rot([26, 10], na)), add(HO, rot([30, 30], na)), add(HO, rot([-20, 30], na)),
        ])}
        fill={`url(#${pre}skin)`}
      />
      <polygon points={pts([add(HO, rot([-20, 30], na)), add(HO, rot([30, 30], na)), add(HO, rot([28, 70], na)), add(HO, rot([-22, 74], na))])} fill={L.skin[2]} opacity={0.7} />
      {/* head */}
      <g transform={`translate(${HO[0]} ${HO[1]}) rotate(${headRot})`}>
        <Head pre={pre} L={L} expr={pose.expr} />
      </g>
      {/* neckerchief: orange accent, ends flowing */}
      {(() => {
        const k = add(HIP, rot([58, -526], lean));
        const w = pose.scarfWave;
        const e1 = add(k, rot([50 + w * 70, 120 - w * 70], lean)), e2 = add(k, rot([18 + w * 90, 160 - w * 60], lean));
        const m1 = add(k, rot([44, 50 - w * 30], lean)), m2 = add(k, rot([20, 80 - w * 30], lean));
        return (
          <g>
            <path d={`M${k[0]} ${k[1] - 16} Q${m1[0]} ${m1[1]} ${e1[0]} ${e1[1]} L${e1[0] + 18} ${e1[1] + 22} Q${m1[0] + 20} ${m1[1] + 30} ${k[0] + 6} ${k[1] + 8} Z`} fill={`url(#${pre}scarf)`} />
            <path d={`M${k[0]} ${k[1]} Q${m2[0]} ${m2[1]} ${e2[0]} ${e2[1]} L${e2[0] + 22} ${e2[1] + 12} Q${m2[0] + 26} ${m2[1] + 16} ${k[0] + 10} ${k[1] + 14} Z`} fill={L.scarf[2]} />
            <path d={`M${k[0] - 56} ${k[1] - 30} L${k[0] + 30} ${k[1] - 22} L${k[0] + 20} ${k[1] + 12} Z`} fill={`url(#${pre}scarf)`} transform={`rotate(${lean} ${k[0]} ${k[1]})`} />
            <circle cx={k[0] + 8} cy={k[1] - 2} r={17} fill={L.scarf[0]} />
          </g>
        );
      })()}
      {/* near arm */}
      <Limb a={sN} b={eN} w0={28} w1={21} fill={`url(#${pre}dress)`} />
      <Limb a={eN} b={wN} w0={19} w1={13} fill={`url(#${pre}skin)`} />
      <polygon points={pts(limb(eN, add(eN, [(wN[0] - eN[0]) * 0.18, (wN[1] - eN[1]) * 0.18]), 24, 22))} fill={L.dress[0]} />
      <Hand at={wN} ang={angN} type={typeN} fill={L.skin[0]} shade={L.skin[2]} />
    </g>
  );

  return (
    <svg width={1080} height={1920} viewBox={`${cx} ${cy} ${cw} ${ch}`} style={{display: 'block'}}>
      <defs>
        {grad('skin', L.skin)}{grad('hair', L.hair)}{grad('dress', L.dress)}{grad('scarf', L.scarf)}
        {grad('cream', L.cream)}{grad('stocking', L.stocking)}{grad('iron', L.iron)}{grad('box', L.box)}{grad('boxB', L.boxB)}{grad('wood', L.wood)}
        <linearGradient id={pre + 'wall'} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={L.wallTop} />
          <stop offset="1" stopColor={L.wallBot} />
        </linearGradient>
        <radialGradient id={pre + 'lens'} cx="0.42" cy="0.4" r="0.65">
          <stop offset="0" stopColor={L.lens[0]} />
          <stop offset="0.6" stopColor={L.lens[1]} />
          <stop offset="1" stopColor={L.lens[2]} />
        </radialGradient>
        <radialGradient id={pre + 'glow'}>
          <stop offset="0.55" stopColor={L.lens[1]} stopOpacity={0.55} />
          <stop offset="1" stopColor={L.lens[2]} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={pre + 'sun'}>
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.3" stopColor="#ffd08a" stopOpacity={0.9} />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={pre + 'beam'} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor={L.warm ? '#ffd9a0' : '#ffc070'} stopOpacity={0.75} />
          <stop offset="1" stopColor={L.warm ? '#ff9a4a' : '#ff8a3a'} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={pre + 'cone'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd59a" stopOpacity={0.7} />
          <stop offset="1" stopColor="#ff8a3a" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={pre + 'pool'}>
          <stop offset="0" stopColor="#ffb766" stopOpacity={0.75} />
          <stop offset="1" stopColor="#ff8a3a" stopOpacity={0} />
        </radialGradient>
        <filter id={pre + 'cut'} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency={0.02 * zoom} numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={7 / zoom} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={pre + 'chalk'} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency={0.6} numOctaves={2} seed={3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={7} />
        </filter>
        <filter id={pre + 'soft'}><feGaussianBlur stdDeviation={18} /></filter>
      </defs>

      {/* ===== minimal background ===== */}
      <rect x={-200} y={-200} width={2200} height={3200} fill={`url(#${pre}wall)`} />
      {/* window (left) */}
      <g filter={`url(#${pre}cut)`}>
        <rect x={60} y={260} width={420} height={800} fill={L.warm ? '#ffcf8f' : '#14283a'} />
        {L.warm ? (
          <>
            <rect x={60} y={260} width={420} height={800} fill="#ff9d55" opacity={0.45} />
            <circle cx={300} cy={760} r={240} fill={`url(#${pre}sun)`} />
            <circle cx={300} cy={760} r={74} fill="#fff4da" />
            <path d="M60 900 L170 880 L200 840 L300 860 L380 820 L480 850 L480 1060 L60 1060 Z" fill="#c2603a" opacity={0.75} />
          </>
        ) : (
          <>
            <circle cx={360} cy={420} r={34} fill="#cfd8d0" opacity={0.85} />
            <path d="M60 940 L160 920 L210 880 L320 900 L400 870 L480 890 L480 1060 L60 1060 Z" fill="#0b151a" />
          </>
        )}
        <rect x={256} y={260} width={22} height={800} fill={L.warm ? '#6e2f22' : '#0b151a'} />
        <rect x={60} y={640} width={420} height={22} fill={L.warm ? '#6e2f22' : '#0b151a'} />
        <rect x={52} y={252} width={436} height={816} fill="none" stroke={L.warm ? '#6e2f22' : '#0b151a'} strokeWidth={26} />
      </g>

      {/* sunrise: lit window patch + muntin shadows thrown across the wall */}
      {L.warm && (
        <g style={{mixBlendMode: 'screen'}}>
          <polygon points="700,520 1300,700 1300,1400 700,1180" fill="#ffc27a" opacity={0.38} />
        </g>
      )}

      {/* chalkboard with tally */}
      <g filter={`url(#${pre}cut)`}>
        <rect x={BOARD.x - 14} y={BOARD.y - 14} width={BOARD.w + 28} height={BOARD.h + 28} fill={L.wood[1]} />
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.w} height={BOARD.h} fill={L.warm ? '#2a3a3c' : '#101c22'} />
      </g>
      <text x={BOARD.x + 40} y={BOARD.y + 76} fontFamily="DejaVu Serif" fontWeight={700} fontSize={44} letterSpacing={7} fill="#f7efe2" opacity={0.85} filter={`url(#${pre}chalk)`}>PAIRS</text>
      <g filter={`url(#${pre}chalk)`}>
        {Array.from({length: count}).map((_, k) => {
          const [a, b] = tally(k);
          return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f7efe2" strokeWidth={10} strokeLinecap="round" opacity={0.9} />;
        })}
      </g>

      {/* window light falling on the wall: cross shadow of the muntins + her cast shadow */}
      {L.warm && (
        <g>
          <polygon points="980,560 1010,566 1010,1270 980,1258" fill={shadowC} opacity={0.35} />
          <polygon points="700,850 1300,1000 1300,1030 700,880" fill={shadowC} opacity={0.35} />
        </g>
      )}
      {/* her hard cast shadow on the wall (lamp at night: behind-left; sun at dawn: right) */}
      <g opacity={L.warm ? 0.38 : 0.62} transform={`translate(${HO[0] + silOffset[0]} ${HO[1] + silOffset[1]}) scale(${silScale}) rotate(${headRot})`}>
        <Head pre={pre} L={L} expr={pose.expr} sil={shadowC} />
      </g>
      <g opacity={L.warm ? 0.3 : 0.55}>
        <polygon points={pts([add(NB, [silOffset[0] - 70, silOffset[1] + 30]), add(NB, [silOffset[0] + 90, silOffset[1] + 30]), add(HIP, [silOffset[0] * 1.2 + 140, -200]), add(HIP, [silOffset[0] * 1.2 - 120, -200])])} fill={shadowC} />
      </g>

      {/* floor */}
      <rect x={-200} y={2240} width={2200} height={800} fill={L.floor} />
      <rect x={-200} y={2240} width={2200} height={14} fill={L.ink} opacity={0.5} />

      {/* ===== table, machine, lamp ===== */}
      <g filter={`url(#${pre}cut)`}>
        {/* table legs and treadle */}
        <path d={`M712 1590 L746 1590 L730 ${FLOOR} L692 ${FLOOR} Z`} fill={L.iron[2]} />
        <path d={`M1248 1590 L1282 1590 L1300 ${FLOOR} L1262 ${FLOOR} Z`} fill={L.iron[2]} />
        <path d="M660 2330 L860 2318 L866 2346 L664 2356 Z" fill={L.iron[1]} />
        <circle cx={1180} cy={2080} r={110} fill="none" stroke={L.iron[1]} strokeWidth={16} />
        {[0, 72, 144, 216, 288].map((a) => <line key={a} x1={1180} y1={2080} x2={1180 + 104 * Math.cos((a + 20) * D)} y2={2080 + 104 * Math.sin((a + 20) * D)} stroke={L.iron[1]} strokeWidth={9} />)}
        {/* table top */}
        <path d="M690 1556 L1320 1548 L1326 1592 L686 1598 Z" fill={`url(#${pre}wood)`} />
        {/* machine */}
        <path d="M780 1500 L1300 1494 L1304 1556 L776 1560 Z" fill={`url(#${pre}iron)`} />
        <path d="M884 1268 L1250 1258 Q1272 1262 1268 1300 L1262 1500 L1196 1500 L1200 1336 L986 1342 L984 1424 L888 1426 Z" fill={`url(#${pre}iron)`} />
        <path d="M900 1290 L1236 1282" stroke={L.wood[0]} strokeWidth={6} opacity={0.8} />
        <path d="M904 1304 L1220 1298" stroke={L.scarf[1]} strokeWidth={3} opacity={0.7} />
        <rect x={924} y={1424} width={12} height={44} fill={L.cream[1]} />
        <line x1={930} y1={1468} x2={930} y2={1492} stroke={L.cream[0]} strokeWidth={4} />
        <rect x={1068} y={1206} width={10} height={56} fill={L.iron[2]} />
        <path d="M1046 1214 L1102 1210 L1104 1246 L1048 1250 Z" fill={L.scarf[1]} />
        <path d="M1074 1226 Q1000 1230 962 1290 L934 1426" stroke={L.scarf[0]} strokeWidth={3} fill="none" />
        <circle cx={1288} cy={1316} r={78} fill="none" stroke={`url(#${pre}scarf)`} strokeWidth={16} />
        {[10, 82, 154, 226, 298].map((a) => <line key={a} x1={1288} y1={1316} x2={1288 + 72 * Math.cos(a * D)} y2={1316 + 72 * Math.sin(a * D)} stroke={L.iron[2]} strokeWidth={9} />)}
        <circle cx={1288} cy={1316} r={16} fill={L.iron[0]} />
        {/* shoe being stitched */}
        <path d="M870 1500 L872 1458 Q896 1446 920 1458 L974 1468 Q1012 1476 1016 1492 L1016 1500 Z" fill={`url(#${pre}box)`} />
        <path d="M866 1494 L1020 1494 L1020 1504 L866 1504 Z" fill={L.cream[0]} />
        {/* desk lamp */}
        <path d={`M${LAMP.base[0] - 62} ${LAMP.base[1]} L${LAMP.base[0] + 62} ${LAMP.base[1]} L${LAMP.base[0] + 40} ${LAMP.base[1] - 26} L${LAMP.base[0] - 40} ${LAMP.base[1] - 26} Z`} fill={L.iron[1]} />
        <line x1={LAMP.base[0]} y1={LAMP.base[1] - 20} x2={LAMP.j1[0]} y2={LAMP.j1[1]} stroke={L.iron[1]} strokeWidth={14} strokeLinecap="round" />
        <line x1={LAMP.j1[0]} y1={LAMP.j1[1]} x2={LAMP.head[0]} y2={LAMP.head[1]} stroke={L.iron[1]} strokeWidth={14} strokeLinecap="round" />
        <circle cx={LAMP.j1[0]} cy={LAMP.j1[1]} r={14} fill={L.scarf[1]} />
        <polygon points={pts(shade)} fill={`url(#${pre}iron)`} />
        <polygon points={pts([shade[1], shade[2], add(mouthC, [u[0] * 12 - nrm[0] * 70, u[1] * 12 - nrm[1] * 70]), add(mouthC, [u[0] * 12 + nrm[0] * 70, u[1] * 12 + nrm[1] * 70])])} fill={lampOn ? '#ffe2b0' : L.iron[2]} />
      </g>

      {/* boxes */}
      <g filter={`url(#${pre}cut)`}>
        {Array.from({length: count}).map((_, i) => <Box key={i} c={[STACK_X, FLOOR - BOX_H * (i + 0.5)]} i={i} pre={pre} L={L} />)}
      </g>

      {/* ===== character ===== */}
      <g filter={`url(#${pre}cut)`}>
        {pose.tip ? <g transform={`rotate(${pose.tip} 340 ${FLOOR})`}>{Character}</g> : Character}
      </g>

      {/* ===== light: sunrise shafts / lamp cone ===== */}
      {L.warm && (
        <g style={{mixBlendMode: 'screen'}}>
          <polygon points="260,300 480,300 1320,1300 1320,1700" fill={`url(#${pre}beam)`} opacity={0.5} />
          <polygon points="80,700 300,660 1100,2000 800,2200" fill={`url(#${pre}beam)`} opacity={0.32} />
        </g>
      )}
      {lampOn && (
        <g style={{mixBlendMode: 'screen'}}>
          <polygon points={pts([shade[1], shade[2], [1150, 1560], [700, 1560]])} fill={`url(#${pre}cone)`} opacity={0.95} />
          <ellipse cx={920} cy={1540} rx={300} ry={90} fill={`url(#${pre}pool)`} />
          <circle cx={mouthC[0]} cy={mouthC[1]} r={170} fill={`url(#${pre}pool)`} />
        </g>
      )}
      {/* night air: cool falloff away from the lamp */}
      {!L.warm && (
        <rect x={-200} y={-200} width={2200} height={3200} fill="#0b151a" opacity={0.08} style={{mixBlendMode: 'multiply'}} />
      )}
    </svg>
  );
};

// ---------------- the strip ----------------
const PW = 1080, PH = 1920, GAP = 36;
export const STRIP_W = PW * 4 + GAP * 5, STRIP_H = PH + GAP * 2;

const SPECS: PanelSpec[] = [
  {n: 1, cam: [170, 640, 1000], L: WARM, count: 1, lampOn: false,
    pose: {lean: 12, neckLean: 18, headTilt: 22, expr: 'focus', arms: 'work', legs: 'treadle', tip: 0, scarfWave: 0.2}},
  {n: 2, cam: [560, 730, 600], L: NIGHT, count: 4, lampOn: true,
    pose: {lean: 20, neckLean: 22, headTilt: 30, expr: 'squint', arms: 'work', legs: 'treadle', tip: 0, scarfWave: 0.5}},
  {n: 3, cam: [470, 700, 1060], L: NIGHT, count: 8, lampOn: true,
    pose: {lean: 22, neckLean: 26, headTilt: 6, expr: 'tired', arms: 'chin', legs: 'treadle', tip: 0, scarfWave: 0.0}},
  {n: 4, cam: [20, 470, 1240], L: NIGHT, count: 10, lampOn: true,
    pose: {lean: -6, neckLean: -6, headTilt: -20, expr: 'joy', arms: 'cheer', legs: 'kick', tip: -3, scarfWave: 1.0}},
];

export const Storyboard: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    {SPECS.map((s, i) => (
      <div key={s.n} style={{position: 'absolute', left: GAP + i * (PW + GAP), top: GAP, width: PW, height: PH, overflow: 'hidden', background: '#0b151a'}}>
        <Panel {...s} />
        <Img src={staticFile('mottle.png')} style={{position: 'absolute', inset: 0, width: PW, height: PH, mixBlendMode: 'soft-light', opacity: 0.3}} />
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 60% at 50% 48%, rgba(11,21,26,0) 50%, rgba(11,21,26,0.35) 82%, rgba(11,21,26,0.7) 100%)'}} />
        <Img src={staticFile(`grain${i * 2}.png`)} style={{position: 'absolute', inset: 0, width: PW, height: PH, mixBlendMode: 'overlay', opacity: 0.2}} />
      </div>
    ))}
  </AbsoluteFill>
);
