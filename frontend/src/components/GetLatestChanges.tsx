import { useState, useMemo } from "react";
import "./DiffViewer.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type UpdateType = "added" | "deleted" | "retained";

type DiffWord = {
  word: string;
  update_type: UpdateType;
  deleted_by?: string | null;
  merge_id?: string | number;
  new_index?: number | null;
  old_index?: number | null;
};

type SegmentType = "added" | "deleted" | "retained" | "plain";

type Segment = {
  word: string;
  type: SegmentType;
};

type ViewMode =
  | "unified"
  | "split"
  | "final"
  | "original"
  | "split-left"
  | "split-right";

type PublicViewMode = "unified" | "split" | "final" | "original";

type FilterState = {
  add: boolean;
  del: boolean;
  ret: boolean;
};

type FilterKey = keyof FilterState;

type BadgeColor = "green" | "red" | "gray";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tokensToSegments(
  tokens: DiffWord[],
  mode: ViewMode,
  filters: FilterState,
): Segment[] {
  const segments: Segment[] = [];
  for (const t of tokens) {
    const { word, update_type } = t;
    if (mode === "unified") {
      if (update_type === "added" && filters.add)
        segments.push({ word, type: "added" });
      else if (update_type === "deleted" && filters.del)
        segments.push({ word, type: "deleted" });
      else if (update_type === "retained" && filters.ret)
        segments.push({ word, type: "retained" });
    } else if (mode === "original") {
      if (update_type === "retained") segments.push({ word, type: "retained" });
      else if (update_type === "deleted") segments.push({ word, type: "plain" });
    } else if (mode === "final") {
      if (update_type === "retained") segments.push({ word, type: "retained" });
      else if (update_type === "added") segments.push({ word, type: "plain" });
    } else if (mode === "split-left") {
      if (update_type === "retained") segments.push({ word, type: "retained" });
      else if (update_type === "deleted")
        segments.push({ word, type: "deleted" });
    } else if (mode === "split-right") {
      if (update_type === "retained") segments.push({ word, type: "retained" });
      else if (update_type === "added") segments.push({ word, type: "added" });
    }
  }
  return segments;
}

// ─── SegmentToken ─────────────────────────────────────────────────────────────
function SegmentToken({ word, type }: Segment) {
  if (type === "added")
    return <mark className="diff-viewer__segment--added">{word} </mark>;
  if (type === "deleted")
    return <del className="diff-viewer__segment--deleted">{word} </del>;
  return <span>{word} </span>;
}

// ─── DocPanel ─────────────────────────────────────────────────────────────────
type DocPanelProps = {
  tokens: DiffWord[];
  mode: ViewMode;
  filters: FilterState;
  label?: string;
};

function DocPanel({ tokens, mode, filters, label }: DocPanelProps) {
  const segments = useMemo(
    () => tokensToSegments(tokens, mode, filters),
    [tokens, mode, filters],
  );
  return (
    <div className="diff-viewer__panel">
      {label && <div className="diff-viewer__panel-label">{label}</div>}
      <div className="diff-viewer__doc-body">
        {segments.map((seg, i) => (
          <SegmentToken key={i} word={seg.word} type={seg.type} />
        ))}
      </div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeProps = {
  label: string;
  color: BadgeColor;
  active: boolean;
  onClick: () => void;
};

function Badge({ label, color, active, onClick }: BadgeProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "diff-viewer__badge",
        `diff-viewer__badge--${color}`,
        !active ? "diff-viewer__badge--off" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </button>
  );
}

// ─── ViewBtn ──────────────────────────────────────────────────────────────────
type ViewBtnProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function ViewBtn({ label, active, onClick }: ViewBtnProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "diff-viewer__view-btn",
        active ? "diff-viewer__view-btn--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </button>
  );
}

// ─── DiffViewer ───────────────────────────────────────────────────────────────
type DiffViewerProps = {
  diffData?: DiffWord[];
};

export default function DiffViewer({ diffData = [] }: DiffViewerProps) {
  const [view, setView] = useState<PublicViewMode>("unified");
  const [filters, setFilters] = useState<FilterState>({
    add: true,
    del: true,
    ret: true,
  });

  const counts = useMemo(() => {
    const c: Record<UpdateType, number> = { added: 0, deleted: 0, retained: 0 };
    diffData.forEach((t) => {
      if (t.update_type === "added") c.added++;
      else if (t.update_type === "deleted") c.deleted++;
      else c.retained++;
    });
    return c;
  }, [diffData]);

  const toggleFilter = (key: FilterKey) =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  const views: PublicViewMode[] = ["unified", "split", "final", "original"];

  return (
    <div className="diff-viewer">
      {/* Toolbar */}
      <div className="diff-viewer__toolbar">
        <div className="diff-viewer__badges">
          <Badge
            label={`+${counts.added} added`}
            color="green"
            active={filters.add}
            onClick={() => toggleFilter("add")}
          />
          <Badge
            label={`-${counts.deleted} deleted`}
            color="red"
            active={filters.del}
            onClick={() => toggleFilter("del")}
          />
          <Badge
            label={`${counts.retained} retained`}
            color="gray"
            active={filters.ret}
            onClick={() => toggleFilter("ret")}
          />
        </div>
        <div className="diff-viewer__view-btns">
          {views.map((v) => (
            <ViewBtn
              key={v}
              label={v}
              active={view === v}
              onClick={() => setView(v)}
            />
          ))}
        </div>
      </div>

      {/* Panels */}
      {view === "split" ? (
        <div className="diff-viewer__split-grid">
          <DocPanel
            tokens={diffData}
            mode="split-left"
            filters={filters}
            label="Original"
          />
          <DocPanel
            tokens={diffData}
            mode="split-right"
            filters={filters}
            label="Updated"
          />
        </div>
      ) : view === "unified" ? (
        <DocPanel tokens={diffData} mode="unified" filters={filters} />
      ) : view === "final" ? (
        <DocPanel
          tokens={diffData}
          mode="final"
          filters={filters}
          label="Final document"
        />
      ) : (
        <DocPanel
          tokens={diffData}
          mode="original"
          filters={filters}
          label="Original document"
        />
      )}
    </div>
  );
}
