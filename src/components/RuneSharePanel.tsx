import { useState } from "react";
import type { RunePage } from "../types";
import { encodeRunePage, decodeRunePage } from "../utils/runeCode";
import { useDataDragonContext } from "../contexts/DataDragonContext";

interface Props {
  currentPage: Partial<RunePage>;
  onImport: (page: Partial<RunePage>) => void;
}

export function RuneSharePanel({ currentPage, onImport }: Props) {
  const { runeStyles } = useDataDragonContext();
  const [importCode, setImportCode] = useState("");
  const [preview, setPreview] = useState<Partial<RunePage> | null>(null);
  const [parseError, setParseError] = useState("");
  const [copied, setCopied] = useState(false);

  const hasCurrentPage = !!currentPage.primaryStyleId;
  const exportCode = hasCurrentPage ? encodeRunePage(currentPage) : "";

  const styleName = (id: number) => runeStyles.find((s) => s.id === id)?.name ?? `Style ${id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParse = () => {
    if (!importCode.trim()) return;
    try {
      setPreview(decodeRunePage(importCode));
      setParseError("");
    } catch (e) {
      setParseError(String(e));
      setPreview(null);
    }
  };

  const handleLoad = () => {
    if (!preview) return;
    onImport(preview);
    setImportCode("");
    setPreview(null);
  };

  return (
    <div className="share-panel">
      {/* Export */}
      <div className="share-section">
        <span className="share-label">Export</span>
        {hasCurrentPage ? (
          <div className="share-export-row">
            <code className="share-code">{exportCode}</code>
            <button className="btn-share-copy" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <span className="share-hint">ルーンを選択するとコードが生成されます</span>
        )}
      </div>

      {/* Import */}
      <div className="share-section">
        <span className="share-label">Import</span>
        <div className="share-import-row">
          <input
            className="share-input"
            type="text"
            placeholder="コードを貼り付け..."
            value={importCode}
            onChange={(e) => { setImportCode(e.target.value); setPreview(null); setParseError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleParse()}
          />
          <button className="btn-share-parse" onClick={handleParse} disabled={!importCode.trim()}>
            Parse
          </button>
        </div>
        {parseError && <div className="share-error">{parseError}</div>}
        {preview && preview.primaryStyleId && (
          <div className="share-preview">
            <div className="share-preview-trees">
              <span className="share-tree primary">{styleName(preview.primaryStyleId)}</span>
              {preview.subStyleId && (
                <>
                  <span className="share-tree-sep">+</span>
                  <span className="share-tree sub">{styleName(preview.subStyleId)}</span>
                </>
              )}
              <span className="share-perk-count">{preview.selectedPerkIds?.length ?? 0} perks</span>
            </div>
            <button className="btn-share-load" onClick={handleLoad}>現在のページに読み込む</button>
          </div>
        )}
      </div>
    </div>
  );
}
