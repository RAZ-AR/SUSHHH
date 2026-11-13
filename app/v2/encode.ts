// Сжатие записи перед отправкой: на устройстве голос лежит несжатым (≈1,4 МБ на 30 с), в эфир уходит
// Opus в WebM (Chrome, Android, Firefox) или AAC в M4A (Safari) — около 120–240 КБ.
// Кодирует WebCodecs через Mediabunny; где своего AAC-кодировщика нет — запасной на WASM.
// Библиотеки грузятся только при первой отправке: эфир их не ждёт.

const OPUS_RATE = 48000; // родная частота Opus

// Opus кодируем на 48 кГц — пересэмплируем, если запись другой частоты
async function at(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  if (buf.sampleRate === rate) return buf;
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * rate), rate);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return off.startRendering();
}

export async function encode(buf: AudioBuffer): Promise<Blob> {
  const mb = await import("mediabunny");
  const mono = { numberOfChannels: 1 };
  let codec: "opus" | "aac" = "opus";
  if (!(await mb.canEncodeAudio("opus", { ...mono, sampleRate: OPUS_RATE }).catch(() => false))) {
    codec = "aac";
    if (!(await mb.canEncodeAudio("aac", { ...mono, sampleRate: buf.sampleRate }).catch(() => false))) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    }
  }
  const input = codec === "opus" ? await at(buf, OPUS_RATE) : buf;
  const output = new mb.Output({
    format: codec === "opus" ? new mb.WebMOutputFormat() : new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new mb.BufferTarget(),
  });
  // голосу хватает низкого качества: речь разборчива, файл маленький
  const source = new mb.AudioBufferSource({ codec, quality: mb.QUALITY_LOW });
  output.addAudioTrack(source);
  await output.start();
  await source.add(input);
  await output.finalize();
  const data = output.target.buffer;
  if (!data) throw new Error("encode: empty output");
  return new Blob([data], { type: codec === "opus" ? "audio/webm" : "audio/mp4" });
}
