import React from 'react';
import {Composition} from 'remotion';
import {Scene} from './Scene';
import {Storyboard, STRIP_W, STRIP_H} from './Storyboard';
import {Film} from './Film';
import {Murder} from './Murder';
export const Root: React.FC = () => (
  <>
    <Composition id="Workshop" component={Scene} durationInFrames={150} fps={30} width={1080} height={1920} />
    <Composition id="Storyboard" component={Storyboard} durationInFrames={1} fps={30} width={STRIP_W} height={STRIP_H} />
    <Composition id="Film" component={Film} durationInFrames={150} fps={30} width={1080} height={1920} />
    <Composition id="Murder" component={Murder} durationInFrames={210} fps={30} width={1080} height={1920} />
  </>
);
