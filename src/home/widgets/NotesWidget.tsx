import { useState } from "react";
import { HoverCtl } from "./HoverArrows";

interface Note { id: string; text: string; done: boolean; }

interface Props {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

function readNotes(p: Record<string, unknown>): Note[] {
  if (!Array.isArray(p.notes)) return [];
  return (p.notes as unknown[]).filter(
    (n): n is Note =>
      typeof n === "object" && n !== null &&
      typeof (n as Note).id === "string" &&
      typeof (n as Note).text === "string" &&
      typeof (n as Note).done === "boolean",
  );
}

/** Quick notes — buttonless by design: click the bullet to strike a note
 *  through, click the text to edit inline, save an empty text to delete.
 *  Only chrome is the minimal "+" to add. Notes persist inside the
 *  widget's layout props (no dedicated backend). */
export function NotesWidget({ widgetProps, onWidgetPropsChange }: Props) {
  const notes = readNotes(widgetProps);
  const [editingId, setEditingId] = useState<string | null>(null);

  const commit = (next: Note[]) =>
    onWidgetPropsChange({ ...widgetProps, notes: next });

  const add = () => {
    const note: Note = { id: crypto.randomUUID(), text: "", done: false };
    commit([...notes, note]);
    setEditingId(note.id);
  };

  const toggle = (id: string) =>
    commit(notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));

  const save = (id: string, raw: string) => {
    const text = raw.trim();
    setEditingId(null);
    // Empty text = delete: clearing a note is how you remove it.
    commit(text === ""
      ? notes.filter((n) => n.id !== id)
      : notes.map((n) => (n.id === id ? { ...n, text } : n)));
  };

  const doneCount = notes.filter((n) => n.done).length;

  return (
    <div className="home-notes">
      {doneCount > 0 && (
        <HoverCtl>
          <button className="hv-opt" onClick={() => commit(notes.filter((n) => !n.done))}>
            clear done
          </button>
        </HoverCtl>
      )}
      {notes.length === 0 && editingId === null && (
        <span className="dim">no notes — add one with +</span>
      )}
      {notes.map((n) =>
        editingId === n.id ? (
          <div className="note-row" key={n.id}>
            <span className="note-mark dim">·</span>
            <input
              className="note-input"
              autoFocus
              defaultValue={n.text}
              onBlur={(e) => save(n.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save(n.id, e.currentTarget.value);
                if (e.key === "Escape") save(n.id, n.text);
              }}
            />
          </div>
        ) : (
          <div className="note-row" key={n.id}>
            <span
              className={`note-mark${n.done ? " done" : ""}`}
              onClick={() => toggle(n.id)}
              title={n.done ? "restore" : "strike through"}
            >
              {n.done ? "✕" : "·"}
            </span>
            <span
              className={`note-text${n.done ? " done" : ""}`}
              onClick={() => setEditingId(n.id)}
            >
              {n.text}
            </span>
          </div>
        ),
      )}
      <button className="note-add" onClick={add} aria-label="Add note">+</button>
    </div>
  );
}
