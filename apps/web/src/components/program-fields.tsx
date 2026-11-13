"use client";
import { useState } from "react";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import Plus from "lucide-react/icons/plus";
import { ReorderHandle, useReorderList } from "./reorder-handle.tsx";
import { EditorPopover } from "./editor-popover.tsx";
import { AutoTextarea } from "./auto-textarea.tsx";
import { programTimeOrderWarnings, type ProgramItem } from "@eventcraft/core";

export function ProgramFields({
  items,
  onChange,
  onRemove,
  onReorder,
}: {
  items: ProgramItem[];
  onChange: (items: ProgramItem[]) => void;
  onRemove: (item: ProgramItem, index: number) => void;
  onReorder: (items: ProgramItem[]) => void;
}) {
  const warnings = new Set(programTimeOrderWarnings(items));
  function update(id: string, patch: Partial<ProgramItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  const [announcement, setAnnouncement] = useState("");
  const reorder = useReorderList(items, onReorder, setAnnouncement);
  function addAt(index: number) {
    if (items.length >= 200) return;
    const id = crypto.randomUUID();
    const next = [...items];
    next.splice(index, 0, { id, time: null, title: "", description: "" });
    onChange(next);
    requestAnimationFrame(() =>
      document.getElementById(`program-title-${id}`)?.focus(),
    );
  }
  return (
    <div className="program-fields" ref={reorder.root}>
      {reorder.hint}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {!!warnings.size && (
        <p className="program-warning" role="status">
          Время этапов идёт не по порядку. Проверьте часы и последовательность;
          автоматически они не меняются.
        </p>
      )}
      {!items.length && (
        <p className="program-empty">Добавьте первый этап события.</p>
      )}
      {items.map((item, index) => (
        <div
          className="program-item"
          key={item.id}
          {...reorder.itemProps(item.id)}
        >
          <ReorderHandle
            label={`Переместить этап ${item.title || index + 1}`}
            {...reorder.handleProps(item.id)}
          />
          <label className="program-time">
            <span>Начало</span>
            <input
              type="time"
              aria-label={`Начало этапа ${index + 1}`}
              value={item.time ?? ""}
              onChange={(event) =>
                update(item.id, { time: event.target.value || null })
              }
            />
            {warnings.has(item.id) && <small>Раньше предыдущего этапа</small>}
          </label>
          <div className="program-content">
            <input
              id={`program-title-${item.id}`}
              aria-label={`Название этапа ${index + 1}`}
              placeholder="Что произойдёт"
              value={item.title}
              maxLength={200}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.altKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  addAt(index + 1);
                }
              }}
              onChange={(event) =>
                update(item.id, { title: event.target.value })
              }
            />
            <AutoTextarea
              aria-label={`Описание этапа ${index + 1}`}
              placeholder="Детали, важные для заказчика"
              value={item.description}
              maxLength={2000}
              rows={2}
              onChange={(event) =>
                update(item.id, { description: event.target.value })
              }
            />
          </div>
          <div className="program-actions">
            <EditorPopover
              label={`Действия этапа ${index + 1}`}
              trigger={<MoreHorizontal size={17} aria-hidden="true" />}
            >
              <button
                disabled={index === 0}
                onClick={() => {
                  const next = [...items];
                  [next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ];
                  onReorder(next);
                }}
              >
                Переместить выше
              </button>
              <button
                disabled={index === items.length - 1}
                onClick={() => {
                  const next = [...items];
                  [next[index + 1], next[index]] = [
                    next[index],
                    next[index + 1],
                  ];
                  onReorder(next);
                }}
              >
                Переместить ниже
              </button>
              <button
                className="danger-action"
                onClick={() => onRemove(item, index)}
              >
                Удалить этап
              </button>
            </EditorPopover>
          </div>
        </div>
      ))}
      <button
        className="button add-line"
        disabled={items.length >= 200}
        onClick={() => addAt(items.length)}
      >
        <Plus size={16} aria-hidden="true" /> Этап
      </button>
    </div>
  );
}
