import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Panel, WARM, NIGHT, Pose} from './Storyboard';

// Four storyboard beats as four shots, hard-cut on the 112 BPM grid.
const E8 = 60 / 112 / 2;
export const CUTS = [5 * E8, 9 * E8, 14 * E8]; // 1.34, 2.41, 3.75 s
export const EVENTS = [4 * E8, 7 * E8, 12 * E8, 16 * E8]; // tally 1, 4, 8, 10
const PAY = EVENTS[3];
const W = (2 * Math.PI * 112) / 60;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const eio = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const eback = (p: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const camLerp = (a: number[], b: number[], p: number) => a.map((v, i) => lerp(v, b[i], p)) as [number, number, number];
const markP = (t: number, at: number) => clamp((t - at) / 0.1);

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const af = Math.floor((frame * 24) / 30); // 24 fps on ones, pulled up to 30
  const t = af / 24;
  const ph = t < PAY ? W * t : W * PAY + (W * (1 - Math.exp(-3.2 * (t - PAY)))) / 3.2;
  const feed = 14 * Math.sin(ph) * (t < PAY ? 1 : Math.exp(-4 * (t - PAY)));
  const sw = (a: number) => Math.sin(ph + a);

  let shot = 0;
  while (shot < 3 && t >= CUTS[shot]) shot++;
  const s0 = shot === 0 ? 0 : CUTS[shot - 1];
  const s1 = shot === 3 ? 5 : CUTS[shot];
  const sp = eio(clamp((t - s0) / (s1 - s0)));

  let cam: [number, number, number], pose: Pose, L = NIGHT, lampOn = true;
  let tally = 0, boxes = 0, fly: {i: number; p: number} | undefined, armBlend = 0, legBlend = 0;

  if (shot === 0) {
    L = WARM; lampOn = false;
    cam = camLerp([170, 640, 1000], [215, 700, 930], sp);
    pose = {lean: 12 + 1.5 * sw(0.6), neckLean: 18, headTilt: 22 + 2 * sw(1.2), expr: 'focus', arms: 'work', legs: 'treadle', tip: 0, scarfWave: 0.2 + 0.1 * sw(0)};
    tally = markP(t, EVENTS[0]); boxes = t >= EVENTS[0] ? 1 : 0;
  } else if (shot === 1) {
    cam = camLerp([560, 730, 600], [582, 752, 562], sp);
    pose = {lean: 20 + 1.5 * sw(0.6), neckLean: 22, headTilt: 30 + 2.5 * sw(1.2), expr: 'squint', arms: 'work', legs: 'treadle', tip: 0, scarfWave: 0.5};
    tally = 3 + markP(t, EVENTS[1]); boxes = t >= EVENTS[1] ? 4 : 3;
  } else if (shot === 2) {
    cam = camLerp([470, 700, 1060], [498, 728, 1006], sp);
    // nodding off: head droops, then jerks up when the box lands
    const droop = t < EVENTS[2] ? eio(clamp((t - s0) / (EVENTS[2] - s0))) : -0.35 * Math.exp(-(t - EVENTS[2]) * 6) * Math.cos((t - EVENTS[2]) * 18);
    pose = {lean: 22 + 3 * droop, neckLean: 26 + 4 * droop, headTilt: 6 + 16 * droop, expr: 'tired', arms: 'chin', legs: 'treadle', tip: 0, scarfWave: 0};
    tally = 7 + markP(t, EVENTS[2]);
    boxes = t >= EVENTS[2] ? 8 : 7;
    if (t < EVENTS[2] && t >= EVENTS[2] - 0.28) fly = {i: 7, p: (t - (EVENTS[2] - 0.28)) / 0.28};
  } else {
    const k = t < PAY + 0.03 ? 0 : eback(clamp((t - PAY - 0.03) / 0.3));
    armBlend = clamp(k, 0, 1.06); legBlend = clamp(k, 0, 1.06);
    cam = camLerp([300, 470, 1240], [20, 470, 1240], 1 - Math.pow(1 - clamp((t - PAY + 0.06) / 0.5), 3));
    pose = {
      lean: lerp(18, -6, k), neckLean: lerp(22, -6, k), headTilt: lerp(10 + 1.5 * sw(1), -20, k),
      expr: t < PAY + 0.06 ? 'tired' : 'joy', arms: 'cheer', legs: 'kick', tip: lerp(0, -3, k), scarfWave: lerp(0.2, 1, clamp(k)),
    };
    tally = 9 + markP(t, PAY);
    boxes = t >= PAY ? 10 : 9;
    if (t < PAY && t >= PAY - 0.28) fly = {i: 9, p: (t - (PAY - 0.28)) / 0.28};
  }

  const grain = Math.floor(Math.abs(Math.sin(af * 12.9898) * 43758.5453) % 8);
  return (
    <AbsoluteFill style={{backgroundColor: '#0b151a'}}>
      <Panel n={shot + 1} cam={cam} pose={pose} L={L} count={0} lampOn={lampOn} anim={{t, ph, feed, tally, boxes, fly, armBlend, legBlend}} />
      <Img src={staticFile('mottle.png')} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'soft-light', opacity: 0.3}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 60% at 50% 48%, rgba(11,21,26,0) 50%, rgba(11,21,26,0.35) 82%, rgba(11,21,26,0.7) 100%)'}} />
      <Img src={staticFile(`grain${grain}.png`)} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'overlay', opacity: 0.2}} />
    </AbsoluteFill>
  );
};
