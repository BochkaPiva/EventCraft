"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  projectClientSnapshot,
  calculateEstimate,
  type ClientSnapshot,
  type DraftDocument,
  type EstimateLine,
} from "@eventcraft/core";
import { formatDecimalInput } from "../lib/decimal-input.ts";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

function lineTotal(line: EstimateLine) {
  if (line.quantityThousandths === null || line.unitPriceMinor === null)
    return "Уточняется";
  try {
    // An optional line has a price of its own, without contributing to the block total.
    return rub.format(
      calculateEstimate([{ ...line, included: true }]).knownTotalMinor / 100,
    );
  } catch {
    return "Сумма требует проверки";
  }
}

export function ProposalPreview({
  draft,
  onClose,
}: {
  draft: { title: string; document: DraftDocument };
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  let snapshot: ClientSnapshot | undefined;
  let error = "";
  try {
    snapshot = projectClientSnapshot(draft, { name: "", accent: "#4f46e5" });
  } catch (cause) {
    error = !draft.title.trim()
      ? "Добавьте название предложения, чтобы проверить клиентский вид."
      : cause instanceof Error &&
          "code" in cause &&
          cause.code === "money_overflow"
        ? "Сумма превышает допустимый размер. Проверьте расчёт."
        : "Добавьте содержание хотя бы в один видимый раздел. Скрытые разделы в предпросмотр не попадают.";
  }
  return (
    <dialog
      ref={dialog}
      className="proposal-preview"
      aria-labelledby="preview-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="preview-header">
        <button className="button" onClick={onClose}>
          ← К редактированию
        </button>
        <div>
          <h2 id="preview-title">Предпросмотр черновика</h2>
          <p>Это черновик. Клиент его пока не видит.</p>
        </div>
        <div
          className="preview-display"
          role="group"
          aria-label="Размер предпросмотра"
        >
          <button aria-pressed={!phone} onClick={() => setPhone(false)}>
            Компьютер
          </button>
          <button aria-pressed={phone} onClick={() => setPhone(true)}>
            Телефон
          </button>
        </div>
      </header>
      <div className={`preview-content ${phone ? "preview-phone" : ""}`}>
        {snapshot ? (
          <ClientDocument snapshot={snapshot} />
        ) : (
          <div className="preview-empty">
            <h3>Пока нечего показать заказчику</h3>
            <p>{error}</p>
            <button className="button primary" onClick={onClose}>
              Продолжить редактирование
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

export function ClientDocument({ snapshot }: { snapshot: ClientSnapshot }) {
  return (
    <article className="client-document">
      <header className="client-document-header">
        <p>Коммерческое предложение</p>
        <h1>{snapshot.title}</h1>
      </header>
      {snapshot.blocks.map((block) => (
        <section key={block.id} className="client-document-section">
          {block.heading && <h2>{block.heading}</h2>}
          {block.type === "text" ? (
            <p className="client-document-text">{block.body}</p>
          ) : block.type === "program" ? (
            <ol className="client-program">
              {block.items.map((item) => (
                <li key={item.id}>
                  <span className="client-program-time">
                    {item.time ?? "Время уточняется"}
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <>
              <dl className="client-estimate-lines">
                {block.lines.map((line) => (
                  <div
                    key={line.id}
                    className={line.included ? "" : "client-line-extra"}
                  >
                    <dt>
                      {line.description}
                      <small>
                        {line.included
                          ? `${line.quantityThousandths === null ? "Количество уточняется" : formatDecimalInput(line.quantityThousandths, 3)}${line.unitPriceMinor === null ? " · цена уточняется" : ` × ${rub.format(line.unitPriceMinor / 100)}`}`
                          : "Дополнительно · не включено в итог"}
                      </small>
                    </dt>
                    <dd>{lineTotal(line)}</dd>
                  </div>
                ))}
              </dl>
              <div className="client-estimate-total">
                <span>
                  {block.summary.incomplete
                    ? "Известная часть стоимости"
                    : "Итого"}
                </span>
                <strong>
                  {block.summary.includedCount
                    ? rub.format(block.summary.knownTotalMinor / 100)
                    : "Уточняется"}
                </strong>
              </div>
              {block.summary.incomplete && (
                <p className="client-estimate-note">
                  Стоимость не всех включённых услуг определена.
                </p>
              )}
            </>
          )}
        </section>
      ))}
    </article>
  );
}
