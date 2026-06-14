import { useEffect, useRef, useState } from "react";
import {
  Crop,
  ImagePlus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

const ARTWORK_PRESETS = {
  logo: {
    label: "Logo",
    hint: "Wide, transparent artwork works best",
    width: 320,
    height: 100,
  },
  strip: {
    label: "Strip image",
    hint: "A wide banner behind the pass content",
    width: 750,
    height: 246,
  },
  thumbnail: {
    label: "Thumbnail",
    hint: "A square event, product, or profile image",
    width: 270,
    height: 270,
  },
};

function normalizeRotation(value) {
  return ((value % 360) + 360) % 360;
}

function getCoverScale(image, width, height, rotation) {
  const quarterTurn = normalizeRotation(rotation) % 180 !== 0;
  const rotatedWidth = quarterTurn ? image.height : image.width;
  const rotatedHeight = quarterTurn ? image.width : image.height;
  return Math.max(width / rotatedWidth, height / rotatedHeight);
}

function clampOffset(image, width, height, rotation, zoom, offset) {
  const quarterTurn = normalizeRotation(rotation) % 180 !== 0;
  const scale = getCoverScale(image, width, height, rotation) * zoom;
  const renderedWidth = (quarterTurn ? image.height : image.width) * scale;
  const renderedHeight = (quarterTurn ? image.width : image.height) * scale;
  const limitX = Math.max(0, (renderedWidth - width) / 2);
  const limitY = Math.max(0, (renderedHeight - height) / 2);

  return {
    x: Math.max(-limitX, Math.min(limitX, offset.x)),
    y: Math.max(-limitY, Math.min(limitY, offset.y)),
  };
}

function CropModal({ source, preset, onCancel, onApply }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setReady(true);
    };
    image.src = source;

    return () => {
      image.onload = null;
    };
  }, [source]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !ready) return;

    const context = canvas.getContext("2d");
    const safeOffset = clampOffset(
      image,
      preset.width,
      preset.height,
      rotation,
      zoom,
      offset,
    );
    const scale = getCoverScale(image, preset.width, preset.height, rotation) * zoom;

    context.clearRect(0, 0, preset.width, preset.height);
    context.save();
    context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    context.translate(
      preset.width / 2 + safeOffset.x,
      preset.height / 2 + safeOffset.y,
    );
    context.rotate((rotation * Math.PI) / 180);
    context.scale(scale, scale);
    context.drawImage(image, -image.width / 2, -image.height / 2);
    context.restore();
  }, [brightness, contrast, offset, preset, ready, rotation, zoom]);

  const reset = () => {
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setOffset({ x: 0, y: 0 });
  };

  const rotate = (amount) => {
    setRotation((current) => normalizeRotation(current + amount));
    setOffset({ x: 0, y: 0 });
  };

  const beginDrag = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset,
    };
  };

  const continueDrag = (event) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = preset.width / rect.width;
    const scaleY = preset.height / rect.height;
    const nextOffset = {
      x: drag.offset.x + (event.clientX - drag.x) * scaleX,
      y: drag.offset.y + (event.clientY - drag.y) * scaleY,
    };
    setOffset(
      clampOffset(
        image,
        preset.width,
        preset.height,
        rotation,
        zoom,
        nextOffset,
      ),
    );
  };

  const endDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const apply = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    onApply(canvas.toDataURL("image/png"));
  };

  return (
    <div className="crop-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="crop-dialog-header">
          <div>
            <span className="eyebrow">EDIT ARTWORK</span>
            <h2 id="crop-dialog-title">Crop {preset.label.toLowerCase()}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close image editor">
            <X size={19} />
          </button>
        </header>

        <div className="crop-stage-wrap">
          <canvas
            ref={canvasRef}
            className="crop-stage"
            width={preset.width}
            height={preset.height}
            onPointerDown={beginDrag}
            onPointerMove={continueDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          {!ready && <span className="crop-loading">Preparing image...</span>}
          <span className="crop-help">Drag to reposition</span>
        </div>

        <div className="crop-controls">
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.target.value);
                setZoom(nextZoom);
                const image = imageRef.current;
                if (image) {
                  setOffset((current) =>
                    clampOffset(
                      image,
                      preset.width,
                      preset.height,
                      rotation,
                      nextZoom,
                      current,
                    ),
                  );
                }
              }}
            />
          </label>
          <label>
            <span>Brightness</span>
            <input
              type="range"
              min="60"
              max="140"
              value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Contrast</span>
            <input
              type="range"
              min="60"
              max="140"
              value={contrast}
              onChange={(event) => setContrast(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="crop-toolbar">
          <div>
            <button type="button" onClick={() => rotate(-90)} title="Rotate left">
              <RotateCcw size={17} /> Rotate left
            </button>
            <button type="button" onClick={() => rotate(90)} title="Rotate right">
              <RotateCw size={17} /> Rotate right
            </button>
          </div>
          <button type="button" onClick={reset}>
            <SlidersHorizontal size={17} /> Reset edits
          </button>
        </div>

        <footer className="crop-dialog-actions">
          <span>{preset.width} x {preset.height} PNG</span>
          <div>
            <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
            <button className="primary-action" type="button" onClick={apply} disabled={!ready}>
              <Crop size={17} /> Apply crop
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function ArtworkEditor({ type, value, onChange }) {
  const inputRef = useRef(null);
  const [editorSource, setEditorSource] = useState("");
  const preset = ARTWORK_PRESETS[type];

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditorSource(String(reader.result || ""));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <>
      <article className={`artwork-control ${value ? "has-image" : ""}`}>
        <button
          className="artwork-preview"
          type="button"
          onClick={() => (value ? setEditorSource(value) : inputRef.current?.click())}
          aria-label={value ? `Edit ${preset.label}` : `Add ${preset.label}`}
        >
          {value ? <img src={value} alt="" /> : <ImagePlus size={22} />}
        </button>
        <div className="artwork-copy">
          <strong>{preset.label}</strong>
          <span>{value ? "Cropped and ready for Wallet" : preset.hint}</span>
        </div>
        <div className="artwork-actions">
          <button type="button" onClick={() => (value ? setEditorSource(value) : inputRef.current?.click())}>
            {value ? <Crop size={16} /> : <ImagePlus size={16} />}
            {value ? "Edit" : "Add"}
          </button>
          {value && (
            <button className="danger-icon" type="button" onClick={() => onChange("")} aria-label={`Remove ${preset.label}`}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={selectFile}
          hidden
        />
      </article>

      {editorSource && (
        <CropModal
          source={editorSource}
          preset={preset}
          onCancel={() => setEditorSource("")}
          onApply={(dataUrl) => {
            onChange(dataUrl);
            setEditorSource("");
          }}
        />
      )}
    </>
  );
}
