// Живая расшифровка через Web Speech API (Chrome, Safari).
// Где API нет — просто молчит: запись работает и без текста.

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

const Ctor: (new () => Rec) | undefined =
  (window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;

export const speechSupported = !!Ctor;

export class LiveTranscript {
  private rec: Rec | null = null;
  private final = "";
  private interim = "";

  start(onText: (text: string) => void) {
    this.final = "";
    this.interim = "";
    if (!Ctor) return;
    try {
      const r = new Ctor();
      r.lang = "ru-RU";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        this.interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) this.final += res[0].transcript + " ";
          else this.interim += res[0].transcript;
        }
        onText(this.text);
      };
      r.onerror = () => (this.rec = null);
      r.start();
      this.rec = r;
    } catch {
      this.rec = null;
    }
  }

  stop() {
    this.rec?.stop();
    this.rec = null;
  }

  get text() {
    const t = (this.final + this.interim).replace(/\s+/g, " ").trim();
    return t ? t[0].toUpperCase() + t.slice(1) : "";
  }
}
