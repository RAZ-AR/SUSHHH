// Общий AudioContext: один на всё приложение — эфир, запись и звуки реакций.

let ctx: AudioContext | null = null;

// 48 кГц — родная частота Opus: голос не пересэмплируется лишний раз
export function audioCtx() {
  if (!ctx) {
    try {
      ctx = new AudioContext({ sampleRate: 48000 });
    } catch {
      ctx = new AudioContext();
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
