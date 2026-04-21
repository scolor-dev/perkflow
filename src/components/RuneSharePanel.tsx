import { useState } from "react";
import type { RunePage, ItemSet } from "../types";
import { encodeRunePage, decodeRunePage } from "../utils/runeCode";
import { encodeItemSet, decodeItemSet, encodeCombined, decodeCombined, detectCodeType } from "../utils/itemSetCode";
import { useDataDragonContext } from "../contexts/DataDragonContext";

interface Props {
  currentPage: Partial<RunePage>;
  onImport: (page: Partial<RunePage>) => void;
}

type PreviewData =
  | { type: "rune"; page: Partial<RunePage> }
  | { type: "itemset"; set: ItemSet }
  | { type: "combined"; page: Partial<RunePage>; set: ItemSet };

export function RuneSharePanel({ currentPage, onImport }: Props) {
  const { runeStyles } = useDataDragonContext();
  const [importCode, setImportCode] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [parseError, setParseError] = useState("");
  const [copied, setCopied] = useState<"rune" | "item" | "combined" | null>(null);

  const hasRune = !!currentPage.primaryStyleId;
  const hasItemSet = !!(currentPage.itemSet?.blocks.some((b) => b.items.length > 0));

  const runeCode = hasRune ? encodeRunePage(currentPage) : "";
  const itemCode = hasItemSet ? encodeItemSet(currentPage.itemSet!) : "";
  const combinedCode = hasRune && hasItemSet ? encodeCombined(runeCode, itemCode) : "";

  const styleName = (id: number) => runeStyles.find((s) => s.id === id)?.name ?? `Style ${id}`;

  const handleCopy = async (code: string, kind: "rune" | "item" | "combined") => {
    await navigator.clipboard.writeText(code);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleParse = () => {
    if (!importCode.trim()) return;
    setParseError("");
    setPreview(null);
    try {
      const kind = detectCodeType(importCode.trim());
      if (kind === "rune") {
        setPreview({ type: "rune", page: decodeRunePage(importCode.trim()) });
      } else if (kind === "itemset") {
        setPreview({ type: "itemset", set: decodeItemSet(importCode.trim()) });
      } else if (kind === "combined") {
        const { runeCode: rc, itemCode: ic } = decodeCombined(importCode.trim());
        const page = rc ? decodeRunePage(rc) : {};
        const set = ic ? decodeItemSet(ic) : { blocks: [] };
        setPreview({ type: "combined", page, set });
      } else {
        setParseError("不明なコード形式です");
      }
    } catch (e) {
      setParseError(String(e));
    }
  };

  const handleLoad = () => {
    if (!preview) return;
    if (preview.type === "rune") {
      onImport(preview.page);
    } else if (preview.type === "itemset") {
      onImport({ ...currentPage, itemSet: preview.set });
    } else if (preview.type === "combined") {
      onImport({ ...preview.page, itemSet: preview.set });
    }
    setImportCode("");
    setPreview(null);
  };

  return (
    <div className="share-panel">
      <div className="share-section">
        <span className="share-label">Export</span>
        {!hasRune && !hasItemSet ? (
          <span className="share-hint">ルーンまたはアイテムセットを設定するとコードが生成されます</span>
        ) : (
          <div className="share-export-list">
            {hasRune && (
              <div className="share-export-row">
                <span className="share-export-tag rune">Rune</span>
                <code className="share-code">{runeCode}</code>
                <button className="btn-share-copy" onClick={() => handleCopy(runeCode, "rune")}>
                  {copied === "rune" ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            {hasItemSet && (
              <div className="share-export-row">
                <span className="share-export-tag item">Item</span>
                <code className="share-code">{itemCode}</code>
                <button className="btn-share-copy" onClick={() => handleCopy(itemCode, "item")}>
                  {copied === "item" ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            {hasRune && hasItemSet && (
              <div className="share-export-row">
                <span className="share-export-tag combined">Full</span>
                <code className="share-code">{combinedCode}</code>
                <button className="btn-share-copy" onClick={() => handleCopy(combinedCode, "combined")}>
                  {copied === "combined" ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="share-section">
        <span className="share-label">Import</span>
        <div className="share-import-row">
          <input
            className="share-input"
            type="text"
            placeholder="コードを貼り付け... (Rune / Item / Full)"
            value={importCode}
            onChange={(e) => { setImportCode(e.target.value); setPreview(null); setParseError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleParse()}
          />
          <button className="btn-share-parse" onClick={handleParse} disabled={!importCode.trim()}>
            Parse
          </button>
        </div>
        {parseError && <div className="share-error">{parseError}</div>}
        {preview && (
          <div className="share-preview">
            <div className="share-preview-trees">
              {(preview.type === "rune" || preview.type === "combined") && preview.page.primaryStyleId && (
                <>
                  <span className="share-tree primary">{styleName(preview.page.primaryStyleId)}</span>
                  {preview.page.subStyleId && (
                    <>
                      <span className="share-tree-sep">+</span>
                      <span className="share-tree sub">{styleName(preview.page.subStyleId)}</span>
                    </>
                  )}
                  <span className="share-perk-count">{preview.page.selectedPerkIds?.length ?? 0} perks</span>
                </>
              )}
              {(preview.type === "itemset" || preview.type === "combined") && (
                <span className="share-tree item-preview">
                  {(preview as Extract<PreviewData, { set: ItemSet }>).set.blocks
                    .filter((b) => b.items.length > 0)
                    .map((b) => `${b.type}(${b.items.length})`)
                    .join(" / ")}
                </span>
              )}
            </div>
            <button className="btn-share-load" onClick={handleLoad}>現在のページに読み込む</button>
          </div>
        )}
      </div>
    </div>
  );
}
