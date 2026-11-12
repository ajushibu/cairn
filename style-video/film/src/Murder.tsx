import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Hand, Limb, ik, rot, add, pts, clamp, reach, D} from './Storyboard';

// =====================================================================
// 7 s, 5 shots: the problem of evil. Same caricature style as the
// workshop film. Violence is implied (shadows), never shown.
// =====================================================================
type P = [number, number];
type Tones = [string, string, string];

export const CUTS = [1.4, 2.55, 4.1, 5.0];
export const T_STAB = 5.5, T_HIT = 5.62, T_OUT = 6.15;

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const eio = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const eout = (p: number) => 1 - Math.pow(1 - p, 3);
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, p: number) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join('');
};
const jit = (af: number, k: number) => Math.sin(af * 91.3 + k * 17.7) * Math.cos(af * 37.1 + k * 3.1);

// ---------------- materials (night, amber lamp from low-left) ----------------
const M: Record<string, Tones> = {
  skin: ['#ffc48c', '#d0835e', '#55393f'],
  vskin: ['#ffcfa0', '#d8926c', '#5e4048'],
  quiff: ['#3a2a30', '#17121a', '#08070b'],
  vhair: ['#9a8a80', '#5e5250', '#2a2428'],
  coat: ['#33505c', '#172832', '#080f14'],
  shirt: ['#fff0d8', '#c8b49a', '#4a4248'],
  tie: ['#ff9a55', '#d65d33', '#6a2a1e'],
  pj: ['#ffa462', '#da603a', '#6e2a1e'],
  trous: ['#4e6f6c', '#22383f', '#0d1a20'],
  steel: ['#fff6e6', '#9fb0b0', '#2e3e46'],
  wood: ['#a0583a', '#5a2e24', '#22140f'],
};
const INK = '#120e12';

const Grads: React.FC<{pre: string}> = ({pre}) => (
  <>
    {Object.entries(M).map(([k, t]) =>
      [['L', 0, 0, 1, 0.4], ['R', 1, 0, 0, 0.4], ['U', 0.2, 1, 0, 0]].map(([d, x1, y1, x2, y2]) => (
        <linearGradient key={k + d} id={`${pre}${k}${d}`} x1={x1 as number} y1={y1 as number} x2={x2 as number} y2={y2 as number}>
          <stop offset="0" stopColor={t[0]} /><stop offset="0.32" stopColor={t[0]} />
          <stop offset="0.5" stopColor={t[1]} /><stop offset="0.68" stopColor={t[1]} />
          <stop offset="0.86" stopColor={t[2]} /><stop offset="1" stopColor={t[2]} />
        </linearGradient>
      )),
    )}
    <radialGradient id={pre + 'lens'} cx="0.42" cy="0.4" r="0.65">
      <stop offset="0" stopColor="#fffcf2" /><stop offset="0.6" stopColor="#ffefcf" /><stop offset="1" stopColor="#ffbf80" />
    </radialGradient>
    <radialGradient id={pre + 'glow'}>
      <stop offset="0.55" stopColor="#ffefcf" stopOpacity={0.55} /><stop offset="1" stopColor="#ffbf80" stopOpacity={0} />
    </radialGradient>
    <filter id={pre + 'sil'}><feFlood floodColor="#03070a" /><feComposite in2="SourceAlpha" operator="in" /></filter>
    <filter id={pre + 'cut'} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency={0.02} numOctaves={2} seed={4} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={7} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id={pre + 'blur'}><feGaussianBlur stdDeviation={16} /></filter>
  </>
);

// ---------------- heads ----------------
type HeadV = {who: 'killer' | 'victim'; brow: [number, number]; mouth: 'grin' | 'o' | 'flat'; dir: string};
const Head: React.FC<{pre: string; v: HeadV}> = ({pre, v}) => {
  const k = v.who === 'killer';
  const g = (m: string) => `url(#${pre}${m}${v.dir})`;
  const skin = g(k ? 'skin' : 'vskin');
  const sh = (k ? M.skin : M.vskin)[2];
  return (
    <g>
      {k ? (
        <path d="M118 -200 C150 -262 140 -332 70 -352 C10 -368 -70 -332 -100 -270 L-122 -140 L-106 -36 L-56 -28 L-46 -150 C-6 -192 60 -202 118 -200 Z" fill={g('quiff')} />
      ) : (
        <path d="M-50 -150 L-112 -178 L-130 -40 L-40 -8 L-26 -110 Z" fill={g('vhair')} />
      )}
      {/* face: long angular jaw, pointed chin */}
      <path d={k
        ? 'M-70 -150 L-56 -252 L40 -290 L118 -236 L130 -150 L122 -112 L118 -42 L126 0 L118 40 L104 92 L74 88 L-8 30 L-44 -16 L-70 -60 Z'
        : 'M-70 -150 L-56 -262 L40 -300 L118 -240 L130 -150 L122 -112 L120 -42 L128 0 L116 32 L96 60 L66 58 L-8 24 L-44 -16 L-70 -60 Z'} fill={skin} />
      <path d="M-44 -16 L-8 28 L72 74 L100 84 L96 70 L66 58 L0 14 Z" fill={sh} opacity={0.5} />
      {!k && <path d="M-40 -270 Q30 -312 110 -246" stroke="#ffffff" strokeWidth={10} fill="none" opacity={0.35} />}
      {/* far lens */}
      <circle cx={156} cy={-96} r={44} fill={`url(#${pre}glow)`} />
      <circle cx={156} cy={-96} r={29} fill={`url(#${pre}lens)`} stroke={INK} strokeWidth={7} />
      {/* nose: killer gets a long hooked beak */}
      {k
        ? <path d="M116 -136 L176 -100 L222 -38 L214 -20 L170 -18 L130 -26 L116 -42 Z" fill={skin} />
        : <path d="M116 -132 L196 -54 L176 -34 L136 -28 L116 -42 Z" fill={skin} />}
      {/* moustache */}
      {k
        ? <path d="M108 0 L160 -10 L168 -2 L112 10 Z" fill={INK} />
        : <path d="M92 -22 Q132 -42 178 -18 Q160 10 132 -4 Q112 8 92 -4 Z" fill={g('vhair')} />}
      {/* mouth */}
      {v.mouth === 'grin' && <path d="M100 28 Q124 40 146 18" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />}
      {v.mouth === 'o' && <ellipse cx={122} cy={22} rx={8} ry={12} fill={INK} />}
      {v.mouth === 'flat' && <path d="M104 28 L134 24" stroke={INK} strokeWidth={6} strokeLinecap="round" />}
      {/* near lens: glowing disc, eyes hidden */}
      <circle cx={76} cy={-96} r={62} fill={`url(#${pre}glow)`} />
      <circle cx={76} cy={-96} r={42} fill={`url(#${pre}lens)`} stroke={INK} strokeWidth={8} />
      <path d="M60 -120 Q70 -128 84 -126" stroke="#fff" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.75} />
      <path d="M118 -100 Q124 -108 128 -100" stroke={INK} strokeWidth={7} fill="none" />
      <path d="M34 -98 L-20 -104" stroke={INK} strokeWidth={7} />
      {/* brows */}
      <g transform={`translate(0 ${v.brow[1]}) rotate(${v.brow[0]} 84 -156)`}>
        <path d="M30 -150 L72 -174 L136 -168 L134 -146 L74 -154 L36 -134 Z" fill={INK} />
      </g>
      <g transform={`translate(0 ${v.brow[1]}) rotate(${-v.brow[0] * 0.8} 156 -152)`}>
        <path d="M140 -162 L188 -160 L186 -142 L142 -146 Z" fill={INK} />
      </g>
      {/* hair over the face */}
      {k ? (
        <>
          <path d="M60 -330 C120 -384 206 -346 200 -282 C194 -240 152 -228 128 -212 C150 -262 122 -302 60 -308 Z" fill={g('quiff')} />
          <path d="M-30 -160 L-8 -150 L-4 -40 L-26 -36 Z" fill={g('quiff')} />
          <path d="M-60 -300 C0 -350 90 -360 160 -320" stroke={M.quiff[0]} strokeWidth={8} fill="none" opacity={0.8} />
          <path d="M-40 -270 C20 -320 100 -330 150 -296" stroke={M.quiff[0]} strokeWidth={5} fill="none" opacity={0.6} />
        </>
      ) : (
        <>
          <path d="M-20 -250 Q30 -300 90 -262" stroke={M.vhair[1]} strokeWidth={5} fill="none" />
          <path d="M-30 -232 Q30 -290 100 -250" stroke={M.vhair[1]} strokeWidth={5} fill="none" />
        </>
      )}
    </g>
  );
};

// ---------------- knife (local: origin at guard, blade along +y) ----------------
const Knife: React.FC<{pre: string; L?: number; W?: number; droop?: number; wobble?: number; rubber?: number; gleam?: number; dir?: string}> = ({pre, L = 300, W = 46, droop = 0, wobble = 0, rubber = 0, gleam = -1, dir = 'L'}) => {
  const N = 16;
  const spine: P[] = [];
  let p: P = [0, 0], a = 0;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    spine.push(p);
    a = (droop * Math.pow(s, 1.4) + wobble * s * s) * D;
    p = [p[0] - Math.sin(a) * (L / N), p[1] + Math.cos(a) * (L / N)];
  }
  const back: P[] = [], edge: P[] = [];
  spine.forEach((q, i) => {
    const s = i / N;
    const a2 = (droop * Math.pow(s, 1.4) + wobble * s * s) * D;
    const n: P = [Math.cos(a2), Math.sin(a2)];
    const wb = W * 0.32 * (1 - s * 0.85), we = W * 0.68 * Math.pow(1 - s, 0.7) * (s < 0.1 ? 0.85 + s * 1.5 : 1);
    back.push([q[0] - n[0] * wb, q[1] - n[1] * wb]);
    edge.push([q[0] + n[0] * we, q[1] + n[1] * we]);
  });
  const blade = [...back, spine[N], ...edge.slice().reverse()];
  const fill = rubber > 0 ? undefined : `url(#${pre}steel${dir})`;
  const gl = gleam >= 0 && gleam <= 1 ? Math.round(gleam * N) : -1;
  return (
    <g>
      {/* handle + guard */}
      <path d={`M${-W * 0.42} -10 L${W * 0.42} -10 L${W * 0.5} ${-L * 0.42} Q0 ${-L * 0.47} ${-W * 0.5} ${-L * 0.42} Z`} fill={`url(#${pre}wood${dir})`} />
      {[0.15, 0.3].map((k) => <circle key={k} cx={0} cy={-L * k} r={W * 0.08} fill="#e8c27a" />)}
      <polygon points={pts(blade)} fill={fill || mix(M.steel[1], '#d98a7a', rubber)} />
      {rubber <= 0 && <polygon points={pts([...spine, ...edge.slice().reverse()])} fill={M.steel[0]} opacity={0.35} />}
      <polyline points={pts(spine.slice(1, N - 3))} fill="none" stroke={M.steel[2]} strokeWidth={W * 0.06} opacity={0.6} />
      <rect x={-W * 0.62} y={-14} width={W * 1.24} height={W * 0.3} rx={W * 0.1} fill="#c9a060" />
      {gl >= 0 && (
        <g style={{mixBlendMode: 'screen'}}>
          <polygon points={pts([back[Math.max(0, gl - 1)], back[Math.min(N, gl + 1)], edge[Math.min(N, gl + 1)], edge[Math.max(0, gl - 1)]])} fill="#ffffff" opacity={0.85} />
          <circle cx={edge[gl][0]} cy={edge[gl][1]} r={W * 0.16} fill="#fff4dc" opacity={0.8} />
          <polygon points={pts([[edge[gl][0], edge[gl][1] - W * 0.6], [edge[gl][0] + W * 0.08, edge[gl][1]], [edge[gl][0], edge[gl][1] + W * 0.6], [edge[gl][0] - W * 0.08, edge[gl][1]]])} fill="#ffffff" opacity={0.9} />
        </g>
      )}
    </g>
  );
};

// ---------------- the killer (local, facing +x; mirrored by caller) ----------------
const Killer: React.FC<{pre: string; raise: number; t: number; dir: string}> = ({pre, raise, t, dir}) => {
  const H: P = [790, 1290];
  const lean = lerp(28, 14, raise) + 1.2 * Math.sin(t * 5);
  const S = add(H, rot([0, -470], lean));
  const NB = add(H, rot([14, -486], lean));
  const na = lean + 18;
  const HO = add(NB, [150 * Math.sin(na * D), -150 * Math.cos(na * D)]);
  const sN = add(H, rot([20, -440], lean)), sF = add(H, rot([46, -452], lean));
  const wTarget: P = [lerp(1130, 900, raise), lerp(1170, 380, raise)];
  const wN = reach(sN, wTarget, 448);
  const eN = ik(sN, wN, 230, 220, -1);
  const wF = reach(sF, [1050, 1050], 448);
  const eF = ik(sF, wF, 230, 220, 1);
  const knifeRot = lerp(-12, -42, raise);
  const g = (m: string) => `url(#${pre}${m}${dir})`;
  return (
    <g>
      {/* legs + pointed shoes */}
      <Limb a={[H[0] - 30, H[1]]} b={[730, 1530]} w0={30} w1={20} fill={M.trous[2]} />
      <Limb a={[730, 1530]} b={[700, 1750]} w0={20} w1={13} fill={M.trous[2]} />
      <path d="M676 1736 L604 1756 L610 1772 L700 1768 Z" fill={INK} />
      <Limb a={[H[0] + 20, H[1]]} b={[860, 1530]} w0={30} w1={20} fill={M.trous[1]} />
      <Limb a={[860, 1530]} b={[880, 1745]} w0={20} w1={13} fill={M.trous[1]} />
      <path d="M866 1732 L980 1756 L972 1772 L862 1768 Z" fill={INK} />
      {/* far arm reaching (claw) */}
      <Limb a={sF} b={eF} w0={24} w1={19} fill={M.coat[2]} />
      <Limb a={eF} b={wF} w0={19} w1={15} fill={M.coat[2]} />
      <Hand at={wF} ang={40} type="flat" fill={M.skin[1]} shade={M.skin[2]} />
      {/* long coat */}
      <g transform={`translate(${H[0]} ${H[1]}) rotate(${lean})`}>
        <path d="M-74 40 L-62 -200 L-52 -420 L-24 -476 L62 -480 L94 -430 L98 -262 L82 -60 L120 270 L-96 280 Z" fill={g('coat')} />
        <path d="M8 -474 L52 -474 L38 -372 Z" fill={g('shirt')} />
        <path d="M28 -466 L42 -466 L52 -360 L36 -338 L24 -362 Z" fill={g('tie')} />
        <path d="M-30 -478 L8 -474 L30 -390 L-6 -420 Z" fill={M.coat[0]} />
        <path d="M52 -474 L96 -470 L64 -400 Z" fill={M.coat[0]} />
        <path d="M-90 220 L118 210 L120 270 L-96 280 Z" fill={M.coat[2]} opacity={0.6} />
      </g>
      {/* neck + head */}
      <polygon points={pts([add(NB, rot([-20, 10], na)), add(NB, rot([22, 10], na)), add(HO, rot([28, 30], na)), add(HO, rot([-18, 30], na))])} fill={g('skin')} />
      <g transform={`translate(${HO[0]} ${HO[1]}) rotate(${10 + 3 * (1 - raise)}) scale(0.9)`}>
        <Head pre={pre} v={{who: 'killer', brow: [14, 10], mouth: 'grin', dir}} />
      </g>
      {/* knife arm */}
      <Limb a={sN} b={eN} w0={27} w1={21} fill={g('coat')} />
      <Limb a={eN} b={wN} w0={21} w1={17} fill={g('coat')} />
      <g transform={`translate(${wN[0]} ${wN[1]}) rotate(${knifeRot})`}>
        <g transform="translate(0 70)"><Knife pre={pre} dir={dir} /></g>
      </g>
      <Hand at={wN} ang={knifeRot + 90} type="fist" fill={M.skin[0]} shade={M.skin[2]} />
    </g>
  );
};

// ---------------- the victim (screen coords, facing +x) ----------------
const Victim: React.FC<{pre: string; t: number; af: number}> = ({pre, t, af}) => {
  const H: P = [300, 1690];
  const lean = -14 + 0.8 * jit(af, 1);
  const NB = add(H, rot([10, -380], lean));
  const HO = add(NB, [150 * Math.sin(-4 * D), -150 * Math.cos(-4 * D)]);
  const sB = add(H, rot([-4, -350], lean)), sR = add(H, rot([24, -356], lean));
  const wB: P = [96, 1700], wR: P = [430 + 5 * jit(af, 2), 1110 + 5 * jit(af, 3)];
  const eB = ik(sB, reach(sB, wB, 390), 200, 190, -1), eR = ik(sR, reach(sR, wR, 390), 200, 190, 1);
  return (
    <g>
      <Limb a={sB} b={eB} w0={22} w1={17} fill={M.pj[2]} />
      <Limb a={eB} b={reach(sB, wB, 390)} w0={16} w1={12} fill={M.vskin[2]} />
      <Hand at={reach(sB, wB, 390)} ang={176} type="flat" fill={M.vskin[2]} shade={M.vskin[2]} flip />
      <Limb a={H} b={[440, 1600]} w0={34} w1={24} fill={M.trous[2]} />
      <Limb a={[440, 1600]} b={[540, 1752]} w0={18} w1={12} fill={M.trous[2]} />
      <Limb a={[H[0] + 10, H[1]]} b={[480, 1520]} w0={36} w1={26} fill={`url(#${pre}trousL)`} />
      <Limb a={[480, 1520]} b={[590, 1740]} w0={19} w1={12} fill={`url(#${pre}trousL)`} />
      <path d="M578 1728 L660 1740 L654 1756 L574 1752 Z" fill={INK} />
      <g transform={`translate(${H[0]} ${H[1]}) rotate(${lean})`}>
        <path d="M-64 30 L-58 -200 L-40 -350 L-10 -384 L44 -384 L72 -340 L82 -200 L74 30 Z" fill={`url(#${pre}pjL)`} />
        {[-300, -220, -140].map((y) => <circle key={y} cx={56} cy={y} r={7} fill={M.shirt[1]} />)}
        <path d="M10 -384 L44 -384 L30 -330 Z" fill={M.pj[2]} />
      </g>
      <polygon points={pts([add(NB, [-20, 10]), add(NB, [22, 10]), add(HO, [28, 30]), add(HO, [-18, 30])])} fill={`url(#${pre}vskinL)`} />
      <g transform={`translate(${HO[0]} ${HO[1]}) rotate(${-14 + jit(af, 4)}) scale(0.85)`}>
        <Head pre={pre} v={{who: 'victim', brow: [-18, -14], mouth: 'o', dir: 'L'}} />
      </g>
      <Limb a={sR} b={eR} w0={23} w1={18} fill={`url(#${pre}pjL)`} />
      <Limb a={eR} b={wR} w0={17} w1={13} fill={`url(#${pre}vskinL)`} />
      <Hand at={wR} ang={-74} type="flat" fill={M.vskin[0]} shade={M.vskin[2]} s={1.05} />
    </g>
  );
};

// ---------------- room backdrop ----------------
const Room: React.FC<{pre: string; light: number; moon: number}> = ({pre, light, moon}) => (
  <g>
    <rect x={-300} y={-300} width={1700} height={2600} fill={mix('#04080b', '#1d313c', light)} />
    <rect x={-300} y={1560} width={1700} height={800} fill={mix('#030507', '#14222a', light)} />
    {[1640, 1740, 1880].map((y, k) => <rect key={k} x={-300} y={y} width={1700} height={4 + k} fill="#05090c" opacity={0.6} />)}
    {/* window with a cold moon */}
    <g filter={`url(#${pre}cut)`}>
      <rect x={70} y={200} width={360} height={560} fill={mix('#0a1620', '#1a3346', 0.5 + 0.5 * moon)} />
      <circle cx={300} cy={330} r={46} fill="#dfe7e0" opacity={0.85} />
      <rect x={240} y={200} width={18} height={560} fill="#04080b" />
      <rect x={70} y={470} width={360} height={18} fill="#04080b" />
      <rect x={62} y={192} width={376} height={576} fill="none" stroke="#04080b" strokeWidth={22} />
    </g>
    {/* amber lamp pool from low-left */}
    <circle cx={-60} cy={1900} r={1300} fill={`url(#${pre}pool)`} opacity={light} style={{mixBlendMode: 'screen'}} />
  </g>
);

// ---------------- the film ----------------
export const Murder: React.FC = () => {
  const frame = useCurrentFrame();
  const af = Math.floor((frame * 24) / 30); // 24 fps on ones, pulled up to 30
  const t = af / 24;
  let shot = 0;
  while (shot < 4 && t >= CUTS[shot]) shot++;
  const s0 = shot === 0 ? 0 : CUTS[shot - 1], s1 = shot === 4 ? 7 : CUTS[shot];
  const sp = clamp((t - s0) / (s1 - s0));
  const pre = `m${shot}`;
  const MIRROR = 'translate(1550 0) scale(-1 1)';
  let body: React.ReactNode = null;

  const defs = (
    <defs>
      <Grads pre={pre} />
      <radialGradient id={pre + 'pool'}>
        <stop offset="0" stopColor="#ffb766" stopOpacity={0.7} /><stop offset="0.5" stopColor="#da603a" stopOpacity={0.22} /><stop offset="1" stopColor="#da603a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id={pre + 'holy'} cx="0.5" cy="0">
        <stop offset="0" stopColor="#fff3d0" stopOpacity={0.95} /><stop offset="0.45" stopColor="#ffcf7a" stopOpacity={0.35} /><stop offset="1" stopColor="#ffcf7a" stopOpacity={0} />
      </radialGradient>
    </defs>
  );

  if (shot === 0) {
    // wide, low angle: killer looms over victim; huge shadow on the wall
    const z = lerp(1, 1.06, eio(sp));
    const killer = <Killer pre={pre} raise={1} t={t} dir="R" />;
    body = (
      <g transform={`translate(560 1000) scale(${z}) translate(-560 -1000)`}>
        <Room pre={pre} light={1} moon={0} />
        <g transform="translate(-180 2100) scale(1.3) translate(180 -2100) translate(-170 -230)" opacity={0.8}>
          <g filter={`url(#${pre}sil)`}><g transform={MIRROR}>{killer}</g></g>
        </g>
        <g filter={`url(#${pre}cut)`}>
          <g transform={MIRROR}>{killer}</g>
          <Victim pre={pre} t={t} af={af} />
        </g>
      </g>
    );
  } else if (shot === 1 || shot === 2) {
    // knife close-up; shot 2 = the imagined rubber knife
    const what = shot === 2;
    const tl = t - s0;
    const droop = what ? 74 * eout(clamp((tl - 0.25) / 0.7)) : 0;
    const wobble = what ? 26 * Math.sin(tl * 15) * Math.exp(-2.6 * Math.max(0, tl - 0.25)) * clamp((tl - 0.25) * 8) : 0;
    const gleam = !what ? (tl - 0.25) / 0.55 : -1;
    const tr = what ? 2 : 4;
    const z = lerp(1, 1.05, eio(sp));
    body = (
      <g transform={`translate(${540 + tr * jit(af, 5)} ${960 + tr * jit(af, 6)}) scale(${z}) translate(-540 -960)`}>
        <rect x={-200} y={-200} width={1500} height={2400} fill={what ? '#3a3a40' : '#16262e'} />
        <circle cx={-100} cy={2000} r={1500} fill={`url(#${pre}pool)`} style={{mixBlendMode: 'screen'}} />
        {/* out-of-focus: the victim's raised hand, foreground bottom-left */}
        <g filter={`url(#${pre}blur)`} opacity={0.9}>
          <Hand at={[60, 1720]} ang={-70} type="flat" fill={M.vskin[1]} shade={M.vskin[2]} s={3.4} />
          <rect x={-200} y={1760} width={420} height={400} fill={M.pj[2]} transform="rotate(-20 0 1900)" />
        </g>
        <g filter={`url(#${pre}cut)`} transform="translate(640 700) rotate(32)">
          {/* sleeve going up-right out of frame */}
          <polygon points={pts([[-150, -380], [170, -380], [260, -1400], [-60, -1400]])} fill={`url(#${pre}coatR)`} />
          <polygon points={pts([[-160, -400], [180, -400], [176, -340], [-156, -340]])} fill={M.shirt[1]} />
          <Knife pre={pre} L={1000} W={150} droop={droop} wobble={wobble} rubber={what ? clamp((tl - 0.25) / 0.4) : 0} gleam={gleam} dir="L" />
          {/* fist wrapped around the handle */}
          <path d="M-60 -60 L170 -90 L210 -260 L120 -380 L-80 -360 L-120 -200 Z" fill={`url(#${pre}skinL)`} />
          {[0, 1, 2, 3].map((k) => (
            <g key={k}>
              <rect x={-150} y={-120 - k * 62} width={190} height={60} rx={30} fill={k % 2 ? M.skin[1] : M.skin[0]} />
              <path d={`M-150 ${-62 - k * 62} L40 ${-62 - k * 62}`} stroke={M.skin[2]} strokeWidth={6} />
              <ellipse cx={-120} cy={-90 - k * 62} rx={14} ry={10} fill="#f6d3b3" opacity={0.7} />
            </g>
          ))}
          <path d="M40 -350 L-110 -330 L-140 -300 L-120 -280 L60 -300 Z" fill={M.skin[0]} />
          <ellipse cx={-118} cy={-312} rx={20} ry={14} fill="#f6d3b3" opacity={0.7} />
        </g>
        {what && (
          <g style={{mixBlendMode: 'screen'}} opacity={clamp(tl / 0.2) * (1 - 0.3 * clamp((tl - 1.2) / 0.3))}>
            <rect x={-200} y={-200} width={1500} height={2400} fill={`url(#${pre}holy)`} />
            {[-30, -12, 6, 22, 40].map((a, k) => (
              <polygon key={k} points={pts([[540, -100], [540 + 1800 * Math.sin((a - 3) * D), 1800 * Math.cos((a - 3) * D)], [540 + 1800 * Math.sin((a + 3) * D), 1800 * Math.cos((a + 3) * D)]])} fill="#ffe2a8" opacity={0.12 + 0.06 * Math.sin(t * 3 + k)} />
            ))}
            {Array.from({length: 20}).map((_, k) => {
              const x = 100 + Math.abs(Math.sin(k * 77.7)) * 880, y = ((Math.abs(Math.sin(k * 33.3)) * 1800 + tl * 120) % 1800);
              return <circle key={k} cx={x} cy={y} r={3 + 4 * Math.abs(Math.sin(k))} fill="#fff6dc" opacity={0.6 * Math.abs(Math.sin(t * 4 + k))} />;
            })}
          </g>
        )}
      </g>
    );
  } else if (shot === 3) {
    // reality snaps back: killer's face, uplit; steel blade flashes
    const tl = t - s0;
    const z = lerp(1.02, 1.1, eout(sp));
    const flash = clamp(1 - Math.abs(tl - 0.18) / 0.12);
    body = (
      <g transform={`translate(${540 + 6 * jit(af, 7) * clamp(1 - tl * 3)} 960) scale(${z}) translate(-540 -960)`}>
        <rect x={-200} y={-200} width={1500} height={2400} fill="#0e1a20" />
        <circle cx={300} cy={2300} r={1300} fill={`url(#${pre}pool)`} style={{mixBlendMode: 'screen'}} />
        <g filter={`url(#${pre}cut)`}>
          <g transform="translate(1080 0) scale(-1 1)">
            <polygon points={pts([[200, 1700], [700, 1640], [900, 2100], [100, 2100]])} fill={`url(#${pre}coatU)`} />
            <polygon points={pts([[330, 1640], [470, 1630], [420, 1900]])} fill={`url(#${pre}shirtU)`} />
            <polygon points={pts([[380, 1640], [430, 1640], [460, 1860], [410, 1900], [372, 1860]])} fill={`url(#${pre}tieU)`} />
            <polygon points={pts([[380, 1660], [470, 1640], [470, 1350], [400, 1360]])} fill={`url(#${pre}skinU)`} />
            <g transform="translate(350 1330) rotate(6) scale(2.7)">
              <Head pre={pre} v={{who: 'killer', brow: [18, 14], mouth: 'grin', dir: 'U'}} />
            </g>
          </g>
          <g transform={`translate(860 ${-120}) rotate(-6)`}>
            <Knife pre={pre} L={1300} W={170} gleam={clamp((tl - 0.08) / 0.3)} dir="L" />
          </g>
        </g>
        {flash > 0 && (
          <g style={{mixBlendMode: 'screen'}} opacity={flash}>
            <polygon points="900,520 924,610 1010,640 924,670 900,760 876,670 790,640 876,610" fill="#fffaf0" />
            <circle cx={900} cy={640} r={46} fill="#fff1d0" opacity={0.6} />
          </g>
        )}
      </g>
    );
  } else {
    // shadows on the wall: the arm comes down, the lamp is knocked, light dies
    const raise = t < T_STAB ? 1 : 1 - eout(clamp((t - T_STAB) / (T_HIT - T_STAB)));
    const swingT = t - T_HIT;
    const swing = swingT > 0 ? 160 * Math.exp(-3 * swingT) * Math.sin(swingT * 16) : 0;
    const flick = swingT > 0 ? (Math.sin(af * 2.3) > -0.2 ? 1 : 0.25) : 1;
    const light = t < T_OUT ? (swingT > 0 ? 0.85 * flick : 1) : 0;
    const moon = clamp((t - (T_OUT + 0.25)) / 0.6);
    const killer = <Killer pre={pre} raise={raise} t={t} dir="R" />;
    const shadowT = `translate(${swing} ${-swing * 0.2}) translate(540 1700) scale(1.02) translate(-540 -1700) translate(190 -150)`;
    body = (
      <g transform={`translate(540 960) scale(${lerp(1.0, 1.04, sp)}) translate(-540 -960)`}>
        <g transform="translate(-260 0)"><Room pre={pre} light={light} moon={moon} /></g>
        {light > 0 && (
          <g transform={shadowT} opacity={0.92}>
            <g filter={`url(#${pre}sil)`}>
              <g transform={MIRROR}>{killer}</g>
              <Victim pre={pre} t={t} af={af} />
            </g>
          </g>
        )}
        {/* cold moonlight patch after the light dies */}
        <g opacity={moon} style={{mixBlendMode: 'screen'}}>
          <polygon points="-180,770 170,770 640,1560 180,1560" fill="#3d6a86" opacity={0.35} />
          <polygon points="180,1560 640,1560 820,1900 260,1900" fill="#4d7a92" opacity={0.3} />
        </g>
      </g>
    );
  }

  const grain = Math.floor(Math.abs(Math.sin(af * 12.9898) * 43758.5453) % 8);
  return (
    <AbsoluteFill style={{backgroundColor: '#05090c'}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        {defs}
        {body}
      </svg>
      <Img src={staticFile('mottle.png')} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'soft-light', opacity: 0.3}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 60% at 50% 48%, rgba(5,9,12,0) 48%, rgba(5,9,12,0.4) 80%, rgba(5,9,12,0.78) 100%)'}} />
      <Img src={staticFile(`grain${grain}.png`)} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'overlay', opacity: 0.2}} />
    </AbsoluteFill>
  );
};
