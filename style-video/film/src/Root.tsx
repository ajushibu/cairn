import React from 'react';
import {Composition} from 'remotion';
import {Scene} from './Scene';
export const Root: React.FC = () => (
  <Composition id="Workshop" component={Scene} durationInFrames={150} fps={30} width={1080} height={1920} />
);
