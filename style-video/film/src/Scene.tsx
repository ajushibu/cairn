import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';

// ---------- palette (measured from reference) ----------
const C = {
  ink: '#0b151a', shadow: '#14222a', teal: '#1d313c', tealMid: '#314853', tealLt: '#4f6c77',
  peach: '#f6d3b3', skin: '#daa48f', haze: '#8d7b71', rust: '#8b4d3c', brown: '#49312d',
  orange: '#da603a', cream: '#f7efe2', skinSh: '#c08670',
};

// ---------- helpers ----------
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const inv = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
const eio = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const eout = (p: number) => 1 - Math.pow(1 - p, 3);
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, p: number) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join('');
};
const keys = (t: number, ks: [number, string][]) => {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) return mix(ks[i - 1][1], ks[i][1], eio(inv(ks[i - 1][0], ks[i][0], t)));
  return ks[ks.length - 1][1];
};
const nkeys = (t: number, ks: [number, number][]) => {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], eio(inv(ks[i - 1][0], ks[i][0], t)));
  return ks[ks.length - 1][1];
};
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
type P = [number, number];
// 2-bone IK; s = +1 / -1 picks the bend side (y-down coordinates)
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

// ---------- timing (112 BPM, eighth = 0.2679 s) ----------
const E8 = 60 / 112 / 2;
const LAND = [2, 4, 6, 8, 10, 12, 13, 14, 15, 16].map((k) => k * E8);
const FLIGHT = 0.25;
const PAYOFF = LAND[9]; // 4.29 s
const W_MACH = (2 * Math.PI * 112) / 60; // one machine cycle per beat
const phaseAt = (t: number) => {
  if (t < PAYOFF) return W_MACH * t;
  const k = 3.2;
  return W_MACH * PAYOFF + (W_MACH * (1 - Math.exp(-k * (t - PAYOFF)))) / k;
};

// ---------- layout ----------
const FLOOR = 1745;
const BOX_W = 176, BOX_H = 70, STACK_X = 885;
const SPAWN: P = [690, 1340];

const Box: React.FC<{x: number; y: number; i: number; rot?: number; sq?: number; sc?: number}> = ({x, y, i, rot = 0, sq = 0, sc = 1}) => {
  const body = i % 3 === 1 ? C.skin : C.orange;
  const bodySh = i % 3 === 1 ? C.skinSh : '#b44a2c';
  const lid = i % 2 ? C.tealMid : C.rust;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${sc * (1 + sq)},${sc * (1 - sq)})`}>
      <rect x={-BOX_W / 2} y={-BOX_H / 2} width={BOX_W} height={BOX_H} fill={body} />
      <rect x={-BOX_W / 2} y={-BOX_H / 2} width={30} height={BOX_H} fill={bodySh} />
      <rect x={-BOX_W / 2 - 5} y={-BOX_H / 2 - 4} width={BOX_W + 10} height={20} rx={2} fill={lid} />
      <rect x={-BOX_W / 2 - 5} y={-BOX_H / 2 + 12} width={BOX_W + 10} height={4} fill={C.ink} opacity={0.25} />
      <rect x={4} y={-6} width={60} height={30} rx={3} fill={C.cream} opacity={0.92} />
      {/* tiny shoe icon on label */}
      <path d="M12 16 L12 6 Q20 4 26 10 L44 13 Q54 15 54 20 L54 22 L12 22 Z" fill={C.teal} />
      <rect x={-BOX_W / 2} y={BOX_H / 2 - 6} width={BOX_W} height={6} fill={C.ink} opacity={0.22} />
    </g>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const af = Math.floor((frame * 24) / 30); // 24 fps on ones, pulled up to 30
  const t = af / 24;
  const ph = phaseAt(t);
  const pay = eout(inv(PAYOFF, PAYOFF + 0.45, t)); // payoff pose 0..1
  const lampOn = t < PAYOFF + 0.1 ? 0 : t < PAYOFF + 0.14 ? 1 : t < PAYOFF + 0.2 ? 0.25 : 1; // flicker
  const dusk = nkeys(t, [[0, 0], [4.3, 1], [5, 1.08]]);

  // ---------- camera: slow push-in + truck, foreground parallax ----------
  const cp = eio(clamp(t / 5));
  const camS = lerp(1.0, 1.075, cp), camX = lerp(16, -14, cp), camY = lerp(10, -6, cp);
  const cam = `translate(540 960) scale(${camS}) translate(${-540 + camX} ${-960 + camY})`;
  const fgS = 1 + (camS - 1) * 1.7;
  const fg = `translate(540 960) scale(${fgS}) translate(${-540 + camX * 1.8} ${-960 + camY * 1.8})`;
  const wipe = lerp(0, -620, eio(inv(0, 1.05, t)));

  // ---------- sky ----------
  const skyTop = keys(t, [[0, C.peach], [1.5, '#e9b394'], [3, C.rust], [4.3, C.teal], [5, C.shadow]]);
  const skyHor = keys(t, [[0, C.cream], [1.5, C.peach], [3, C.orange], [4.3, C.rust], [5, C.brown]]);
  const sunC = keys(t, [[0, C.cream], [1.8, C.peach], [3.3, C.orange], [4.3, '#c9532f']]);
  const sunY = nkeys(t, [[0, 400], [4.25, 925]]);
  const roofC = mix(skyHor, C.tealMid, nkeys(t, [[0, 0.45], [4.3, 0.75]]));
  const roofC2 = mix(skyHor, C.teal, nkeys(t, [[0, 0.65], [4.3, 0.9]]));
  const beamC = keys(t, [[0, C.peach], [3, C.orange], [4.3, C.rust]]);
  const beamA = nkeys(t, [[0, 0.32], [3, 0.3], [4.3, 0.06], [5, 0]]);

  // ---------- machine & character ----------
  const work = 1 - pay;
  const bob = 0.5 + 0.5 * Math.sin(ph);
  const tread = 6 * Math.sin(ph) * (1 - eout(inv(PAYOFF, PAYOFF + 0.8, t)));
  const HIP: P = [232, 1442];
  const lean = lerp(12 + 1.6 * Math.sin(ph + 0.6), -6, pay);
  const lr = (lean * Math.PI) / 180;
  const shoulder: P = [HIP[0] + 200 * Math.sin(lr), HIP[1] - 200 * Math.cos(lr)];
  const headRot = lerp(4 + 2.2 * Math.sin(ph + 1.2), -12, pay);
  const feed = 14 * Math.sin(ph);
  const headC: P = [HIP[0] + 232 * Math.sin(lr) + 4, HIP[1] - 232 * Math.cos(lr) - 50];
  const handN: P = [lerp(415 + feed, headC[0] - 22, pay), lerp(1338, headC[1] - 62, pay)];
  const handF: P = [lerp(468 + feed * 0.6, headC[0] - 40, pay), lerp(1334, headC[1] - 70, pay)];
  const sN: P = [shoulder[0] + 6, shoulder[1] + 12], sF: P = [shoulder[0] + 22, shoulder[1] + 6];
  const hN = reach(sN, handN, 232), hF = reach(sF, handF, 232);
  const eN = ik(sN, hN, 120, 114, 1), eF = ik(sF, hF, 120, 114, 1);
  const tpiv: P = [440, 1712];
  const tr = (tread * Math.PI) / 180;
  const foot: P = [tpiv[0] - 52 * Math.cos(tr), tpiv[1] - 14 - 52 * Math.sin(-tr) * 1];
  const knee = ik(HIP, foot, 140, 228, -1);
  const fly = ph * 1.0, wheel = ph * 0.55;
  const crank: P = [745 + 30 * Math.cos(wheel), 1600 + 30 * Math.sin(wheel)];

  // ---------- boxes ----------
  const landed = LAND.filter((l) => t >= l).length;
  const lastLand = landed ? LAND[landed - 1] : -9;
  const wob = landed ? Math.exp(-(t - lastLand) * 9) * Math.sin((t - lastLand) * 40) : 0;
  const sqLast = landed ? 0.16 * Math.exp(-(t - lastLand) * 14) * Math.cos((t - lastLand) * 30) : 0;
  const stackY = (i: number) => FLOOR - BOX_H * (i + 0.5);
  const flying = LAND.map((l, i) => ({l, i})).filter(({l}) => t < l && t >= l - FLIGHT - 0.12);

  // tally marks for chalkboard
  const tally = (k: number): [P, P] => {
    const g = Math.floor(k / 5), j = k % 5, gx = 768 + g * 118;
    if (j < 4) return [[gx + j * 22, 556], [gx + j * 22 + 2, 650]];
    return [[gx - 10, 632], [gx + 82, 570]];
  };

  // clock
  const hourA = nkeys(t, [[0, 60], [PAYOFF, 210]]);
  const minA = hourA * 12;

  // lamp sway
  const sway = 1.6 * Math.sin(t * 1.7) + 2.5 * lampOn * Math.exp(-(t - PAYOFF - 0.1) * 3) * Math.sin((t - PAYOFF) * 9);
  const lampX = 540, lampTop = -80, lampLen = 1160;
  const evening = dusk * 0.22 * (1 - 0.6 * lampOn);

  const steam = [0, 1, 2].map((k) => {
    const p = ((t * 0.55 + k / 3) % 1);
    const x0 = 572 + k * 9, y0 = 952;
    const dx = 10 * Math.sin(p * 7 + k * 2 + t * 2);
    return {d: `M${x0} ${y0} q ${8 + dx} ${-30 * p - 10} ${dx} ${-60 * p - 20} t ${-dx} ${-50 * p - 10}`, o: 0.55 * Math.sin(Math.PI * p)};
  });

  const grain = Math.floor(rnd(af) * 8);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{filter: 'brightness(1.16) saturate(1.18) contrast(1.04)'}}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="0.85" stopColor={skyHor} />
          </linearGradient>
          <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={mix(C.teal, C.tealMid, 0.7)} />
            <stop offset="0.6" stopColor={mix(C.teal, C.tealMid, 0.25)} />
            <stop offset="1" stopColor={C.shadow} />
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.brown} />
            <stop offset="1" stopColor={C.shadow} />
          </linearGradient>
          <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={beamC} stopOpacity={0.9} />
            <stop offset="1" stopColor={beamC} stopOpacity={0} />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0" stopColor={sunC} stopOpacity={0.7} />
            <stop offset="1" stopColor={sunC} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lampGlow">
            <stop offset="0" stopColor={C.peach} stopOpacity={0.85} />
            <stop offset="0.35" stopColor={C.orange} stopOpacity={0.35} />
            <stop offset="1" stopColor={C.orange} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.peach} stopOpacity={0.55} />
            <stop offset="1" stopColor={C.orange} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.tealMid} />
            <stop offset="1" stopColor={C.shadow} />
          </linearGradient>
          <clipPath id="win"><rect x={112} y={252} width={506} height={706} /></clipPath>
          <filter id="chalk" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
          </filter>
          <filter id="soft"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        <g transform={cam}>
          {/* ===== back wall ===== */}
          <rect x={-120} y={-120} width={1320} height={1440} fill="url(#wall)" />
          <rect x={-120} y={1090} width={1320} height={215} fill={C.shadow} />
          <rect x={-120} y={1088} width={1320} height={8} fill={C.tealLt} opacity={0.5} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <rect key={k} x={-80 + k * 210} y={1118} width={170} height={160} rx={4} fill="none" stroke={C.teal} strokeWidth={6} />
          ))}

          {/* ===== window ===== */}
          <rect x={90} y={230} width={550} height={750} rx={6} fill={C.shadow} />
          <g clipPath="url(#win)">
            <rect x={100} y={240} width={530} height={730} fill="url(#sky)" />
            <circle cx={365} cy={sunY} r={170} fill="url(#sunGlow)" />
            <circle cx={365} cy={sunY} r={64} fill={sunC} />
            {[0, 1, 2].map((k) => {
              const cx = ((140 + k * 190 + t * (14 + k * 6)) % 640) + 40;
              const cy = 330 + k * 90;
              const cc = mix(skyHor, C.cream, 0.35 - dusk * 0.3);
              return (
                <g key={k} fill={cc} opacity={0.85}>
                  <ellipse cx={cx} cy={cy} rx={60} ry={14} />
                  <ellipse cx={cx - 18} cy={cy - 12} rx={26} ry={16} />
                  <ellipse cx={cx + 14} cy={cy - 9} rx={20} ry={12} />
                </g>
              );
            })}
            {/* distant roofs (hazy), then nearer roofs */}
            <path d="M100 900 L150 900 L150 860 L210 860 L210 885 L260 885 L260 835 L278 835 L278 812 L292 812 L292 835 L330 835 L330 870 L400 870 L400 845 L470 845 L470 820 L520 820 L520 880 L580 880 L580 850 L640 850 L640 980 L100 980 Z" fill={roofC} />
            <path d="M100 935 L180 935 L180 905 L250 905 L250 925 L320 925 L320 895 L338 895 L338 870 L352 870 L352 895 L420 895 L420 915 L520 915 L520 890 L560 890 L560 930 L640 930 L640 980 L100 980 Z" fill={roofC2} />
            {/* water tower */}
            <g fill={roofC2}>
              <rect x={470} y={790} width={44} height={36} />
              <path d="M466 792 L492 772 L518 792 Z" />
              <rect x={474} y={826} width={4} height={70} /><rect x={506} y={826} width={4} height={70} />
            </g>
            {/* birds */}
            {[0, 1].map((k) => {
              const bx = 160 + ((t * 60 + k * 70) % 500), by = 520 + k * 30 + 6 * Math.sin(t * 3 + k);
              const wf = Math.sin(t * 14 + k * 2) * 6;
              return <path key={k} d={`M${bx - 10} ${by - wf} Q${bx - 4} ${by - 3} ${bx} ${by} Q${bx + 4} ${by - 3} ${bx + 10} ${by - wf}`} stroke={C.teal} strokeWidth={2.5} fill="none" opacity={0.7} />;
            })}
          </g>
          {/* muntins + frame */}
          <rect x={358} y={240} width={14} height={730} fill={C.shadow} />
          <rect x={100} y={598} width={530} height={14} fill={C.shadow} />
          <rect x={90} y={230} width={550} height={750} rx={6} fill="none" stroke={C.tealMid} strokeWidth={10} />
          <rect x={112} y={252} width={506} height={706} fill="none" stroke={C.ink} strokeWidth={4} opacity={0.6} />
          {/* sill */}
          <rect x={64} y={972} width={602} height={30} rx={4} fill={C.tealMid} />
          <rect x={64} y={996} width={602} height={10} fill={C.ink} opacity={0.4} />

          {/* plant on sill */}
          <g transform={`translate(150 972)`}>
            {[-40, -15, 10, 32].map((a, k) => {
              const sw = a + 3 * Math.sin(t * 2.1 + k);
              return <ellipse key={k} cx={0} cy={-46} rx={13} ry={48} fill={k % 2 ? C.tealLt : C.tealMid} transform={`rotate(${sw} 0 0)`} />;
            })}
            <path d="M-34 -34 L34 -34 L26 0 L-26 0 Z" fill={C.rust} />
            <rect x={-38} y={-40} width={76} height={10} rx={2} fill={C.orange} />
          </g>
          {/* jar of brushes */}
          <g transform="translate(470 972)">
            <rect x={-4} y={-92} width={5} height={60} fill={C.haze} transform="rotate(-8)" />
            <rect x={6} y={-86} width={5} height={56} fill={C.skin} transform="rotate(10)" />
            <rect x={-22} y={-46} width={44} height={46} rx={6} fill={C.tealLt} opacity={0.75} />
          </g>
          {/* tea cup + steam */}
          <g>
            <rect x={556} y={940} width={44} height={32} rx={6} fill={C.cream} />
            <path d="M600 948 q18 2 0 18" stroke={C.cream} strokeWidth={5} fill="none" />
            <rect x={548} y={968} width={60} height={6} rx={3} fill={C.skin} />
            {steam.map((s, k) => <path key={k} d={s.d} stroke={C.cream} strokeWidth={5} strokeLinecap="round" fill="none" opacity={s.o} />)}
          </g>

          {/* ===== right wall: clock ===== */}
          <g transform="translate(880 300)">
            <circle r={86} fill={C.shadow} />
            <circle r={76} fill={mix(C.cream, C.peach, 0.4)} />
            <circle r={76} fill={C.ink} opacity={dusk * 0.35} />
            {Array.from({length: 12}).map((_, k) => (
              <rect key={k} x={-3} y={-68} width={6} height={k % 3 ? 9 : 16} fill={C.teal} transform={`rotate(${k * 30})`} />
            ))}
            <rect x={-5} y={-40} width={10} height={46} rx={5} fill={C.teal} transform={`rotate(${hourA})`} />
            <rect x={-3} y={-62} width={6} height={68} rx={3} fill={C.orange} transform={`rotate(${minA})`} />
            <circle r={7} fill={C.ink} />
          </g>

          {/* ===== chalkboard + tally ===== */}
          <g>
            <rect x={712} y={432} width={306} height={300} rx={6} fill={C.rust} />
            <rect x={726} y={446} width={278} height={272} fill={'#17262c'} />
            <text x={865} y={512} textAnchor="middle" fontFamily="DejaVu Serif" fontWeight={700} fontSize={36} letterSpacing={6} fill={C.cream} opacity={0.8} filter="url(#chalk)">PAIRS</text>
            <g filter="url(#chalk)">
              {Array.from({length: 10}).map((_, k) => {
                const [a, b] = tally(k);
                const p = clamp((t - LAND[k]) / 0.09);
                if (p <= 0) return null;
                return <line key={k} x1={a[0]} y1={a[1]} x2={lerp(a[0], b[0], p)} y2={lerp(a[1], b[1], p)} stroke={C.cream} strokeWidth={8} strokeLinecap="round" opacity={0.85} />;
              })}
            </g>
            {/* chalk dust puff on newest mark */}
            {landed > 0 && t - lastLand < 0.35 && (() => {
              const [a, b] = tally(landed - 1);
              const q = (t - lastLand) / 0.35;
              return [0, 1, 2, 3].map((k) => (
                <circle key={k} cx={b[0] + (rnd(k + landed * 7) - 0.5) * 40 * q} cy={b[1] + 8 - 30 * q * rnd(k + 3)} r={3 + 4 * q} fill={C.cream} opacity={0.5 * (1 - q)} />
              ));
            })()}
            <rect x={740} y={706} width={120} height={8} rx={3} fill={C.shadow} />
            <rect x={760} y={699} width={26} height={8} rx={2} fill={C.cream} />
          </g>

          {/* ===== peg rail with lasts and tools ===== */}
          <g>
            <rect x={690} y={792} width={380} height={12} rx={3} fill={C.rust} />
            {[730, 800, 960, 1030].map((x, k) => {
              const sw = 2 * Math.sin(t * 1.3 + k);
              return (
                <g key={k} transform={`rotate(${sw} ${x} 800)`}>
                  <line x1={x} y1={800} x2={x} y2={838} stroke={C.ink} strokeWidth={3} />
                  <path d={`M${x - 18} 838 Q${x - 22} 900 ${x - 8} 930 L${x + 26} 932 Q${x + 34} 916 ${x + 18} 896 Q${x + 12} 860 ${x + 14} 838 Z`} fill={k % 2 ? C.skinSh : C.haze} />
                </g>
              );
            })}
            {/* scissors */}
            <g transform="translate(880 812) rotate(8)">
              <circle cx={-10} cy={8} r={10} fill="none" stroke={C.orange} strokeWidth={5} />
              <circle cx={12} cy={8} r={10} fill="none" stroke={C.orange} strokeWidth={5} />
              <path d="M-4 16 L4 92 L8 16 Z" fill={C.tealLt} />
            </g>
          </g>

          {/* leather hide roll leaning at right */}
          <g>
            <rect x={1012} y={1180} width={60} height={570} rx={30} fill={C.rust} transform="rotate(6 1040 1750)" />
            <rect x={1012} y={1180} width={18} height={570} rx={9} fill={C.brown} transform="rotate(6 1040 1750)" />
          </g>

          {/* ===== floor ===== */}
          <rect x={-120} y={1300} width={1320} height={760} fill="url(#floor)" />
          {[1360, 1440, 1540, 1660, 1800].map((y, k) => (
            <rect key={k} x={-120} y={y} width={1320} height={3 + k} fill={C.ink} opacity={0.35} />
          ))}
          <rect x={-120} y={1296} width={1320} height={10} fill={C.ink} opacity={0.55} />

          {/* ===== window light on floor + volumetric beam ===== */}
          {(() => {
            const L = nkeys(t, [[0, 230], [4.3, 640]]);
            const sh = nkeys(t, [[0, 20], [4.3, 260]]);
            const q = [[110, 1308], [620, 1308], [620 + sh + 80, 1308 + L], [110 + sh, 1308 + L]];
            const pq = q.map((p) => p.join(',')).join(' ');
            const midX = (q[0][0] + q[1][0]) / 2 + sh * 0.5, midY = 1308 + L * 0.48;
            return (
              <g style={{mixBlendMode: 'screen'}}>
                <polygon points={`112,958 618,958 ${q[2][0]},${q[2][1]} ${q[3][0]},${q[3][1]}`} fill="url(#beam)" opacity={beamA * 0.55} />
                <polygon points={pq} fill={beamC} opacity={beamA * 1.4} />
                <line x1={midX - sh * 0.1} y1={1308} x2={midX + sh * 0.4} y2={1308 + L} stroke={C.ink} strokeWidth={18} opacity={beamA * 1.6} />
                <line x1={110 + sh * 0.48} y1={midY} x2={620 + sh * 0.5 + 40} y2={midY} stroke={C.ink} strokeWidth={14} opacity={beamA * 1.6} />
                {Array.from({length: 26}).map((_, k) => {
                  const x = 140 + rnd(k) * 520 + 18 * Math.sin(t * 0.8 + k) + sh * rnd(k + 9);
                  const y = 1000 + ((rnd(k + 40) * 700 + t * 22 * (0.5 + rnd(k + 2))) % 700);
                  return <circle key={k} cx={x} cy={y} r={1.6 + 2.4 * rnd(k + 5)} fill={C.cream} opacity={beamA * 2.2 * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + k)))} />;
                })}
              </g>
            );
          })()}

          {/* basket of soles */}
          <g transform="translate(70 1745)">
            <path d="M-60 -90 L60 -90 L50 0 L-50 0 Z" fill={C.haze} />
            {[-40, -15, 10, 35].map((x, k) => <ellipse key={k} cx={x} cy={-96} rx={14} ry={30} fill={k % 2 ? C.cream : C.skin} transform={`rotate(${-12 + k * 8} ${x} -96)`} />)}
            <path d="M-60 -90 L60 -90 L50 0 L-50 0 Z" fill="none" stroke={C.brown} strokeWidth={4} />
            {[-70, -45, -20].map((y, k) => <line key={k} x1={-56} y1={y} x2={56} y2={y} stroke={C.brown} strokeWidth={3} opacity={0.6} />)}
          </g>
          {/* scraps on floor */}
          {[[520, 1760, C.orange], [600, 1790, C.rust], [180, 1800, C.skin], [800, 1830, C.orange]].map(([x, y, c], k) => (
            <path key={k} d={`M${x} ${y} q 20 -14 40 0 q -14 10 -34 6 z`} fill={c as string} opacity={0.85} />
          ))}

          {/* ===== stack of boxes ===== */}
          <ellipse cx={STACK_X} cy={FLOOR + 4} rx={120} ry={14} fill={C.ink} opacity={0.45} />
          <g transform={`rotate(${wob * 1.2} ${STACK_X} ${FLOOR})`}>
            {Array.from({length: landed}).map((_, i) => (
              <Box key={i} x={STACK_X + (rnd(i + 20) - 0.5) * 14} y={stackY(i)} i={i} rot={(rnd(i + 30) - 0.5) * 3} sq={i === landed - 1 ? sqLast : 0} />
            ))}
          </g>

          {/* ===== table, belt, treadle ===== */}
          <g>
            {/* belt */}
            <line x1={760} y1={1225} x2={815} y2={1600} stroke={C.brown} strokeWidth={4} />
            <line x1={680} y1={1240} x2={675} y2={1600} stroke={C.brown} strokeWidth={4} />
            {/* cast iron legs */}
            <path d="M372 1405 L398 1405 Q380 1560 400 1740 L364 1740 Q352 1560 372 1405 Z" fill={C.ink} />
            <path d="M720 1405 L746 1405 Q760 1560 744 1740 L708 1740 Q726 1560 720 1405 Z" fill={C.ink} />
            <rect x={380} y={1716} width={360} height={10} fill={C.ink} />
            {/* big wheel */}
            <g transform={`translate(745 1600) rotate(${(wheel * 180) / Math.PI})`}>
              <circle r={78} fill="none" stroke={C.shadow} strokeWidth={12} />
              {[0, 72, 144, 216, 288].map((a) => <rect key={a} x={-3} y={-74} width={6} height={74} fill={C.shadow} transform={`rotate(${a})`} />)}
              <circle r={10} fill={C.tealMid} />
            </g>
            {/* pitman rod */}
            <line x1={crank[0]} y1={crank[1]} x2={490} y2={1706 + tread * 3} stroke={C.tealMid} strokeWidth={6} />
            {/* treadle plate */}
            <g transform={`rotate(${tread} ${tpiv[0]} ${tpiv[1]})`}>
              <rect x={tpiv[0] - 96} y={tpiv[1] - 10} width={150} height={16} rx={4} fill={C.shadow} />
              <rect x={tpiv[0] - 96} y={tpiv[1] - 10} width={150} height={4} fill={C.tealLt} opacity={0.5} />
            </g>
            {/* table top */}
            <rect x={340} y={1380} width={450} height={28} rx={4} fill={C.rust} />
            <rect x={340} y={1380} width={450} height={6} fill={C.skin} opacity={0.35} />
            <rect x={340} y={1404} width={450} height={6} fill={C.ink} opacity={0.4} />
          </g>

          {/* ===== stool ===== */}
          <g>
            <line x1={190} y1={1478} x2={160} y2={1745} stroke={C.rust} strokeWidth={12} />
            <line x1={280} y1={1478} x2={312} y2={1745} stroke={C.rust} strokeWidth={12} />
            <line x1={236} y1={1478} x2={238} y2={1745} stroke={C.brown} strokeWidth={10} />
            <line x1={170} y1={1640} x2={302} y2={1640} stroke={C.brown} strokeWidth={8} />
            <rect x={160} y={1462} width={150} height={22} rx={10} fill={C.orange} />
            <rect x={160} y={1476} width={150} height={8} rx={4} fill={C.rust} />
          </g>

          {/* ===== far arm (behind body) ===== */}
          <g opacity={1}>
            <line x1={sF[0]} y1={sF[1]} x2={eF[0]} y2={eF[1]} stroke={'#b44a2c'} strokeWidth={34} strokeLinecap="round" />
            <line x1={eF[0]} y1={eF[1]} x2={hF[0]} y2={hF[1]} stroke={'#b44a2c'} strokeWidth={28} strokeLinecap="round" />
            <circle cx={hF[0]} cy={hF[1]} r={15} fill={C.skinSh} />
          </g>

          {/* ===== leg ===== */}
          <line x1={HIP[0]} y1={HIP[1]} x2={knee[0]} y2={knee[1]} stroke={C.teal} strokeWidth={54} strokeLinecap="round" />
          <line x1={knee[0]} y1={knee[1]} x2={foot[0]} y2={foot[1]} stroke={C.shadow} strokeWidth={30} strokeLinecap="round" />
          <ellipse cx={foot[0] + 16} cy={foot[1] + 4} rx={34} ry={13} fill={C.ink} transform={`rotate(${tread} ${foot[0]} ${foot[1]})`} />

          {/* ===== torso ===== */}
          <g transform={`translate(${HIP[0]} ${HIP[1]}) rotate(${lean})`}>
            <path d="M-62 10 Q-70 -60 -58 -140 Q-50 -196 -12 -212 L30 -210 Q52 -196 50 -150 L56 -40 Q60 0 50 12 Z" fill={C.orange} />
            <path d="M-62 10 Q-70 -60 -58 -140 Q-52 -180 -34 -200 Q-48 -120 -36 10 Z" fill={'#b44a2c'} />
            {/* apron */}
            <path d="M14 -150 L50 -150 L58 -20 Q62 14 52 22 L6 22 Q-4 -60 14 -150 Z" fill={C.tealMid} />
            <path d="M14 -150 L-20 -205" stroke={C.tealMid} strokeWidth={6} />
            <rect x={4} y={-74} width={50} height={8} fill={C.teal} />
            {/* neck */}
            <rect x={-10} y={-246} width={26} height={44} rx={10} fill={C.skinSh} />
          </g>

          {/* ===== head ===== */}
          {(() => {
            const nb: P = [HIP[0] + 232 * Math.sin(lr) + 4, HIP[1] - 232 * Math.cos(lr)];
            return (
              <g transform={`translate(${nb[0]} ${nb[1]}) rotate(${headRot}) translate(0 -50)`}>
                <ellipse cx={8} cy={0} rx={44} ry={54} fill={C.skin} />
                <path d="M46 -2 L58 14 L46 18 Z" fill={C.skin} />
                {/* hair */}
                <path d="M-38 30 Q-52 -30 -20 -54 Q14 -70 46 -40 Q30 -40 10 -32 Q-10 -20 -14 10 Q-20 30 -38 30 Z" fill={C.brown} />
                <circle cx={-42} cy={-34} r={27} fill={C.brown} />
                <path d="M-60 -48 Q-44 -64 -24 -56" stroke={C.rust} strokeWidth={5} fill="none" />
                <ellipse cx={-6} cy={8} rx={9} ry={13} fill={C.skinSh} />
                {/* glasses: opaque cream lens */}
                <line x1={-4} y1={-2} x2={26} y2={-4} stroke={C.ink} strokeWidth={3} />
                <circle cx={33} cy={-4} r={17} fill={C.cream} stroke={C.ink} strokeWidth={3} />
                <circle cx={28} cy={-9} r={5} fill="#ffffff" opacity={0.7} />
                {/* mouth */}
                <path d={pay > 0.3 ? 'M30 30 Q40 40 50 30' : 'M34 32 Q42 35 49 31'} stroke={C.brown} strokeWidth={3.5} fill="none" strokeLinecap="round" />
                <circle cx={22} cy={22} r={9} fill={C.orange} opacity={0.35} />
              </g>
            );
          })()}

          {/* ===== machine ===== */}
          <g>
            {/* bed */}
            <rect x={398} y={1350} width={334} height={32} rx={8} fill="url(#iron)" />
            <rect x={398} y={1350} width={334} height={5} rx={2} fill={C.tealLt} opacity={0.6} />
            {/* pillar + arm */}
            <path d="M640 1352 Q636 1250 660 1200 Q672 1172 640 1170 L450 1172 Q418 1172 416 1200 L416 1240 L470 1240 L470 1228 L648 1226 Q632 1270 690 1352 Z" fill="url(#iron)" />
            <path d="M450 1186 L640 1184" stroke={C.skin} strokeWidth={3} opacity={0.75} />
            <path d="M452 1196 L630 1194" stroke={C.orange} strokeWidth={2} opacity={0.7} />
            {/* head */}
            <rect x={410} y={1180} width={64} height={110} rx={10} fill={C.tealMid} />
            <rect x={414} y={1186} width={10} height={98} rx={4} fill={C.tealLt} opacity={0.6} />
            {/* needle bar */}
            <rect x={436} y={1288} width={9} height={18 + bob * 16} fill={C.haze} />
            <line x1={440} y1={1306 + bob * 16} x2={440} y2={1322 + bob * 16} stroke={C.cream} strokeWidth={2.5} />
            <rect x={428} y={1314} width={30} height={6} rx={2} fill={C.haze} />
            {/* spool + thread */}
            <rect x={556} y={1132} width={6} height={42} fill={C.ink} />
            <rect x={540} y={1138} width={38} height={26} rx={4} fill={C.orange} />
            <rect x={538} y={1134} width={42} height={6} rx={2} fill={C.cream} />
            <path d={`M558 1150 Q500 1150 470 1196 L444 1${290 + Math.round(bob * 10)}`} stroke={C.orange} strokeWidth={1.8} fill="none" />
            {/* shoe on the bed being stitched */}
            <g transform={`translate(${430 + feed * 0.6} 1350)`}>
              <path d="M-36 0 L-36 -26 Q-24 -32 -12 -24 L22 -18 Q46 -14 50 -6 L50 0 Z" fill={C.rust} />
              <rect x={-38} y={-5} width={90} height={7} rx={3} fill={C.cream} />
              <path d="M-26 -26 L-6 -20" stroke={C.cream} strokeWidth={2} strokeDasharray="4 4" />
            </g>
            {/* flywheel */}
            <g transform={`translate(716 1226) rotate(${(fly * 180) / Math.PI})`}>
              <circle r={56} fill="none" stroke={C.orange} strokeWidth={11} />
              <circle r={56} fill="none" stroke={C.rust} strokeWidth={3} />
              {[0, 72, 144, 216, 288].map((a) => <rect key={a} x={-3.5} y={-52} width={7} height={52} fill={C.shadow} transform={`rotate(${a})`} />)}
              <circle r={12} fill={C.tealLt} />
            </g>
          </g>

          {/* ===== near arm ===== */}
          <g>
            <line x1={sN[0]} y1={sN[1]} x2={eN[0]} y2={eN[1]} stroke={C.orange} strokeWidth={36} strokeLinecap="round" />
            <line x1={eN[0]} y1={eN[1]} x2={hN[0]} y2={hN[1]} stroke={C.orange} strokeWidth={30} strokeLinecap="round" />
            <line x1={lerp(eN[0], hN[0], 0.86)} y1={lerp(eN[1], hN[1], 0.86)} x2={hN[0]} y2={hN[1]} stroke={C.cream} strokeWidth={30} strokeLinecap="butt" opacity={0.0} />
            <circle cx={hN[0]} cy={hN[1]} r={16} fill={C.skin} />
          </g>

          {/* ===== flying boxes (over everything in room) ===== */}
          {flying.map(({l, i}) => {
            const t0 = l - FLIGHT;
            const tgt: P = [STACK_X + (rnd(i + 20) - 0.5) * 14, stackY(i)];
            if (t < t0) {
              const s = eout(inv(t0 - 0.12, t0, t));
              return <Box key={i} x={SPAWN[0]} y={SPAWN[1] - 6} i={i} sc={0.6 + 0.4 * s} rot={0} />;
            }
            const p = (t - t0) / FLIGHT;
            const x = lerp(SPAWN[0], tgt[0], p);
            const h = 150 + Math.max(0, SPAWN[1] - tgt[1]) * 0.25;
            const y = lerp(SPAWN[1], tgt[1], p) - h * Math.sin(Math.PI * p);
            return <Box key={i} x={x} y={y} i={i} rot={lerp(-18, 0, p)} sq={-0.06 * Math.sin(Math.PI * p)} />;
          })}

          {/* ===== pendant lamp ===== */}
          <g transform={`rotate(${sway} ${lampX} ${lampTop})`}>
            <line x1={lampX} y1={lampTop} x2={lampX} y2={lampTop + lampLen - 70} stroke={C.ink} strokeWidth={4} />
            <path d={`M${lampX - 22} ${lampTop + lampLen - 72} L${lampX + 22} ${lampTop + lampLen - 72} L${lampX + 84} ${lampTop + lampLen} L${lampX - 84} ${lampTop + lampLen} Z`} fill={C.tealMid} />
            <path d={`M${lampX - 22} ${lampTop + lampLen - 72} L${lampX - 6} ${lampTop + lampLen - 72} L${lampX - 50} ${lampTop + lampLen} L${lampX - 84} ${lampTop + lampLen} Z`} fill={C.tealLt} opacity={0.6} />
            <ellipse cx={lampX} cy={lampTop + lampLen} rx={84} ry={12} fill={lampOn ? C.orange : C.shadow} />
            <circle cx={lampX} cy={lampTop + lampLen + 8} r={17} fill={lampOn ? C.cream : C.haze} />
          </g>
        </g>

        {/* ===== evening falloff + lamp light (screen space, follows camera roughly) ===== */}
        <rect x={0} y={0} width={1080} height={1920} fill={C.ink} opacity={evening} style={{mixBlendMode: 'multiply'}} />
        {lampOn > 0 && (
          <g transform={cam} style={{mixBlendMode: 'screen'}} opacity={lampOn}>
            <polygon points={`${lampX - 80},${lampTop + lampLen + 6} ${lampX + 80},${lampTop + lampLen + 6} ${lampX + 460},1760 ${lampX - 430},1760`} fill="url(#cone)" opacity={0.8} transform={`rotate(${sway} ${lampX} ${lampTop})`} />
            <circle cx={lampX} cy={lampTop + lampLen + 10} r={440} fill="url(#lampGlow)" transform={`rotate(${sway} ${lampX} ${lampTop})`} />
          </g>
        )}

        {/* ===== foreground silhouettes (parallax) ===== */}
        <g transform={fg}>
          <g transform={`translate(${wipe} 0)`}>
            <rect x={-200} y={-200} width={420} height={2400} fill={C.ink} />
            <path d="M220 -200 L250 -200 Q270 900 236 2200 L220 2200 Z" fill={C.ink} />
            <rect x={196} y={-200} width={10} height={2400} fill={C.tealMid} opacity={0.35} />
          </g>
          {/* cutting table corner + spool + shears, bottom */}
          <path d="M-100 1830 L700 1858 L760 2100 L-100 2100 Z" fill={C.ink} />
          <rect x={120} y={1760} width={70} height={84} rx={8} fill={C.ink} />
          <rect x={108} y={1752} width={94} height={16} rx={4} fill={C.ink} />
          <path d="M420 1852 L600 1800 L612 1814 L440 1866 Z" fill={C.ink} />
          <circle cx={404} cy={1858} r={22} fill="none" stroke={C.ink} strokeWidth={10} />
          {/* right edge hanging apron */}
          <path d="M1040 -100 L1160 -100 L1160 2100 L1080 2100 Q1050 1500 1070 900 Q1040 500 1040 -100 Z" fill={C.ink} />
          <path d="M1040 -100 Q1040 500 1070 900 Q1050 1500 1080 2100" stroke={C.tealMid} strokeWidth={4} fill="none" opacity={0.4} />
        </g>
      </svg>

      {/* texture + film finish */}
      <AbsoluteFill style={{transform: `translate(${camX * camS}px, ${camY * camS}px) scale(${camS})`, mixBlendMode: 'soft-light', opacity: 0.26}}>
        <Img src={staticFile('mottle.png')} style={{width: 1080, height: 1920}} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 72% 58% at 50% 50%, rgba(11,21,26,0) 50%, rgba(11,21,26,0.3) 80%, rgba(11,21,26,0.62) 100%)'}} />
      <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.19}}>
        <Img src={staticFile(`grain${grain}.png`)} style={{width: 1080, height: 1920}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
