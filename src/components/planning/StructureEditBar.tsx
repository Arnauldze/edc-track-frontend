"use client";

// Barre d'édition de la structure dans le tableau de planification, et menu
// contextuel des lignes. Les deux présentent la même liste d'actions.

import type { LucideIcon } from "lucide-react";
import { Loader2, Redo2, Save, Undo2, X } from "lucide-react";

export interface StructureAction {
  key: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  enabled: boolean;
  /** Explique pourquoi l'action est indisponible. */
  hint?: string;
  danger?: boolean;
  /** Commence un nouveau groupe dans la barre et le menu. */
  separator?: boolean;
  run: () => void;
}

interface StructureEditBarProps {
  actions: StructureAction[];
  changeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const buttonStyle = (enabled: boolean, danger?: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 7px",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 3,
  color: danger ? "#C0392B" : "var(--msp-text)",
  fontSize: 11,
  fontWeight: 600,
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.35,
  whiteSpace: "nowrap",
});

const titleOf = (action: StructureAction) =>
  [action.label, action.shortcut && `(${action.shortcut})`, !action.enabled && action.hint].filter(Boolean).join(" — ");

export function StructureEditBar({
  actions,
  changeCount,
  canUndo,
  canRedo,
  saving,
  onUndo,
  onRedo,
  onCancel,
  onSave,
}: StructureEditBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "4px 8px",
        background: "var(--primary-subtle)",
        borderBottom: "1px solid var(--msp-border-header)",
        flexWrap: "wrap",
        flexShrink: 0,
      }}
    >
      {actions.map((action) => (
        <div key={action.key} style={{ display: "flex", alignItems: "center" }}>
          {action.separator && <span style={{ width: 1, height: 18, background: "var(--msp-border-header)", margin: "0 4px" }} />}
          <button
            type="button"
            className="msp-tool"
            onClick={action.run}
            disabled={!action.enabled}
            title={titleOf(action)}
            style={buttonStyle(action.enabled, action.danger)}
          >
            <action.icon size={13} />
            <span className="msp-tool-label">{action.label}</span>
          </button>
        </div>
      ))}

      <span style={{ width: 1, height: 18, background: "var(--msp-border-header)", margin: "0 4px" }} />
      <button type="button" className="msp-tool" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)" style={buttonStyle(canUndo)}>
        <Undo2 size={13} />
      </button>
      <button type="button" className="msp-tool" onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)" style={buttonStyle(canRedo)}>
        <Redo2 size={13} />
      </button>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--msp-text-muted)" }}>
          {changeCount === 0 ? "Aucune modification" : `${changeCount} modification${changeCount > 1 ? "s" : ""} non enregistrée${changeCount > 1 ? "s" : ""}`}
        </span>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#666", color: "#fff", border: "none", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
        >
          <X size={12} /> {changeCount === 0 ? "Fermer" : "Abandonner"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || changeCount === 0}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#70AD47", color: "#fff",
            border: "none", borderRadius: 3, fontSize: 11, fontWeight: 600,
            cursor: saving || changeCount === 0 ? "not-allowed" : "pointer", opacity: changeCount === 0 ? 0.5 : 1,
          }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
        </button>
      </div>
    </div>
  );
}

interface StructureRowMenuProps {
  x: number;
  y: number;
  actions: StructureAction[];
  onClose: () => void;
}

export function StructureRowMenu({ x, y, actions, onClose }: StructureRowMenuProps) {
  return (
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", left: x, top: y, zIndex: 1000, minWidth: 230,
        background: "var(--bg-surface)", border: "1px solid var(--msp-border-header)",
        borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: "4px 0", fontSize: 11,
      }}
    >
      {actions.map((action) => (
        <div key={action.key}>
          {action.separator && <div style={{ borderTop: "1px solid var(--msp-border)", margin: "4px 0" }} />}
          <button
            type="button"
            role="menuitem"
            disabled={!action.enabled}
            title={!action.enabled ? action.hint : undefined}
            onClick={() => {
              onClose();
              action.run();
            }}
            className="msp-menu-item"
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "5px 12px",
              background: "none", border: "none", textAlign: "left", fontSize: 11,
              color: action.danger ? "#C0392B" : "var(--msp-text)",
              cursor: action.enabled ? "pointer" : "not-allowed", opacity: action.enabled ? 1 : 0.4,
            }}
          >
            <action.icon size={13} />
            <span style={{ flex: 1 }}>{action.label}</span>
            {action.shortcut && <span style={{ fontSize: 10, color: "var(--msp-text-muted)" }}>{action.shortcut}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
