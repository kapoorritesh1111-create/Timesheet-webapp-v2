"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export type ColumnDef<T> = {
  key: string;
  header: ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  cell: (row: T) => ReactNode;
  meta?: { grow?: boolean };
};

export type ActionItem<T> = {
  label: string;
  onSelect: (row: T) => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
};

function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function Tag(props: { children: ReactNode; tone?: "default" | "success" | "warn" | "danger" }) {
  const tone = props.tone ?? "default";
  return <span className={"mwTag mwTag-" + tone}>{props.children}</span>;
}

function ActionsMenu<T>(props: { row: T; items: ActionItem<T>[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const enabled = props.items.filter((i) => !i.disabled);

  if (enabled.length === 0) return null;

  return (
    <div ref={ref} className="mwActionsWrap" onClick={(e) => stop(e as any)}>
      <button className="iconBtn" type="button" aria-label="Row actions" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={18} />
      </button>

      {open ? (
        <div className="mwMenu" role="menu">
          {props.items.map((it) => (
            <button
              key={it.label}
              type="button"
              className={"mwMenuItem" + (it.danger ? " mwMenuItemDanger" : "")}
              disabled={it.disabled}
              onClick={async () => {
                try {
                  setOpen(false);
                  await it.onSelect(props.row);
                } catch {
                  // callers should handle errors; keep silent here
                }
              }}
              role="menuitem"
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DataTable<T>(props: {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;

  /** When provided, the matching row is rendered as selected (subtle highlight + left accent). */
  selectedRowId?: string;

  onRowClick?: (row: T) => void;

  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyAction?: ReactNode;

  actions?: ActionItem<T>[] | ((row: T) => ActionItem<T>[]);

  compact?: boolean;
}) {
  const cols = props.columns;
  const hasActions = !!props.actions;

  const headerCols = useMemo(() => (hasActions ? [...cols, { key: "__actions", header: "", cell: () => null }] : cols), [
    cols,
    hasActions,
  ]);

  return (
    <div className={"mwTableWrap" + (props.compact ? " mwTableCompact" : "")}>
      <table className="mwTable">
        <thead>
          <tr>
            {headerCols.map((c) => (
              <th key={c.key} style={{ width: (c as any).width }} className={c.align ? "mwAlign-" + c.align : ""}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {props.loading ? (
            <LoadingRows colCount={headerCols.length} />
          ) : props.rows.length === 0 ? (
            <tr>
              <td colSpan={headerCols.length} style={{ padding: 0 }}>
                <EmptyState
                  title={props.emptyTitle ?? "No results"}
                  subtitle={props.emptySubtitle ?? "Try adjusting your filters."}
                  action={props.emptyAction}
                />
              </td>
            </tr>
          ) : (
            props.rows.map((row) => {
              const key = props.rowKey(row);
              const rowActions = typeof props.actions === "function" ? props.actions(row) : props.actions;

              const isSelected = !!props.selectedRowId && props.selectedRowId === key;

              return (
                <tr
                  key={key}
                  className={(props.onRowClick ? "mwRowClickable" : "") + (isSelected ? " mwRowSelected" : "")}
                  onClick={() => props.onRowClick?.(row)}
                >
                  {cols.map((c) => (
                    <td key={c.key} className={c.align ? "mwAlign-" + c.align : ""}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {hasActions ? (
                    <td className="mwAlign-right">
                      {rowActions ? <ActionsMenu row={row} items={rowActions} /> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState(props: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mwEmpty">
      <div className="mwEmptyTitle">{props.title}</div>
      {props.subtitle ? <div className="mwEmptySubtitle">{props.subtitle}</div> : null}
      {props.action ? <div style={{ marginTop: 12 }}>{props.action}</div> : null}
    </div>
  );
}

function LoadingRows(props: { colCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="mwLoadingRow">
          {Array.from({ length: props.colCount }).map((__, j) => (
            <td key={j}>
              <div className="mwSkeleton" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
