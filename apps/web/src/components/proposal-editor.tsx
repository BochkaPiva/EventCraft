"use client";
import { useEffect, useRef, useState } from "react";
import Plus from "lucide-react/icons/plus";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import ArrowLeft from "lucide-react/icons/arrow-left";
import Eye from "lucide-react/icons/eye";
import EyeOff from "lucide-react/icons/eye-off";
import Check from "lucide-react/icons/check";
import Type from "lucide-react/icons/type";
import Clock3 from "lucide-react/icons/clock-3";
import Calculator from "lucide-react/icons/calculator";
import PanelLeftClose from "lucide-react/icons/panel-left-close";
import PanelLeftOpen from "lucide-react/icons/panel-left-open";
import Layers from "lucide-react/icons/layers";
import Trash2 from "lucide-react/icons/trash-2";
import {
  ReorderHandle,
  ReorderSurface,
  useReorderList,
} from "./reorder-handle.tsx";
import {
  calculateEstimate,
  draftDocumentSchema,
  type DraftDocument,
  type EstimateLine,
  type ProgramItem,
} from "@eventcraft/core";
import { api, ApiError, errorMessage } from "../lib/client-api.ts";
import {
  DraftSaver,
  type WorkingDraft,
  type SaveView,
} from "../lib/draft-saver.ts";
import { parseDecimalInput, formatDecimalInput } from "../lib/decimal-input.ts";
import { restoreOrder } from "../lib/reorder.ts";
import { InlineHeading } from "./inline-heading.tsx";
import { ProgramFields } from "./program-fields.tsx";
import { ProposalPreview } from "./proposal-preview.tsx";
import { EditorPopover, SectionPicker } from "./editor-popover.tsx";
import { AutoTextarea } from "./auto-textarea.tsx";
import {
  blockDescription,
  newEditorBlock,
  firstBlockField,
  duplicateBlock,
  restoreDeleted,
  type DeletedContent,
} from "../lib/editor-document.ts";

type Proposal = {
  id: string;
  title: string;
  document: DraftDocument;
  revision: number;
};
type Block = DraftDocument["blocks"][number];
const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

function DecimalField({
  value,
  places,
  maximum,
  minimum = 0,
  label,
  onChange,
  onInvalid,
  onEnter,
  id,
}: {
  value: number | null;
  places: number;
  maximum: number;
  minimum?: number;
  label: string;
  onChange: (value: number | null) => void;
  onInvalid: (invalid: boolean) => void;
  onEnter?: () => void;
  id?: string;
}) {
  const [raw, setRaw] = useState(() => formatDecimalInput(value, places)),
    [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setRaw(formatDecimalInput(value, places));
  }, [value, places]);
  return (
    <label className="estimate-number">
      <span>{places === 3 ? "Количество" : "Цена, ₽"}</span>
      <input
        className="decimal-field"
        id={id}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            onEnter &&
            !invalid &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            onEnter();
          }
        }}
        aria-label={label}
        aria-invalid={invalid}
        title={
          invalid
            ? "Введите положительное число с допустимой точностью"
            : undefined
        }
        inputMode="decimal"
        value={raw}
        placeholder="Уточняется"
        maxLength={24}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          const text = event.target.value;
          setRaw(text);
          const parsed = parseDecimalInput(text, places, maximum, minimum);
          setInvalid(parsed === undefined);
          onInvalid(parsed === undefined);
          if (parsed !== undefined) onChange(parsed);
        }}
        onBlur={() => {
          focused.current = false;
          if (!invalid) setRaw(formatDecimalInput(value, places));
        }}
      />
      {invalid && <span className="field-error">Проверьте число</span>}
    </label>
  );
}

export function ProposalEditor({ id }: { id: string }) {
  const [proposal, setProposal] = useState<Proposal | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void api<{ proposal: Proposal }>(`/api/proposals/${id}`)
      .then((data) => {
        draftDocumentSchema.parse(data.proposal.document);
        if (current) setProposal(data.proposal);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [id]);
  if (!proposal)
    return (
      <main className="editor-loading">
        <a href="/proposals">← Все предложения</a>
        {error ? (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <a href="/login">Войти</a>
            <button className="button" onClick={() => window.location.reload()}>
              Попробовать снова
            </button>
          </div>
        ) : (
          <p role="status">Открываем предложение…</p>
        )}
      </main>
    );
  return <EditorBody key={proposal.id} proposal={proposal} />;
}

export function EditorBody({ proposal }: { proposal: Proposal }) {
  const [preview, setPreview] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [draft, setDraft] = useState<WorkingDraft>(() => ({
    title: proposal.title,
    document: proposal.document,
  }));
  const [view, setView] = useState<SaveView>({
    status: "saved",
    dirty: false,
    revision: proposal.revision,
  });
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleted, setDeleted] = useState<DeletedContent | null>(null);
  const [moved, setMoved] = useState<{
    blockId?: string;
    ids: string[];
    kind: "blocks" | "program" | "estimate";
  } | null>(null);
  const [activeBlock, setActiveBlock] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [saver] = useState(
    () =>
      new DraftSaver(
        { title: proposal.title, document: proposal.document },
        proposal.revision,
        async (snapshot, expectedRevision) => {
          const result = await api<{ proposal: Proposal }>(
            `/api/proposals/${proposal.id}`,
            { ...snapshot, expectedRevision },
            "PATCH",
          );
          return { revision: result.proposal.revision };
        },
        setView,
      ),
  );
  useEffect(() => {
    saver.connect();
    return () => saver.dispose();
  }, [saver]);
  useEffect(() => {
    if (view.status !== "unsaved" || invalidFields.size) return;
    const timer = setTimeout(() => {
      void saver.flush();
    }, 800);
    return () => clearTimeout(timer);
  }, [view, saver, invalidFields]);
  useEffect(() => {
    if (!view.dirty && !invalidFields.size) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [view.dirty, invalidFields.size]);
  function change(next: WorkingDraft) {
    setDraft(next);
    saver.update(next);
  }
  const reorder = useReorderList(
    draft.document.blocks,
    (blocks) => {
      setMoved({
        kind: "blocks",
        ids: draft.document.blocks.map((block) => block.id),
      });
      setDeleted(null);
      change({ ...draft, document: { ...draft.document, blocks } });
    },
    setAnnouncement,
  );
  function blockChange(index: number, next: Block) {
    change({
      ...draft,
      document: {
        ...draft.document,
        blocks: draft.document.blocks.map((b, i) => (i === index ? next : b)),
      },
    });
  }
  function move(index: number, delta: number) {
    setMoved({
      kind: "blocks",
      ids: draft.document.blocks.map((block) => block.id),
    });
    setDeleted(null);
    const blocks = [...draft.document.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    change({ ...draft, document: { ...draft.document, blocks } });
  }
  function rememberDeleted(content: DeletedContent) {
    setMoved(null);
    setDeleted(content);
  }
  function remove(index: number) {
    setMoved(null);
    const removed = draft.document.blocks[index];
    rememberDeleted({
      kind: "block",
      label: `Раздел «${removed.heading || "Без заголовка"}»`,
      block: structuredClone(removed),
      index,
    });
    setInvalidFields(
      (prev) =>
        new Set([...prev].filter((key) => !key.startsWith(removed.id + ":"))),
    );
    change({
      ...draft,
      document: {
        ...draft.document,
        blocks: draft.document.blocks.filter((_, i) => i !== index),
      },
    });
  }
  function invalid(key: string, value: boolean) {
    setInvalidFields((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  function focusBlock(id: string, controlId?: string) {
    setActiveBlock(id);
    requestAnimationFrame(() => {
      const section = document.getElementById(`block-${id}`);
      section?.scrollIntoView({ block: "start" });
      const control = controlId
        ? document.getElementById(controlId)
        : section?.querySelector<HTMLElement>("textarea, input");
      control?.focus();
    });
  }
  function copy(index: number) {
    if (draft.document.blocks.length >= 64) return;
    const copied = duplicateBlock(draft.document.blocks[index]);
    const blocks = [...draft.document.blocks];
    blocks.splice(index + 1, 0, copied);
    change({ ...draft, document: { ...draft.document, blocks } });
    setAnnouncement(
      `Создана копия раздела «${copied.heading || "Без заголовка"}».`,
    );
    focusBlock(copied.id);
  }
  function removeItem(blockIndex: number, item: ProgramItem, index: number) {
    const block = draft.document.blocks[blockIndex];
    if (block.type !== "program") return;
    rememberDeleted({
      kind: "item",
      label: `Этап «${item.title || "Без названия"}»`,
      blockId: block.id,
      item: structuredClone(item),
      index,
    });
    blockChange(blockIndex, {
      ...block,
      items: block.items.filter((current) => current.id !== item.id),
    });
  }
  function add(
    type: "text" | "estimate" | "program",
    index = draft.document.blocks.length,
  ) {
    if (draft.document.blocks.length >= 64) return;
    const block = newEditorBlock(type);
    const blocks = [...draft.document.blocks];
    blocks.splice(index, 0, block);
    change({ ...draft, document: { ...draft.document, blocks } });
    focusBlock(block.id, firstBlockField(block));
  }
  function addLine(blockIndex: number, at = 200) {
    const block = draft.document.blocks[blockIndex];
    if (block.type !== "estimate" || block.lines.length >= 200) return;
    const id = crypto.randomUUID();
    const lines = [...block.lines];
    lines.splice(Math.min(at, lines.length), 0, {
      id,
      description: "",
      quantityThousandths: 1000,
      unitPriceMinor: null,
      included: true,
    });
    blockChange(blockIndex, { ...block, lines });
    requestAnimationFrame(() => document.getElementById(`line-${id}`)?.focus());
  }
  function download() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "eventcraft-draft.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const status = invalidFields.size
    ? "Проверьте поля"
    : {
        saved: "Сохранено",
        unsaved: "Есть изменения",
        saving: "Сохраняем…",
        error: "Не удалось сохранить",
        conflict: "Изменено в другой вкладке",
      }[view.status];
  const restored = deleted ? restoreDeleted(draft.document, deleted) : null;
  let moveDocument: DraftDocument | null = null;
  if (moved?.kind === "blocks") {
    const blocks = restoreOrder(draft.document.blocks, moved.ids);
    if (blocks) moveDocument = { ...draft.document, blocks };
  } else if (moved) {
    const target = draft.document.blocks.find(
      (block) => block.id === moved.blockId,
    );
    if (target?.type === "program" && moved.kind === "program") {
      const items = restoreOrder(target.items, moved.ids);
      if (items)
        moveDocument = {
          ...draft.document,
          blocks: draft.document.blocks.map((block) =>
            block.id === target.id ? { ...target, items } : block,
          ),
        };
    } else if (target?.type === "estimate" && moved.kind === "estimate") {
      const lines = restoreOrder(target.lines, moved.ids);
      if (lines)
        moveDocument = {
          ...draft.document,
          blocks: draft.document.blocks.map((block) =>
            block.id === target.id ? { ...target, lines } : block,
          ),
        };
    }
  }
  const outline = (
    <nav aria-label="Разделы предложения">
      {draft.document.blocks.map((block, index) => (
        <a
          key={block.id}
          href={`#block-${block.id}`}
          aria-current={activeBlock === block.id ? "location" : undefined}
          onClick={() => {
            setActiveBlock(block.id);
          }}
        >
          <span className="outline-block-icon">
            {block.type === "text" ? (
              <Type size={16} />
            ) : block.type === "program" ? (
              <Clock3 size={16} />
            ) : (
              <Calculator size={16} />
            )}
          </span>
          <div>
            <strong>{block.heading || "Без заголовка"}</strong>
            <small>
              {blockDescription(block)}
              {!block.visible && (
                <EyeOff size={12} aria-label="Скрыт от клиента" />
              )}
            </small>
          </div>
        </a>
      ))}
      {!draft.document.blocks.length && (
        <p className="outline-empty">Разделы появятся здесь</p>
      )}
    </nav>
  );
  return (
    <div
      className={`editor-layout editor-direct ${outlineOpen ? "" : "outline-collapsed"} ${reorder.dragging ? "is-reordering" : ""}`}
    >
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <header className="editor-header">
        <a
          className="back-link"
          href="/proposals"
          aria-label="Все предложения"
          title="Все предложения"
        >
          <ArrowLeft size={18} />
        </a>
        <span className="editor-brand">
          <Layers size={20} />
          EventCraft
        </span>
        <span className="header-divider" />
        <span className="editor-document-name">
          {draft.title || "Новое предложение"}
        </span>
        <span className={`save-status ${view.status}`} role="status">
          {view.status === "saved" && !invalidFields.size && (
            <Check size={14} aria-hidden="true" />
          )}
          {status}
        </span>
        <button
          className="button preview-trigger"
          disabled={!!invalidFields.size}
          title={
            invalidFields.size ? "Сначала исправьте числовые поля" : undefined
          }
          onClick={() => setPreview(true)}
        >
          <Eye size={16} aria-hidden="true" />
          Посмотреть
        </button>
      </header>
      <aside className="editor-outline">
        <div className="outline-top">
          <span>Содержание</span>
          <button
            className="icon-button"
            aria-label="Свернуть содержание"
            title="Свернуть содержание"
            onClick={() => setOutlineOpen(false)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="outline-desktop">{outline}</div>
        <EditorPopover label="Содержание" className="outline-mobile">
          {outline}
        </EditorPopover>
        <div className="add-section">
          <SectionPicker
            disabled={draft.document.blocks.length >= 64}
            onAdd={add}
          />
        </div>
      </aside>
      <main className="editor-canvas">
        {!outlineOpen && (
          <button
            className="icon-button outline-restore"
            aria-label="Открыть содержание"
            title="Открыть содержание"
            onClick={() => setOutlineOpen(true)}
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        {reorder.hint}
        {(view.status === "error" || view.status === "conflict") && (
          <div className="error-banner save-error" role="alert">
            <div>
              <strong>
                {view.status === "conflict"
                  ? "Сначала разберёмся с изменениями"
                  : "Правки остаются на этом экране"}
              </strong>
              <p>{errorMessage(view.error)}</p>
            </div>
            <div className="error-actions">
              <button className="button" onClick={download}>
                Скачать мои правки
              </button>
              {view.status === "conflict" ? (
                <button
                  className="button"
                  onClick={() => window.location.reload()}
                >
                  Открыть актуальное
                </button>
              ) : (
                <button className="button" onClick={() => saver.retry()}>
                  Повторить сохранение
                </button>
              )}
              {view.error instanceof ApiError && view.error.status === 401 && (
                <a
                  className="button"
                  href="/login"
                  target="_blank"
                  rel="noreferrer"
                >
                  Войти в новой вкладке
                </a>
              )}
            </div>
          </div>
        )}
        {!deleted && moveDocument && (
          <div className="undo-notice" role="status">
            <span>Порядок изменён</span>
            <button
              onClick={() => {
                change({ ...draft, document: moveDocument });
                setMoved(null);
              }}
            >
              Отменить перемещение
            </button>
            <button
              aria-label="Скрыть уведомление о перемещении"
              onClick={() => setMoved(null)}
            >
              Закрыть
            </button>
          </div>
        )}
        {deleted && (
          <div className="undo-notice" role="status">
            <span>Удалено: {deleted.label}</span>
            <button
              disabled={!restored}
              onClick={() => {
                if (!restored) return;
                change({ ...draft, document: restored });
                const id =
                  deleted.kind === "block" ? deleted.block.id : deleted.blockId;
                setDeleted(null);
                focusBlock(
                  id,
                  deleted.kind === "line"
                    ? `line-${deleted.line.id}`
                    : deleted.kind === "item"
                      ? `program-title-${deleted.item.id}`
                      : undefined,
                );
              }}
            >
              Восстановить
            </button>
            <button
              aria-label="Скрыть уведомление об удалении"
              onClick={() => setDeleted(null)}
            >
              Закрыть
            </button>
          </div>
        )}
        <article className="proposal-paper" ref={reorder.root}>
          <div className="document-kicker">Коммерческое предложение</div>
          <InlineHeading
            className="document-title"
            label="Название предложения"
            placeholder="Название предложения"
            value={draft.title}
            limit={180}
            onChange={(title) => change({ ...draft, title })}
          />
          {!draft.document.blocks.length && (
            <div className="document-empty">
              <h2>С чего начнём?</h2>
              <p>
                Добавьте идею события, программу или расчёт. Разделы можно
                переставить и дополнить позже.
              </p>
              <div>
                <button className="button" onClick={() => add("text")}>
                  Добавить идею
                </button>
                <button className="button" onClick={() => add("estimate")}>
                  Добавить расчёт
                </button>
                <button className="button" onClick={() => add("program")}>
                  Добавить программу
                </button>
              </div>
            </div>
          )}
          {draft.document.blocks.map((block, index) => (
            <section
              key={block.id}
              id={`block-${block.id}`}
              className={`document-block ${block.visible ? "" : "block-hidden"}`}
              {...reorder.itemProps(block.id)}
              onFocusCapture={() => setActiveBlock(block.id)}
            >
              <div className="block-toolbar">
                <ReorderHandle
                  label={`Переместить раздел ${block.heading || index + 1}`}
                  {...reorder.handleProps(block.id)}
                />

                {!block.visible && (
                  <span className="hidden-label" title="Скрыт от клиента">
                    <EyeOff size={14} />
                  </span>
                )}
                <EditorPopover
                  label={`Действия раздела ${block.heading || index + 1}`}
                  className="block-actions"
                  trigger={<MoreHorizontal size={18} aria-hidden="true" />}
                >
                  <p className="popover-heading">
                    {block.heading || "Без заголовка"}
                  </p>
                  <button
                    disabled={index === 0}
                    onClick={() => {
                      move(index, -1);
                      setAnnouncement("Раздел перемещён выше.");
                    }}
                  >
                    Переместить выше
                  </button>
                  <button
                    disabled={index === draft.document.blocks.length - 1}
                    onClick={() => {
                      move(index, 1);
                      setAnnouncement("Раздел перемещён ниже.");
                    }}
                  >
                    Переместить ниже
                  </button>
                  <button
                    disabled={
                      draft.document.blocks.length >= 64 || !!invalidFields.size
                    }
                    onClick={() => copy(index)}
                  >
                    Дублировать раздел
                  </button>
                  <button
                    onClick={() =>
                      blockChange(index, { ...block, visible: !block.visible })
                    }
                  >
                    {block.visible ? "Скрыть от клиента" : "Показать клиенту"}
                  </button>
                  <button
                    className="danger-action"
                    onClick={() => remove(index)}
                  >
                    Удалить раздел
                  </button>
                </EditorPopover>
              </div>
              <InlineHeading
                className="block-heading"
                label={`Заголовок раздела ${index + 1}`}
                value={block.heading}
                limit={160}
                onChange={(heading) =>
                  blockChange(index, { ...block, heading })
                }
              />
              {block.type === "text" ? (
                <AutoTextarea
                  id={`body-${block.id}`}
                  className="block-body"
                  aria-label={`Текст раздела ${index + 1}`}
                  value={block.body}
                  placeholder="Начните писать или введите /"
                  maxLength={20000}
                  rows={6}
                  onKeyDown={(event) => {
                    if (
                      event.key === "/" &&
                      !event.currentTarget.value &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      const section = event.currentTarget.closest("section");
                      const picker =
                        section?.querySelector<HTMLDetailsElement>(
                          ".section-picker",
                        );
                      if (picker) {
                        picker.open = true;
                        picker.querySelector("button")?.focus();
                      }
                    }
                  }}
                  onChange={(e) =>
                    blockChange(index, { ...block, body: e.target.value })
                  }
                />
              ) : block.type === "program" ? (
                <ProgramFields
                  items={block.items}
                  onChange={(items) => blockChange(index, { ...block, items })}
                  onReorder={(items) => {
                    setMoved({
                      kind: "program",
                      blockId: block.id,
                      ids: block.items.map((item) => item.id),
                    });
                    setDeleted(null);
                    blockChange(index, { ...block, items });
                  }}
                  onRemove={(item, itemIndex) =>
                    removeItem(index, item, itemIndex)
                  }
                />
              ) : (
                <>
                  <ReorderSurface
                    items={block.lines}
                    onChange={(lines) => {
                      setMoved({
                        kind: "estimate",
                        blockId: block.id,
                        ids: block.lines.map((line) => line.id),
                      });
                      setDeleted(null);
                      blockChange(index, { ...block, lines });
                    }}
                    label="Строки расчёта"
                    className="estimate-table"
                  >
                    {(rowReorder) => (
                      <>
                        <div className="estimate-labels">
                          <span>Включено / Услуга</span>
                          <span>Количество</span>
                          <span>Цена, ₽</span>
                          <span>Стоимость</span>
                          <span />
                        </div>
                        {block.lines.map((line, lineIndex) => {
                          const update = (patch: Partial<EstimateLine>) =>
                            blockChange(index, {
                              ...block,
                              lines: block.lines.map((l, i) =>
                                i === lineIndex ? { ...l, ...patch } : l,
                              ),
                            });
                          return (
                            <div
                              className={`estimate-row ${line.included ? "" : "excluded"}`}
                              key={line.id}
                              {...rowReorder.itemProps(line.id)}
                            >
                              <ReorderHandle
                                label={`Переместить услугу ${line.description || lineIndex + 1}`}
                                {...rowReorder.handleProps(line.id)}
                              />
                              <div className="line-description">
                                <input
                                  id={`line-${line.id}`}
                                  aria-label={`Услуга ${lineIndex + 1}`}
                                  value={line.description}
                                  maxLength={300}
                                  placeholder="Название услуги"
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
                                      document
                                        .getElementById(`quantity-${line.id}`)
                                        ?.focus();
                                    }
                                  }}
                                  onChange={(event) =>
                                    update({ description: event.target.value })
                                  }
                                />
                                <label
                                  className="line-inclusion"
                                  title="Включить услугу в итог"
                                >
                                  <input
                                    type="checkbox"
                                    checked={line.included}
                                    aria-label={`Включить строку ${lineIndex + 1} в расчёт`}
                                    onChange={(event) =>
                                      update({ included: event.target.checked })
                                    }
                                  />
                                  <span>
                                    {line.included
                                      ? "Включено в итог"
                                      : "Дополнительно"}
                                  </span>
                                </label>
                              </div>
                              <DecimalField
                                label={`Количество ${lineIndex + 1}`}
                                id={`quantity-${line.id}`}
                                onEnter={() =>
                                  document
                                    .getElementById(`price-${line.id}`)
                                    ?.focus()
                                }
                                value={line.quantityThousandths}
                                places={3}
                                maximum={100000000}
                                minimum={1}
                                onChange={(value) =>
                                  update({ quantityThousandths: value })
                                }
                                onInvalid={(value) =>
                                  invalid(
                                    `${block.id}:${line.id}:quantity`,
                                    value,
                                  )
                                }
                              />
                              <DecimalField
                                label={`Цена ${lineIndex + 1}`}
                                id={`price-${line.id}`}
                                onEnter={() => addLine(index, lineIndex + 1)}
                                value={line.unitPriceMinor}
                                places={2}
                                maximum={1000000000000}
                                onChange={(value) =>
                                  update({ unitPriceMinor: value })
                                }
                                onInvalid={(value) =>
                                  invalid(`${block.id}:${line.id}:price`, value)
                                }
                              />
                              <div className="estimate-line-total">
                                <span>Стоимость</span>
                                <strong>
                                  {invalidFields.has(
                                    `${block.id}:${line.id}:quantity`,
                                  ) ||
                                  invalidFields.has(
                                    `${block.id}:${line.id}:price`,
                                  )
                                    ? "Проверьте число"
                                    : line.quantityThousandths === null ||
                                        line.unitPriceMinor === null
                                      ? "Уточняется"
                                      : (() => {
                                          try {
                                            return rub.format(
                                              calculateEstimate([
                                                { ...line, included: true },
                                              ]).knownTotalMinor / 100,
                                            );
                                          } catch {
                                            return "Проверьте сумму";
                                          }
                                        })()}
                                </strong>
                              </div>
                              <button
                                className="icon-button estimate-remove"
                                aria-label={`Удалить строку ${lineIndex + 1}`}
                                onClick={() => {
                                  rememberDeleted({
                                    kind: "line",
                                    label: `Услуга «${line.description || "Без названия"}»`,
                                    blockId: block.id,
                                    line: structuredClone(line),
                                    index: lineIndex,
                                  });
                                  setInvalidFields(
                                    (prev) =>
                                      new Set(
                                        [...prev].filter(
                                          (key) =>
                                            !key.startsWith(
                                              `${block.id}:${line.id}:`,
                                            ),
                                        ),
                                      ),
                                  );
                                  blockChange(index, {
                                    ...block,
                                    lines: block.lines.filter(
                                      (_, i) => i !== lineIndex,
                                    ),
                                  });
                                }}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </ReorderSurface>
                  <button
                    className="button add-line"
                    disabled={block.lines.length >= 200}
                    onClick={() => addLine(index)}
                  >
                    <Plus size={15} aria-hidden="true" /> Услуга
                  </button>
                  {[...invalidFields].some((key) =>
                    key.startsWith(`${block.id}:`),
                  ) ? (
                    <p className="estimate-summary field-error" role="status">
                      Исправьте числовые поля, чтобы увидеть итог.
                    </p>
                  ) : (
                    <EstimateSummary lines={block.lines} />
                  )}
                </>
              )}
              <div className="section-insert">
                <SectionPicker
                  label="Добавить раздел здесь"
                  disabled={draft.document.blocks.length >= 64}
                  onAdd={(type) => {
                    if (
                      block.type === "text" &&
                      !block.body.trim() &&
                      (!block.heading.trim() || block.heading === "Идея")
                    ) {
                      const next =
                        type === "text"
                          ? block
                          : newEditorBlock(type, {
                              id: block.id,
                              visible: block.visible,
                            });
                      if (next !== block) blockChange(index, next);
                      focusBlock(block.id, firstBlockField(next));
                    } else add(type, index + 1);
                  }}
                />
              </div>
            </section>
          ))}
        </article>
        <p className="editor-bottom-note">
          Изменения сохраняются автоматически. Публикация будет отдельным
          действием.
        </p>
      </main>
      {preview && (
        <ProposalPreview draft={draft} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}
function EstimateSummary({ lines }: { lines: EstimateLine[] }) {
  try {
    const summary = calculateEstimate(lines);
    return (
      <div className="estimate-summary">
        <span>{summary.incomplete ? "Известная часть расчёта" : "Итого"}</span>
        <strong>
          {summary.includedCount
            ? rub.format(summary.knownTotalMinor / 100)
            : "—"}
        </strong>
        {summary.incomplete && (
          <small>Стоимость не всех услуг заполнена.</small>
        )}
      </div>
    );
  } catch {
    return (
      <p className="error" role="alert">
        Сумма превышает допустимый размер. Проверьте цены и количество.
      </p>
    );
  }
}
