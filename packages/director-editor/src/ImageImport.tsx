import { useState } from "react";
import { importImageAsset } from "@onepage/director-io";
import type { PackManifest, StyleId } from "@onepage/director-core";
export function ImageImport({
  onImport,
}: {
  onImport: (pack: PackManifest) => Promise<void>;
}) {
  const [image, setImage] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [name, setName] = useState("Imported artwork");
  const [source, setSource] = useState("");
  const [license, setLicense] = useState("");
  const [author, setAuthor] = useState("");
  const [kind, setKind] = useState<"set" | "prop">("set");
  const [style, setStyle] = useState<StyleId>("16-bit");
  const [height, setHeight] = useState(176);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p>
        Bring your own background or prop. The original image and attribution
        are embedded in the pack. This imports a static asset; animation
        requires tagged frames.
      </p>
      <label>
        PNG / JPEG / WebP
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 8_000_000) {
              setError("Image exceeds 8 MB limit");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const data = String(reader.result);
              const img = new Image();
              img.onload = () => {
                setDimensions({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
                setImage(data);
                setError("");
              };
              img.onerror = () => setError("Image could not be decoded");
              img.src = data;
            };
            reader.readAsDataURL(f);
          }}
        />
      </label>
      {image && (
        <>
          <img
            src={image}
            alt="Imported artwork preview"
            style={{
              width: "100%",
              maxHeight: 190,
              objectFit: "contain",
              background: "#283740",
            }}
          />
          <small>
            {dimensions.width} × {dimensions.height} original pixels
          </small>
        </>
      )}
      <div className="pd-fitting-grid">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Kind
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "set" | "prop");
              setHeight(e.target.value === "set" ? 176 : 48);
            }}
          >
            <option value="set">Background / set</option>
            <option value="prop">Prop</option>
          </select>
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
          Logical height
          <input
            type="number"
            min={1}
            value={height}
            onChange={(e) => setHeight(+e.target.value)}
          />
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
      </div>
      {error && (
        <p role="alert" className="pd-error">
          {error}
        </p>
      )}
      <button
        className="pd-primary pd-wide"
        disabled={!image || !name || !source || !license || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onImport(
              importImageAsset(image, {
                id: `image:${crypto.randomUUID()}`,
                name,
                kind,
                style,
                ...dimensions,
                source,
                license,
                author,
                logicalHeight: height,
              }),
            );
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Importing…" : "Import static artwork"}
      </button>
      <p className="pd-muted">
        After import, select a stage layer in Inspect and choose this family.
        Layer X/Y controls its top-left position.
      </p>
    </>
  );
}
