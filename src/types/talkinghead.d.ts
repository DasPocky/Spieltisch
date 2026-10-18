/** Typen für die Moderator-Bibliothek (MIT, ohne eigene Typen) – nur was Spieltisch nutzt */
declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    audioCtx: AudioContext;
    lipsync: Record<string, unknown>;
    renderer: { dispose(): void };
    scene: unknown;
    resizeobserver?: ResizeObserver;
    showAvatar(avatar: Record<string, unknown>, onprogress?: ((e: ProgressEvent) => void) | null): Promise<void>;
    speakAudio(r: { audio: AudioBuffer; words: string[]; wtimes: number[]; wdurations: number[] }, opt?: Record<string, unknown> | null): void;
    stopSpeaking(): void;
    setMood(mood: string): void;
    playGesture(name: string, dur?: number, mirror?: boolean, ms?: number): void;
    speakEmoji(e: string): void;
    lookAtCamera(t: number): void;
    onResize(): void;
    clearThree(obj: unknown): void;
    start(): void;
    stop(): void;
  }
}
declare module "@met4citizen/talkinghead/modules/lipsync-de.mjs" {
  export class LipsyncDe { constructor(); }
}
