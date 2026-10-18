import { useState } from "react";
import type { MediaResource } from "@onepage/director-core";
export function AudioImport({
  hasLine,
  onImport,
}: {
  hasLine: boolean;
  onImport: (
    media: MediaResource,
    kind: "voice" | "music" | "sfx",
    duration: number,
    transcript: string,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [license, setLicense] = useState("");
  const [data, setData] = useState("");
  const [mime, setMime] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [kind, setKind] = useState<"voice" | "music" | "sfx">(
    hasLine ? "voice" : "music",
  );
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return (
    <>
      <p>
        Embed recorded voice, music or an effect. Files stay in the local draft
        and exported pack; no upload service is used.
      </p>
      <label>
        WAV / MP3 / OGG
        <input
          type="file"
          accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const type = /\.wav$/i.test(file.name)
              ? "audio/wav"
              : /\.mp3$/i.test(file.name)
                ? "audio/mpeg"
                : /\.ogg$/i.test(file.name)
                  ? "audio/ogg"
                  : "";
            if (!type || file.size > 8_000_000) {
              setError("Choose WAV, MP3 or OGG up to 8 MB.");
              return;
            }
            setReading(true);
            setData("");
            const reader = new FileReader();
            reader.onerror = () => {
              setReading(false);
              setError("File could not be read");
            };
            reader.onload = () => {
              const url = String(reader.result).replace(
                /^data:[^;]+;/,
                `data:${type};`,
              );
              const audio = new Audio();
              audio.preload = "metadata";
              audio.onloadedmetadata = () => {
                setReading(false);
                if (
                  !Number.isFinite(audio.duration) ||
                  audio.duration <= 0 ||
                  audio.duration > 600
                ) {
                  setError("Recording must be between 0 and 600 seconds.");
                  return;
                }
                setData(url);
                setMime(type);
                setSeconds(audio.duration);
                setName(file.name);
                setError("");
              };
              audio.onerror = () => {
                setReading(false);
                setError("This browser could not decode the audio file.");
              };
              audio.src = url;
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {reading && <p role="status">Reading audio metadata…</p>}
      {data && (
        <>
          <audio controls src={data} style={{ width: "100%" }} />
          <p>
            {seconds.toFixed(2)} seconds · {mime}
          </p>
        </>
      )}
      <label>
        Use as
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="voice" disabled={!hasLine}>
            Selected dialogue voice
          </option>
          <option value="music">Scene music</option>
          <option value="sfx">Scene sound effect</option>
        </select>
      </label>
      <div className="pd-fitting-grid">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Source / creator
          <input value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <label>
          License
          <input value={license} onChange={(e) => setLicense(e.target.value)} />
        </label>
      </div>
      {kind === "voice" && (
        <label>
          Known transcript (optional)
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Only supply a transcript if known; no transcription is generated."
          />
        </label>
      )}
      {error && (
        <p className="pd-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="pd-primary pd-wide"
        disabled={!data || !name || !source || !license || reading}
        onClick={() => {
          try {
            onImport(
              {
                id: `audio:${crypto.randomUUID()}`,
                name,
                mime,
                dataUrl: data,
                source,
                license,
              },
              kind,
              Math.max(1, Math.round(seconds * 60)),
              transcript,
            );
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        Add embedded audio
      </button>
    </>
  );
}
