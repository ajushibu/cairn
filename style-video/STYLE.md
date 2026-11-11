# Style bible: reference pin 933230354040919306 (animated film-maker biography)

All numbers are measured from `ref/ref.mp4` (scripts in `tools/`, output in `analysis/`).

## Format
- Container: 720×1280, 30 fps, 115.97 s, H.264 + AAC 44.1 kHz stereo.
- **The artwork is 16:9 (1280×720) stored rotated 90° clockwise.** There is no rotation flag; it is baked into the pixels.
- **Cadence: the animation is 24 fps on ones, pulled up to 30 fps.** Every 5th frame is an exact repeat: the blurred frame-diff sequence reads `x x x x ~0.05`. The grain repeats on those frames too.
- 49 shots. Shot length: median 1.43 s, mean 2.37 s, range 0.13–16.3 s. A few rapid 0.2 s cuts appear in a montage near the end.

## Palette (k-means, share of pixels)
Navy and teal take up about 60% of the frame. Peach is the "light"; burnt orange is the accent.

| hex | share | role |
|---|---|---|
| #0b151a | 17% | deepest shadow (never pure black) |
| #14222a | 13% | shadow |
| #1d313c | 15% | dark teal walls and clothes |
| #314853 | 9% | mid teal |
| #4f6c77 | 6% | light teal / rim |
| #f6d3b3 | 10% | peach sky / light |
| #daa48f | 7% | skin / warm mid |
| #8d7b71 | 7% | hazy mid |
| #8b4d3c | 6% | rust shadow |
| #49312d | 5% | brown shadow |
| #da603a | 5% | **burnt-orange accent** |
| #f7efe2 | 2% | cream highlight / glasses lenses / sun |

## Grade
- Luma p2 = 13.6 and p98 = 231 (on 0–255): lifted blacks and soft whites. Nothing clips.
- Mean luma 87: a dark, low-key film.
- Mean saturation 0.45 (p90 0.74): rich, but only orange gets fully saturated.
- **Vignette: corner/centre luma = 0.63**, which is strong.
- Warm/cool split: peach and orange light against teal shadow, in every scene.

## Line and texture
- Flat vector shapes. **No outlines on characters.** Thin darker contour lines appear only on hard props (car trim, door handle).
- **No line boil.** Edges are clean vector, so there is no displacement wobble.
- Soft gradient shading on every surface, plus a mottled airbrush texture in skies and walls (low-frequency blotches).
- Fine film grain on every source frame (high-pass std ≈ 5.8 at 320 px wide, including texture).
- Atmospheric depth: background layers are washed into peach or teal haze, and the foreground is the most saturated and darkest.

## Lighting
- One strong directional key: window shafts, projector beams, light cones. Hard-edged light patches fall on walls and floors.
- Big dark foreground silhouettes cross the frame for depth (parallax wipes).
- Rim light on characters in a lighter teal.

## Characters
- Long, simple bodies, small heads, long necks, thin limbs.
- **Glasses with opaque cream lenses** (#f7efe2) and a thin rim. The eyes are never drawn.
- Simple dot or line features, a small smile, hair as one shape in a darker tone.
- Clothes in teal/navy, with orange reserved for the hero accent (sweater, scarf, baby blanket).

## Motion and camera
- Smooth eased tweens on ones (at 24 fps). Secondary motion: scarves in the wind, flickering light.
- Camera is mostly locked. When it moves, it's slow: push-ins up to ×1.03/s, a pull-out at ×0.95/s, lateral drifts of about 3% of frame width per second. Phase correlation also found one fast diagonal move and a whip pan.
- Foreground silhouettes slide in to reveal or hide the subject.

## Sound
- Integrated **-14.3 LUFS**, LRA 4.3 LU (heavily compressed, "social" loudness).
- Warm: spectral centroid around 1.7 kHz, only 3% of energy above 3.4 kHz, and a hard lowpass near 16 kHz.
- Spectrogram shows narration with regular short pauses over a continuous music bed. Tempo estimate is about 112 BPM (low confidence: the voice dominates).

## What makes it feel premium
1. A disciplined two-temperature palette: teal shadows, peach light, and orange used only as an accent.
2. Directional light shapes (window patches, beams) and dark foreground silhouettes that give depth.
3. Lifted blacks, a strong vignette, mottled texture and grain: it feels like film, not like a flat vector graphic.
4. 24 fps on ones with eased tweens: smooth, but cinematic rather than video-smooth.
5. Haze on background layers for atmospheric perspective.
