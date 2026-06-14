import { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  LoaderCircle,
  Palette,
  RotateCcw,
  Settings2,
  Ticket,
} from "lucide-react";
import ArtworkEditor from "./components/ArtworkEditor";
import FieldEditor from "./components/FieldEditor";
import PassPreview from "./components/PassPreview";
import { apiUrl, hasConfiguredApi } from "./api";
import { cloneTemplate, templates } from "./templates";

const groups = ["header", "primary", "secondary", "auxiliary", "back"];

function ColorInput({ label, value, onChange }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <div>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input value={value.toUpperCase()} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

export default function App() {
  const [pass, setPass] = useState(() => ({
    ...cloneTemplate(templates[0]),
    assets: { logo: "", strip: "", thumbnail: "" },
    expirationDate: "",
  }));
  const [activePanel, setActivePanel] = useState("design");
  const [signingInfo, setSigningInfo] = useState(null);
  const [downloadState, setDownloadState] = useState("idle");
  const [notice, setNotice] = useState("");
  const signingReady = Boolean(signingInfo?.signingConfigured);
  const isPro = signingInfo?.usage?.plan === "pro";

  useEffect(() => {
    const healthUrl = apiUrl("/api/health");
    if (!healthUrl) {
      setSigningInfo({
        signingConfigured: false,
        provider: "WalletWallet",
        message: "The signing service has not been deployed.",
      });
      return;
    }

    fetch(healthUrl)
      .then((response) => response.json())
      .then((data) => setSigningInfo(data))
      .catch(() =>
        setSigningInfo({
          signingConfigured: false,
          provider: "WalletWallet",
          message: "The signing service is unavailable.",
        }),
      );
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === pass.id),
    [pass.id],
  );

  const update = (property, value) => setPass((current) => ({ ...current, [property]: value }));
  const updateNested = (group, property, value) =>
    setPass((current) => ({ ...current, [group]: { ...current[group], [property]: value } }));

  const selectTemplate = (template) => {
    const assets = pass.assets;
    setPass({
      ...cloneTemplate(template),
      assets,
      expirationDate: "",
    });
    setNotice("");
    setDownloadState("idle");
  };

  const downloadPass = async () => {
    const passesUrl = apiUrl("/api/passes");
    if (!passesUrl) {
      setDownloadState("error");
      setNotice("The signing service is not connected yet.");
      return;
    }

    setDownloadState("loading");
    setNotice("");
    try {
      const response = await fetch(passesUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pass),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "The pass could not be generated.");
      }

      const result = await response.json();
      const passDownloadUrl = result.downloadUrl.startsWith("http")
        ? result.downloadUrl
        : new URL(result.downloadUrl, passesUrl).toString();
      setDownloadState("done");
      setNotice("Your pass is ready. Continue on the install page.");
      window.location.assign(passDownloadUrl);
    } catch (error) {
      setDownloadState("error");
      setNotice(error.message);
    }
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(pass, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${pass.logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "wallet-pass"}.wallet-project.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("Project exported.");
    setDownloadState("done");
  };

  const remainingPasses = signingInfo?.usage?.remaining;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#">
          <span><Ticket size={20} /></span>
          Wallet Studio
        </a>
        <span className={`status-pill ${signingReady ? "ready" : ""}`}>
          <i />
          {signingInfo === null
            ? "Connecting"
            : signingReady
              ? "Ready"
              : hasConfiguredApi
                ? "Unavailable"
                : "Preview mode"}
        </span>
      </header>

      <main className="workspace">
        <aside className="template-sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">STARTING POINT</span>
              <h2>Templates</h2>
            </div>
          </div>
          <div className="template-list">
            {templates.map((template) => (
              <button
                className={`template-card ${pass.id === template.id ? "selected" : ""}`}
                type="button"
                key={template.id}
                onClick={() => selectTemplate(template)}
              >
                <span className="template-swatch" style={{ background: template.colors.background }}>
                  <Ticket size={17} />
                </span>
                <span>
                  <small>{template.eyebrow}</small>
                  <strong>{template.name}</strong>
                </span>
                {pass.id === template.id && <Check className="selected-check" size={15} />}
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-panel">
          <div className="editor-title">
            <div>
              <span className="eyebrow">CUSTOMIZE</span>
              <h1>{selectedTemplate?.name}</h1>
              <p>Your changes appear in the preview instantly.</p>
            </div>
            <button className="reset-button" type="button" onClick={() => selectTemplate(selectedTemplate)}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          <div className="panel-tabs">
            <button className={activePanel === "design" ? "active" : ""} onClick={() => setActivePanel("design")}>
              <Palette size={16} /> Design
            </button>
            <button className={activePanel === "content" ? "active" : ""} onClick={() => setActivePanel("content")}>
              <Ticket size={16} /> Content
            </button>
            <button className={activePanel === "details" ? "active" : ""} onClick={() => setActivePanel("details")}>
              <Settings2 size={16} /> Details
            </button>
          </div>

          <div className="editor-scroll">
            {activePanel === "design" && (
              <>
                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Identity</h3><p>The name shown on the pass and install screen.</p></div>
                  </div>
                  <label className="text-control">
                    <span>Logo text</span>
                    <input value={pass.logoText} onChange={(event) => update("logoText", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Organization name</span>
                    <input value={pass.organizationName} onChange={(event) => update("organizationName", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Pass description</span>
                    <input value={pass.passDescription} onChange={(event) => update("passDescription", event.target.value)} />
                  </label>
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Pass color</h3><p>Choose the main Wallet background color.</p></div>
                  </div>
                  <ColorInput
                    label="Background"
                    value={pass.colors.background}
                    onChange={(value) => updateNested("colors", "background", value)}
                  />
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Artwork</h3><p>Crop and adjust each image before adding it to the pass.</p></div>
                  </div>
                  <div className="upload-list">
                    <ArtworkEditor type="logo" value={pass.assets.logo} onChange={(value) => updateNested("assets", "logo", value)} />
                    <ArtworkEditor type="strip" value={pass.assets.strip} onChange={(value) => updateNested("assets", "strip", value)} />
                    <ArtworkEditor type="thumbnail" value={pass.assets.thumbnail} onChange={(value) => updateNested("assets", "thumbnail", value)} />
                  </div>
                  {signingInfo !== null && !isPro && (
                    <div className="inline-warning">
                      <CircleAlert size={17} />
                      Artwork requires a WalletWallet Pro plan.
                    </div>
                  )}
                </section>
              </>
            )}

            {activePanel === "content" && (
              <>
                {groups.map((group) => (
                  <FieldEditor
                    group={group}
                    fields={pass.fields[group]}
                    onChange={(fields) => updateNested("fields", group, fields)}
                    key={group}
                  />
                ))}
              </>
            )}

            {activePanel === "details" && (
              <>
                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Barcode</h3><p>What scanners read and people see beneath it.</p></div>
                  </div>
                  <label className="text-control">
                    <span>Format</span>
                    <div className="select-wrap">
                      <select value={pass.barcode.format} onChange={(event) => updateNested("barcode", "format", event.target.value)}>
                        <option value="PKBarcodeFormatQR">QR code</option>
                        <option value="PKBarcodeFormatPDF417">PDF417</option>
                        <option value="PKBarcodeFormatAztec">Aztec</option>
                        <option value="PKBarcodeFormatCode128">Code 128</option>
                      </select>
                      <ChevronDown size={16} />
                    </div>
                  </label>
                  <label className="text-control">
                    <span>Encoded message</span>
                    <input value={pass.barcode.message} onChange={(event) => updateNested("barcode", "message", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Text below barcode</span>
                    <input value={pass.barcode.altText} onChange={(event) => updateNested("barcode", "altText", event.target.value)} />
                  </label>
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Expiration</h3><p>Leave empty when the pass should not expire.</p></div>
                  </div>
                  <label className="text-control">
                    <span>Expiration date</span>
                    <input type="datetime-local" value={pass.expirationDate} onChange={(event) => update("expirationDate", event.target.value)} />
                  </label>
                </section>
              </>
            )}
          </div>
        </section>

        <aside className="preview-panel">
          <div className="preview-heading">
            <div>
              <span className="eyebrow">LIVE PREVIEW</span>
              <h2>Ready for Wallet</h2>
            </div>
          </div>

          <PassPreview pass={pass} />

          <div className="publish-card">
            {!signingReady && signingInfo !== null && (
              <div className="setup-warning">
                <CircleAlert size={18} />
                <span>{signingInfo?.message || "The signing service is unavailable."}</span>
              </div>
            )}
            {signingReady && typeof remainingPasses === "number" && (
              <div className="provider-summary">
                <span>{isPro ? "Custom artwork enabled" : "Managed signing"}</span>
                <strong>{remainingPasses.toLocaleString()} passes left</strong>
              </div>
            )}
            <button className="wallet-button" type="button" onClick={downloadPass} disabled={downloadState === "loading"}>
              {downloadState === "loading" ? <LoaderCircle className="spinner" size={24} /> : <Apple fill="currentColor" size={25} />}
              <span><small>Create and install</small>Add to Apple Wallet</span>
            </button>
            <button className="project-button" type="button" onClick={exportProject}>
              <Download size={16} /> Export project
            </button>
            {notice && <p className={`notice ${downloadState === "error" ? "error" : ""}`}>{notice}</p>}
          </div>
        </aside>
      </main>
    </div>
  );
}
