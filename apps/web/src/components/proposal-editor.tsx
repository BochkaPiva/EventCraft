"use client";
import { useEffect, useRef, useState } from "react";
import {
  calculateEstimate,
  draftDocumentSchema,
  type DraftDocument,
  type EstimateLine,
} from "@eventcraft/core";
import { api, ApiError, errorMessage } from "../lib/client-api.ts";
import {
  DraftSaver,
  type WorkingDraft,
  type SaveView,
} from "../lib/draft-saver.ts";
import { parseDecimalInput, formatDecimalInput } from "../lib/decimal-input.ts";
import { InlineHeading } from "./inline-heading.tsx";

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
}: {
  value: number | null;
  places: number;
  maximum: number;
  minimum?: number;
  label: string;
  onChange: (value: number | null) => void;
  onInvalid: (invalid: boolean) => void;
}) {
  const [raw, setRaw] = useState(() => formatDecimalInput(value, places)),
    [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setRaw(formatDecimalInput(value, places));
  }, [value, places]);
  return (
    <div>
      <input
        className="decimal-field"
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
    </div>
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
  const [deleted, setDeleted] = useState<{
    block: Block;
    index: number;
  } | null>(null);
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
    const blocks = [...draft.document.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    change({ ...draft, document: { ...draft.document, blocks } });
  }
  function remove(index: number) {
    const removed = draft.document.blocks[index];
    setDeleted({ block: structuredClone(removed), index });
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
  function add(type: "text" | "estimate") {
    const block: Block =
      type === "text"
        ? {
            id: crypto.randomUUID(),
            type,
            heading: "Идея",
            body: "",
            visible: true,
          }
        : {
            id: crypto.randomUUID(),
            type,
            heading: "Расчёт",
            lines: [],
            visible: true,
          };
    change({
      ...draft,
      document: {
        ...draft.document,
        blocks: [...draft.document.blocks, block],
      },
    });
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
  return (
    <div className="editor-layout">
      <header className="editor-header">
        <a className="back-link" href="/proposals">
          ← Предложения
        </a>
        <span className="editor-document-name">
          {draft.title || "Новое предложение"}
        </span>
        <span className={`save-status ${view.status}`} role="status">
          {status}
        </span>
      </header>
      <aside className="editor-outline">
        <p className="outline-heading">Содержание</p>
        <nav aria-label="Разделы предложения">
          {draft.document.blocks.map((block, index) => (
            <a key={block.id} href={`#block-${block.id}`}>
              <span>{index + 1}</span>
              {block.heading || "Без заголовка"}
              {!block.visible && <small>Скрыт</small>}
            </a>
          ))}
        </nav>
        <div className="add-section">
          <span>Добавить раздел</span>
          <button
            className="button"
            onClick={() => add("text")}
            disabled={draft.document.blocks.length >= 64}
          >
            + Текст
          </button>
          <button
            className="button"
            onClick={() => add("estimate")}
            disabled={draft.document.blocks.length >= 64}
          >
            + Расчёт
          </button>
        </div>
        <p className="outline-note">
          Это приватный черновик.
          <br />
          Клиент его пока не видит.
        </p>
      </aside>
      <main className="editor-canvas">
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
        {deleted && (
          <div className="undo-notice" role="status">
            Раздел удалён.
            <button
              disabled={draft.document.blocks.length >= 64}
              onClick={() => {
                const blocks = [...draft.document.blocks];
                blocks.splice(
                  Math.min(deleted.index, blocks.length),
                  0,
                  deleted.block,
                );
                change({ ...draft, document: { ...draft.document, blocks } });
                setDeleted(null);
              }}
            >
              Отменить удаление
            </button>
          </div>
        )}
        <article className="proposal-paper">
          <div className="document-kicker">Предложение для вашего события</div>
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
                Расскажите идею события или добавьте расчёт. Остальное можно
                собрать по ходу.
              </p>
              <div>
                <button className="button" onClick={() => add("text")}>
                  Добавить идею
                </button>
                <button className="button" onClick={() => add("estimate")}>
                  Добавить расчёт
                </button>
              </div>
            </div>
          )}
          {draft.document.blocks.map((block, index) => (
            <section
              key={block.id}
              id={`block-${block.id}`}
              className={`document-block ${block.visible ? "" : "block-hidden"}`}
            >
              <div className="block-toolbar">
                <span>
                  {block.type === "text" ? "Текстовый раздел" : "Расчёт"}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label={`Поднять раздел ${block.heading}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Опустить раздел ${block.heading}`}
                    disabled={index === draft.document.blocks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      blockChange(index, { ...block, visible: !block.visible })
                    }
                  >
                    {block.visible ? "Скрыть" : "Показать"}
                  </button>
                  <button className="text-button" onClick={() => remove(index)}>
                    Удалить
                  </button>
                </div>
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
                <textarea
                  className="block-body"
                  aria-label={`Текст раздела ${index + 1}`}
                  value={block.body}
                  placeholder="Напишите, что предлагаете клиенту…"
                  maxLength={20000}
                  rows={6}
                  onChange={(e) =>
                    blockChange(index, { ...block, body: e.target.value })
                  }
                />
              ) : (
                <>
                  <div
                    className="estimate-table"
                    role="group"
                    aria-label="Строки расчёта"
                  >
                    <div className="estimate-labels">
                      <span>Включено / Услуга</span>
                      <span>Количество</span>
                      <span>Цена, ₽</span>
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
                        >
                          <label className="line-description">
                            <input
                              type="checkbox"
                              checked={line.included}
                              aria-label={`Включить строку ${lineIndex + 1} в расчёт`}
                              onChange={(e) =>
                                update({ included: e.target.checked })
                              }
                            />
                            <input
                              aria-label={`Услуга ${lineIndex + 1}`}
                              value={line.description}
                              maxLength={300}
                              placeholder="Название услуги"
                              onChange={(e) =>
                                update({ description: e.target.value })
                              }
                            />
                          </label>
                          <DecimalField
                            label={`Количество ${lineIndex + 1}`}
                            value={line.quantityThousandths}
                            places={3}
                            maximum={100000000}
                            minimum={1}
                            onChange={(value) =>
                              update({ quantityThousandths: value })
                            }
                            onInvalid={(value) =>
                              invalid(`${block.id}:${line.id}:quantity`, value)
                            }
                          />
                          <DecimalField
                            label={`Цена ${lineIndex + 1}`}
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
                          <button
                            className="icon-button"
                            aria-label={`Удалить строку ${lineIndex + 1}`}
                            onClick={() => {
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
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="text-button add-line"
                    disabled={block.lines.length >= 200}
                    onClick={() =>
                      blockChange(index, {
                        ...block,
                        lines: [
                          ...block.lines,
                          {
                            id: crypto.randomUUID(),
                            description: "",
                            quantityThousandths: 1000,
                            unitPriceMinor: null,
                            included: true,
                          },
                        ],
                      })
                    }
                  >
                    + Добавить услугу
                  </button>
                  <EstimateSummary lines={block.lines} />
                </>
              )}
            </section>
          ))}
        </article>
        <p className="editor-bottom-note">
          Изменения сохраняются автоматически. Публикация будет отдельным
          действием.
        </p>
      </main>
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
