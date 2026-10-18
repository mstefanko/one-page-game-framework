import { useState } from "react";
import { importAsepriteSheet } from "@onepage/director-io";
import type { PackManifest, StyleId } from "@onepage/director-core";
export function FittingRoom({
  onImport,
}: {
  onImport: (pack: PackManifest) => void;
}) {
  const [json, setJson] = useState("");
  const [image, setImage] = useState("");
  const [name, setName] = useState("Imported character");
  const [source, setSource] = useState("");
  const [license, setLicense] = useState("");
  const [author, setAuthor] = useState("");
  const [style, setStyle] = useState<StyleId>("16-bit");
  const [actions, setActions] = useState<Record<string, string>>({});
  const [ground, setGround] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  async function metadata(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const names = (data.meta?.frameTags ?? []).map(
        (t: { name: string }) => t.name,
      );
      setTags(names);
      setActions({});
      setJson(text);
      setError(
        names.length
          ? ""
          : "No animation tags found. Export tagged Aseprite JSON.",
      );
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="pd-fitting">
      <p>
        Import an untrimmed PNG sprite sheet and its Aseprite JSON. Confirm each
        semantic action and the ground anchor before adding a reusable family.
      </p>
      <label>
        PNG sheet
        <input
          type="file"
          accept="image/png"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 8_000_000) {
                setError("PNG exceeds 8 MB limit");
                return;
              }
              const r = new FileReader();
              r.onload = () => setImage(String(r.result));
              r.readAsDataURL(f);
            }
          }}
        />
      </label>
      <label>
        Aseprite JSON
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void metadata(f);
          }}
        />
      </label>
      {image && (
        <img
          src={image}
          alt="Original sprite sheet preview"
          style={{
            width: "100%",
            maxHeight: 160,
            objectFit: "contain",
            background: "#25333b",
            imageRendering: "pixelated",
          }}
        />
      )}
      <div className="pd-fitting-grid">
        <label>
          Family name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Appearance
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as StyleId)}
          >
            <option>8-bit</option>
            <option>16-bit</option>
            <option>realistic</option>
          </select>
        </label>
        <label>
          Source
          <input value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <label>
          License
          <input value={license} onChange={(e) => setLicense(e.target.value)} />
        </label>
        <label>
          Author
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <label>
          Ground X
          <input
            type="number"
            value={ground.x}
            onChange={(e) => setGround((g) => ({ ...g, x: +e.target.value }))}
          />
        </label>
        <label>
          Ground Y
          <input
            type="number"
            value={ground.y}
            onChange={(e) => setGround((g) => ({ ...g, y: +e.target.value }))}
          />
        </label>
      </div>
      {tags.map((tag) => (
        <label key={tag}>
          Map “{tag}” to action
          <select
            value={actions[tag] ?? ""}
            onChange={(e) =>
              setActions((a) => ({ ...a, [tag]: e.target.value }))
            }
          >
            <option value="">Choose explicitly…</option>
            {[
              "idle",
              "walk",
              "talk",
              "turn",
              "attack",
              "hit",
              "jump",
              "block",
            ].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      ))}
      {error && (
        <p role="alert" className="pd-error">
          {error}
        </p>
      )}
      <button
        className="pd-primary pd-wide"
        disabled={
          !image ||
          !json ||
          !name ||
          !source ||
          !license ||
          tags.some((t) => !actions[t])
        }
        onClick={() => {
          try {
            onImport(
              importAsepriteSheet(json, image, {
                id: `import:${crypto.randomUUID()}`,
                name,
                style,
                source,
                license,
                author,
                actions,
                ground,
              }),
            );
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        Validate & import family
      </button>
      <p className="pd-muted">
        Trimmed and rotated frames require an untrimmed export. Imported
        appearance adds no combat AI or hitboxes.
      </p>
    </div>
  );
}
