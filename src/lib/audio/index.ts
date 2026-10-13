/**
 * Audio. Import the interface and the event types from here freely; the Tone.js
 * implementation pulls in Tone itself, so it is only loaded on the client and
 * only once something actually plays.
 */

export * from './events';
export * from './instruments';
export type { AudioEngine, PlayOptions } from './types';
export { ToneAudioEngine, getAudioEngine, resetAudioEngine } from './ToneAudioEngine';
export type { ToneAudioEngineOptions } from './ToneAudioEngine';
