import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Hand, Finger, Limb, ik, pts, clamp, reach, D} from './Storyboard';
import {MHead, Grads, M, INK, HandDrawn} from './Murder';

// 7 s, 4 shots: "this wasn't a hard question" - warring gods, an angered god, the wheel of karma.
type P = [number, number];
export const CUTS = [1.4, 3.4, 4.5];
export const T_CLASH = 2.3;

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const eio = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const eout = (p: number) => 1 - Math.pow(1 - p, 3);
const jit = (af: number, k: number) => Math.sin(af * 91.3 + k * 17.7) * Math.cos(af * 37.1 + k * 3.1);
const GOLD = '#e8c27a';

// ---------------- villager (local: hips at 0,0, faces +x) ----------------
const Villager: React.FC<{pre: string; pose: 'shrug' | 'cower'; t: number; look: number}> = ({pre, pose, t, look}) => {
  const up = pose === 'shrug' ? 14 * Math.sin(t * 4.5) : 0;
  const sL: P = [-60, -470 - up], sR: P = [70, -470 - up];
  const wL: P = pose === 'shrug' ? [-310, -540 - up * 2] : [-40, -800];
  const wR: P = pose === 'shrug' ? [340, -590 - up * 2] : [130, -820];
  const hL = reach(sL, wL, 380), hR = reach(sR, wR, 380);
  const eL = ik(sL, hL, 200, 185, 1), eR = ik(sR, hR, 200, 185, -1);
  return (
    <g>
      <Limb a={sL} b={eL} w0={26} w1={20} fill={M.shirt[1]} />
      <Limb a={eL} b={hL} w0={18} w1={13} fill={M.vskin[1]} />
      <Hand at={hL} ang={pose === 'shrug' ? -150 : -100} type="flat" fill={M.vskin[1]} shade={M.vskin[2]} flip s={1.1} />
      <path d="M-90 80 L-80 -200 L-70 -440 L-30 -520 L50 -520 L90 -440 L100 -200 L112 80 Z" fill={`url(#${pre}shirtL)`} />
      <path d="M-82 -170 L102 -180 L102 -150 L-82 -140 Z" fill={M.wood[1]} />
      <path d="M-30 -520 L10 -440 L50 -520 Z" fill={M.vskin[2]} />
      <polygon points="-22,-510 24,-510 26,-640 -18,-640" fill={`url(#${pre}vskinL)`} />
      <g transform={`translate(-8 -650) rotate(${look})`}>
        <MHead pre={pre} v={{who: 'victim', brow: pose === 'shrug' ? [-8, -14] : [-18, -14], mouth: pose === 'shrug' ? 'flat' : 'o', dir: 'L'}} />
      </g>
      <Limb a={sR} b={eR} w0={27} w1={21} fill={`url(#${pre}shirtL)`} />
      <Limb a={eR} b={hR} w0={19} w1={14} fill={`url(#${pre}vskinL)`} />
      <Hand at={hR} ang={pose === 'shrug' ? -40 : -80} type="flat" fill={M.vskin[0]} shade={M.vskin[2]} s={1.1} />
    </g>
  );
};

// ---------------- a god (local: faces +x, rising out of cloud) ----------------
const God: React.FC<{pre: string; kind: 'thunder' | 'sea'; t: number; angry: number; dir: string; arm?: boolean}> = ({pre, kind, t, angry, dir, arm = true}) => {
  const th = kind === 'thunder';
  const S: P = [60, 330];
  const W: P = th ? [330, -120 + 20 * Math.sin(t * 6)] : [300, 60 + 20 * Math.sin(t * 6 + 1)];
  const E = ik(S, W, 260, 240, -1);
  const beard = th ? M.shirt : M.trous;
  return (
    <g>
      <path d="M-260 1100 L-200 420 L-110 260 L120 250 L230 420 L300 1100 Z" fill={`url(#${pre}${th ? 'shirt' : 'trous'}${dir})`} />
      <path d="M-110 260 L20 420 L120 250 Z" fill={`url(#${pre}skin${dir})`} />
      <polygon points="-40,120 60,120 70,300 -50,300" fill={`url(#${pre}skin${dir})`} />
      <g transform="translate(0 110) rotate(8) scale(1.7)">
        <MHead pre={pre} v={{who: th ? 'killer' : 'victim', brow: [10 + 10 * angry, 6 + 8 * angry], mouth: 'flat', dir}} />
        {/* beard + crown */}
        <path d="M-46 -10 L-4 30 L70 70 L122 44 L128 4 L150 60 L120 200 L60 330 L10 210 L-60 150 Z" fill={`url(#${pre}${th ? 'shirt' : 'trous'}${dir})`} />
        <path d="M10 210 L60 330 L70 180 Z" fill={beard[2]} opacity={0.6} />
        {th
          ? <path d="M-96 -262 L-110 -360 L-60 -310 L-30 -400 L10 -330 L50 -420 L84 -340 L130 -390 L128 -262 Z" fill={GOLD} />
          : <path d="M-100 -250 L-120 -330 L-70 -300 L-60 -380 L-20 -320 L20 -400 L50 -320 L100 -370 L96 -300 L130 -310 L122 -250 Z" fill={M.pj[1]} />}
      </g>
      {/* weapon arm */}
      {!arm ? null : th ? (
        <polygon points={pts([[W[0] - 30, W[1] + 130], [W[0] + 30, W[1] + 20], [W[0] - 6, W[1] + 10], [W[0] + 70, W[1] - 150], [W[0] + 10, W[1] - 30], [W[0] + 44, W[1] - 24]])} fill="#fff1c8" stroke={M.pj[0]} strokeWidth={8} />
      ) : (
        <g stroke={M.steel[1]} strokeWidth={16} strokeLinecap="round" fill="none">
          <line x1={W[0] - 60} y1={W[1] + 300} x2={W[0] + 60} y2={W[1] - 300} />
          <path d={`M${W[0] + 0} ${W[1] - 330} L${W[0] + 30} ${W[1] - 230} L${W[0] + 120} ${W[1] - 250}`} />
          <line x1={W[0] + 44} y1={W[1] - 230} x2={W[0] + 80} y2={W[1] - 370} />
        </g>
      )}
      {arm && <Limb a={S} b={E} w0={44} w1={34} fill={`url(#${pre}skin${dir})`} />}
      {arm && <Limb a={E} b={W} w0={32} w1={26} fill={`url(#${pre}skin${dir})`} />}
      {arm && <Hand at={W} ang={th ? -20 : 10} type="fist" fill={M.skin[0]} shade={M.skin[2]} s={1.6} />}
      {/* cloud he rises from */}
      {[[-240, 760, 220], [-40, 820, 260], [200, 780, 230], [360, 860, 200], [-380, 880, 200]].map(([x, y, r], k) => (
        <ellipse key={k} cx={x + 14 * Math.sin(t * 0.8 + k)} cy={y} rx={r} ry={r * 0.5} fill={k % 2 ? '#31505c' : '#253f4a'} />
      ))}
    </g>
  );
};

const Stars: React.FC<{t: number; n?: number}> = ({t, n = 46}) => (
  <g>
    {Array.from({length: n}).map((_, k) => {
      const fr = (v: number) => v - Math.floor(v);
      const x = fr(Math.sin(k * 12.9898) * 43758.5453) * 1080, y = fr(Math.sin(k * 78.233) * 12543.123) * 1250;
      return <circle key={k} cx={x} cy={y} r={5 + 5 * Math.abs(Math.sin(k * 5.1))} fill="#f7efe2" opacity={0.35 + 0.5 * Math.abs(Math.sin(t * 2.2 + k))} />;
    })}
  </g>
);

// small life-stage silhouette standing on the wheel rim (local: feet at 0,0, up = -y)
const Life: React.FC<{k: number; glow: number}> = ({k, glow}) => {
  const c = glow > 0.02 ? `rgb(${Math.round(lerp(13, 255, glow))},${Math.round(lerp(26, 150, glow))},${Math.round(lerp(32, 70, glow))})` : '#0d1a20';
  const h = [0.55, 0.8, 1, 0.9][k];
  return (
    <g fill={c} transform={`scale(${h})`}>
      <path d="M-26 0 L-20 -90 L-14 -150 L16 -150 L24 -90 L30 0 Z" />
      <rect x={-6} y={-176} width={12} height={30} />
      <circle cx={2} cy={-200} r={30} />
      <path d="M22 -206 L50 -192 L24 -186 Z" />
      {k === 3 && <rect x={40} y={-130} width={8} height={130} transform="rotate(8 44 0)" />}
      {k === 3 && <path d="M16 -140 L46 -110 L40 -100 L10 -124 Z" />}
      {k === 2 && <path d="M16 -140 L60 -170 L64 -158 L20 -122 Z" />}
    </g>
  );
};

export const Myth: React.FC = () => {
  const frame = useCurrentFrame();
  const af = Math.floor((frame * 24) / 30);
  const t = af / 24;
  let shot = 0;
  while (shot < 3 && t >= CUTS[shot]) shot++;
  const s0 = shot === 0 ? 0 : CUTS[shot - 1], s1 = shot === 3 ? 7 : CUTS[shot];
  const sp = clamp((t - s0) / (s1 - s0)), tl = t - s0;
  const pre = `y${shot}`;
  let body: React.ReactNode = null;

  if (shot === 0) {
    const z = lerp(1, 1.05, eio(sp));
    body = (
      <g transform={`translate(540 960) scale(${z}) translate(-540 -960)`}>
        <rect x={-100} y={-100} width={1300} height={2200} fill={`url(#${pre}night)`} />
        <Stars t={t} />
        <circle cx={820} cy={330} r={200} fill={`url(#${pre}halo)`} />
        <circle cx={820} cy={330} r={84} fill="#f2ead8" />
        <path d="M-100 1500 Q200 1380 480 1470 T1180 1420 L1180 2100 L-100 2100 Z" fill="#0d1a20" />
        <path d="M-100 1640 Q300 1540 700 1620 T1180 1600 L1180 2100 L-100 2100 Z" fill="#070e12" />
        <g transform="translate(520 1900) scale(1.5)"><Villager pre={pre} pose="shrug" t={t} look={-16 + 2 * Math.sin(t * 3)} /></g>
      </g>
    );
  } else if (shot === 1) {
    const lunge = t < T_CLASH ? 70 * eio(clamp((t - s0) / (T_CLASH - s0))) : 70 - 50 * eout(clamp((t - T_CLASH) / 0.4));
    const flash = clamp(1 - Math.abs(t - T_CLASH - 0.04) / 0.09);
    const struck = t > T_CLASH + 0.08;
    const shake = struck ? 14 * Math.exp(-(t - T_CLASH) * 5) : 0;
    const fire = clamp((t - T_CLASH - 0.1) / 0.3);
    body = (
      <g transform={`translate(${shake * jit(af, 1)} ${shake * jit(af, 2)})`}>
        <rect x={-100} y={-100} width={1300} height={2200} fill={`url(#${pre}storm)`} />
        {[[200, 240, 420], [800, 180, 460], [520, 420, 380]].map(([x, y, r], k) => (
          <ellipse key={k} cx={x + 20 * Math.sin(t + k)} cy={y} rx={r} ry={r * 0.36} fill="#1b303a" />
        ))}
        <g transform={`translate(${40 + lunge} 560) scale(0.66)`}><God pre={pre} kind="thunder" t={t} angry={1} dir="R" /></g>
        <g transform={`translate(${1040 - lunge} 600) scale(-0.66 0.66)`}><God pre={pre} kind="sea" t={t} angry={1} dir="R" /></g>
        {/* village below */}
        <path d="M-100 1700 Q300 1620 640 1690 T1180 1660 L1180 2100 L-100 2100 Z" fill="#070e12" />
        {[[250, 1690, 1], [470, 1705, 0.8], [760, 1680, 1.1]].map(([x, y, s], k) => (
          <g key={k} transform={`translate(${x} ${y}) scale(${s})`} fill="#0d1a20">
            <path d="M-80 0 L-70 -90 L70 -90 L80 0 Z" /><path d="M-100 -80 L0 -190 L100 -80 Z" fill="#14262e" />
            <rect x={-14} y={-50} width={28} height={50} fill={k === 2 && fire > 0 ? M.pj[0] : '#1d313c'} />
          </g>
        ))}
        {struck && (
          <g>
            <polyline points="540,520 500,820 590,940 520,1200 640,1320 700,1480 760,1560" fill="none" stroke="#fff6dc" strokeWidth={lerp(26, 6, clamp((t - T_CLASH - 0.08) / 0.3))} strokeLinejoin="miter" opacity={clamp(1 - (t - T_CLASH - 0.08) / 0.35)} />
            {[0, 1, 2, 3].map((k) => {
              const h = (150 + 70 * Math.abs(Math.sin(t * 13 + k * 2))) * fire;
              return <path key={k} d={`M${720 + k * 30} 1580 Q${716 + k * 30 + 16 * Math.sin(t * 9 + k)} ${1580 - h * 0.6} ${740 + k * 28} ${1580 - h} Q${770 + k * 30} ${1580 - h * 0.5} ${768 + k * 30} 1580 Z`} fill={k % 2 ? '#ffd08a' : M.pj[1]} />;
            })}
            <circle cx={770} cy={1560} r={420 * fire} fill={`url(#${pre}ember)`} style={{mixBlendMode: 'screen'}} />
          </g>
        )}
        {flash > 0 && <rect x={-100} y={-100} width={1300} height={2200} fill="#fff6dc" opacity={flash * 0.85} />}
      </g>
    );
  } else if (shot === 2) {
    const z = lerp(1, 1.07, eout(sp));
    const point = eout(clamp(tl / 0.25));
    body = (
      <g transform={`translate(${540 + 5 * jit(af, 3)} ${960 + 5 * jit(af, 4)}) scale(${z}) translate(-540 -960)`}>
        <rect x={-100} y={-100} width={1300} height={2200} fill={`url(#${pre}storm)`} />
        <g transform="translate(240 520) rotate(22) scale(1.25)"><God pre={pre} kind="thunder" t={t} angry={1.4} dir="U" arm={false} /></g>
        {/* accusing light + giant pointing hand */}
        <polygon points="770,1260 890,1260 1040,1900 600,1900" fill={`url(#${pre}accuse)`} style={{mixBlendMode: 'screen'}} opacity={point} />
        <g transform={`translate(${lerp(1100, 850, point)} ${lerp(500, 760, point)}) rotate(98) scale(2.6)`}>
          <path d="M-400 -44 L-6 -30 L-6 30 L-400 50 Z" fill={`url(#${pre}skinL)`} />
          <Hand at={[0, 0]} ang={0} type="fist" fill={M.skin[0]} shade={M.skin[2]} />
          <Finger b={[70, -30]} a={-4} L={130} w={24} curl={6} fill={M.skin[0]} />
        </g>
        <path d="M-100 1760 Q400 1700 1180 1750 L1180 2100 L-100 2100 Z" fill="#070e12" />
        <g transform={`translate(${800 + 3 * jit(af, 5)} 1790) scale(0.4)`} filter={`url(#${pre}sil)`}><Villager pre={pre} pose="cower" t={t} look={-20} /></g>
      </g>
    );
  } else {
    const z = lerp(1, 1.06, eio(sp));
    const th = 20 + tl * 26; // wheel angle, deg
    const em = -90 + tl * 150; // ember angle on the rim, deg (runs ahead of the wheel)
    const R = 400, C: P = [540, 860];
    const ep: P = [C[0] + R * Math.cos(em * D), C[1] + R * Math.sin(em * D)];
    body = (
      <g transform={`translate(540 960) scale(${z}) translate(-540 -960)`}>
        <rect x={-100} y={-100} width={1300} height={2200} fill={`url(#${pre}dawn)`} />
        <circle cx={C[0]} cy={C[1]} r={640} fill={`url(#${pre}sun)`} />
        <circle cx={C[0]} cy={C[1]} r={300} fill="#ffe2b0" opacity={0.55} />
        <g transform={`rotate(${th} ${C[0]} ${C[1]})`}>
          {Array.from({length: 8}).map((_, k) => (
            <polygon key={k} points={pts([[C[0] - 12, C[1]], [C[0] + 12, C[1]], [C[0] + 7, C[1] - R], [C[0] - 7, C[1] - R]])} fill={`url(#${pre}woodL)`} transform={`rotate(${k * 45} ${C[0]} ${C[1]})`} />
          ))}
          <circle cx={C[0]} cy={C[1]} r={R} fill="none" stroke={M.wood[1]} strokeWidth={40} />
          <circle cx={C[0]} cy={C[1]} r={R + 18} fill="none" stroke={M.wood[2]} strokeWidth={8} />
          <circle cx={C[0]} cy={C[1]} r={R - 18} fill="none" stroke={GOLD} strokeWidth={6} opacity={0.8} />
          {Array.from({length: 24}).map((_, k) => <circle key={k} cx={C[0] + R * Math.cos(k * 15 * D)} cy={C[1] + R * Math.sin(k * 15 * D)} r={7} fill={GOLD} />)}
          {/* lives on the rim */}
          {[0, 1, 2, 3].map((k) => {
            const a = k * 90 - 90;
            const d = Math.abs(((em - th - a + 540) % 360) - 180);
            return (
              <g key={k} transform={`rotate(${a + 90} ${C[0]} ${C[1]}) translate(${C[0]} ${C[1] - R - 22})`}>
                <Life k={k} glow={clamp(1 - d / 40)} />
              </g>
            );
          })}
          {/* lotus hub */}
          {Array.from({length: 8}).map((_, k) => (
            <ellipse key={k} cx={C[0]} cy={C[1] - 66} rx={30} ry={66} fill={k % 2 ? M.pj[0] : '#ffd9b0'} transform={`rotate(${k * 45} ${C[0]} ${C[1]})`} />
          ))}
          <circle cx={C[0]} cy={C[1]} r={34} fill={GOLD} />
        </g>
        {/* the ember: what is carried from one life to the next */}
        {[5, 4, 3, 2, 1].map((k) => {
          const a = (em - k * 7) * D;
          return <circle key={k} cx={C[0] + R * Math.cos(a)} cy={C[1] + R * Math.sin(a)} r={22 - k * 3} fill="#ff9a55" opacity={0.5 - k * 0.08} />;
        })}
        <circle cx={ep[0]} cy={ep[1]} r={120} fill={`url(#${pre}ember)`} style={{mixBlendMode: 'screen'}} />
        <circle cx={ep[0]} cy={ep[1]} r={26} fill="#fff1c8" />
        <path d="M-100 1650 Q300 1560 640 1640 T1180 1600 L1180 2100 L-100 2100 Z" fill="#3a1a16" />
        <g transform="translate(250 1840) scale(0.5)" filter={`url(#${pre}sil)`}><Villager pre={pre} pose="shrug" t={0} look={-24} /></g>
      </g>
    );
  }

  const grain = Math.floor(Math.abs(Math.sin(af * 12.9898) * 43758.5453) % 8);
  return (
    <AbsoluteFill style={{backgroundColor: '#05090c'}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <Grads pre={pre} />
          <HandDrawn id={pre + 'hand'} seed={Math.floor(af / 2) % 6} />
          <linearGradient id={pre + 'night'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b151a" /><stop offset="0.7" stopColor="#24404c" /><stop offset="1" stopColor="#3a5560" /></linearGradient>
          <linearGradient id={pre + 'storm'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e1c23" /><stop offset="0.6" stopColor="#1d313c" /><stop offset="1" stopColor="#4a2e2a" /></linearGradient>
          <linearGradient id={pre + 'dawn'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7a3a2a" /><stop offset="0.5" stopColor="#da7a44" /><stop offset="1" stopColor="#8b4d3c" /></linearGradient>
          <radialGradient id={pre + 'sun'}><stop offset="0" stopColor="#fff1c8" stopOpacity={0.9} /><stop offset="0.5" stopColor="#ffb766" stopOpacity={0.4} /><stop offset="1" stopColor="#ffb766" stopOpacity={0} /></radialGradient>
          <radialGradient id={pre + 'halo'}><stop offset="0.3" stopColor="#dfe7e0" stopOpacity={0.45} /><stop offset="1" stopColor="#dfe7e0" stopOpacity={0} /></radialGradient>
          <radialGradient id={pre + 'ember'}><stop offset="0" stopColor="#ffd08a" stopOpacity={0.9} /><stop offset="0.5" stopColor="#ff8a3a" stopOpacity={0.35} /><stop offset="1" stopColor="#ff8a3a" stopOpacity={0} /></radialGradient>
          <linearGradient id={pre + 'accuse'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd59a" stopOpacity={0.7} /><stop offset="1" stopColor="#ff8a3a" stopOpacity={0.05} /></linearGradient>
        </defs>
        <g filter={`url(#${pre}hand)`}>{body}</g>
      </svg>
      <Img src={staticFile('mottle.png')} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'soft-light', opacity: 0.3}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 60% at 50% 48%, rgba(5,9,12,0) 48%, rgba(5,9,12,0.4) 80%, rgba(5,9,12,0.78) 100%)'}} />
      <Img src={staticFile(`grain${grain}.png`)} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'overlay', opacity: 0.2}} />
    </AbsoluteFill>
  );
};
