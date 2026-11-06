import React, { useState, useRef, lazy, Suspense } from "react";
import {
  ArrowLeft,
  Plus,
  Check,
  Eye,
  Share2,
  Undo2,
  PanelRight,
  MessageSquare,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  ImagePlus,
  Copy,
  ExternalLink,
  MapPin,
  Armchair,
  LayoutTemplate,
  FileText,
  CalendarDays,
  Users,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button, Modal, Field, Empty, Fullscreen } from "./ui.jsx";
import {
  uid,
  clone,
  money,
  total,
  createProposal,
  publicationIssues,
  publicDocument,
} from "./model.js";
import { createDefaultScene, seatCount } from "./sceneModel.js";
const SpatialEditor = lazy(() => import("./SpatialEditor.jsx"));
import LibraryView from "./LibraryView.jsx";
import ProposalDocument from "./ProposalDocument.jsx";
const names = {
  cover: "Обложка",
  idea: "Идея",
  program: "Программа",
  venue: "Площадка",
  team: "Команда события",
  estimate: "Расчёт",
};
const icons = {
  cover: ImagePlus,
  idea: FileText,
  program: CalendarDays,
  venue: MapPin,
  team: Users,
  estimate: FileText,
};
const go = (path) => {
  location.hash = path;
};
export default function Editor({
  proposal: p,
  storageError,
  agency,
  requests,
  initialRequest,
  onChange,
  onRequestChange,
  onPublish,
  notify,
}) {
  const [active, setActive] = useState("cover"),
    [panel, setPanel] = useState(initialRequest ? "requests" : null),
    [requestId, setRequestId] = useState(initialRequest || requests[0]?.id),
    [share, setShare] = useState(false),
    [preview, setPreview] = useState(false),
    [phone, setPhone] = useState(false),
    [spatial, setSpatial] = useState(false),
    [library, setLibrary] = useState(false),
    [templates, setTemplates] = useState(false),
    [add, setAdd] = useState(false),
    [uploading, setUploading] = useState(false),
    [reply, setReply] = useState(() =>
      Object.fromEntries(
        requests
          .filter((r) => r.managerDraft)
          .map((r) => [r.id, r.managerDraft]),
      ),
    );
  const spatialStart = useRef(0),
    lastGroup = useRef(null);
  const openSpatial = () => {
    spatialStart.current = history.current.length;
    setSpatial(true);
  };
  const history = useRef([]),
    lastEdit = useRef(0),
    [undoCount, setUndoCount] = useState(0),
    [copied, setCopied] = useState(false),
    [copyFailed, setCopyFailed] = useState(false);
  const imageInput = useRef();
  const latest = p.releases.at(-1);
  const dirty =
    latest &&
    (latest.revision !== p.revision ||
      ["name", "accent", "logo", "email", "phone"].some(
        (k) => (latest.document.brand[k] || "") !== (agency[k] || ""),
      ));
  const issues = publicationIssues(p);
  const sum = total(p);
  const req = requests.find((r) => r.id === requestId) || requests[0];
  function edit(update, group = false) {
    const now = Date.now();
    const groupId = group
      ? document.activeElement?.getAttribute("aria-label")
      : null;
    if (
      !group ||
      now - lastEdit.current > 900 ||
      groupId !== lastGroup.current
    ) {
      history.current.push(clone(p));
      if (history.current.length > 40) history.current.shift();
      setUndoCount(history.current.length);
    }
    lastEdit.current = now;
    lastGroup.current = groupId;
    onChange((prev) => ({
      ...(typeof update === "function" ? update(prev) : { ...prev, ...update }),
      revision: prev.revision + 1,
      touched: true,
      updatedAt: now,
    }));
  }
  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    onChange((current) => ({
      ...prev,
      releases: current.releases,
      revision: current.revision + 1,
      updatedAt: Date.now(),
      touched: true,
    }));
    setUndoCount(history.current.length);
    notify("Последнее действие отменено");
  }
  const text = (key, value) => edit({ [key]: value }, true);
  function selectSection(s) {
    setActive(s);
    document
      .getElementById(`edit-${s}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function addSection(s) {
    edit({ ...p, sections: [...p.sections, s] });
    setAdd(false);
    setTimeout(() => selectSection(s), 80);
  }
  function move(s, dir) {
    const arr = [...p.sections],
      i = arr.indexOf(s),
      j = i + dir;
    if (j < 1 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    edit({ sections: arr });
  }
  function applyTemplate(kind) {
    const t = createProposal(kind);
    if (!p.touched) {
      edit({ ...t, id: p.id, releases: p.releases });
    } else {
      edit({
        sections: [...new Set([...p.sections, ...t.sections])],
        intro: p.intro || t.intro,
        program: p.program.length ? p.program : t.program,
        estimate: p.estimate.length ? p.estimate : t.estimate,
        image: p.image || t.image,
      });
    }
    setTemplates(false);
    setLibrary(false);
    notify("Заготовка добавлена. Ваш текст и название сохранены");
  }
  function chooseVenue(v) {
    edit({
      venue: v,
      scene:
        p.venue?.id === v.id
          ? p.scene
          : v.hasScene
            ? createDefaultScene()
            : null,
      sections: p.sections.includes("venue")
        ? p.sections
        : [...p.sections, "venue"],
    });
    setLibrary(false);
    setTimeout(() => selectSection("venue"), 60);
  }
  async function upload(file) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1500000
    ) {
      notify("Выберите JPG, PNG или WebP до 1,5 МБ");
      return;
    }
    setUploading(true);
    try {
      const result = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      edit({ image: result });
      notify("Фотография добавлена");
    } catch {
      notify("Не удалось прочитать фотографию. Попробуйте другой файл");
    } finally {
      setUploading(false);
    }
  }
  const currentLink = latest
    ? `${location.origin}${location.pathname}#/client/${p.id}?release=${latest.id}`
    : "";
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentLink);
      setCopied(true);
      setCopyFailed(false);
      notify("Ссылка скопирована. Передайте её клиенту отдельно");
    } catch {
      setCopyFailed(true);
    }
  }
  const sectionTools = (s) =>
    s !== "cover" && (
      <div className="section-tools">
        <button
          className="icon-button"
          aria-label={`Выше: ${names[s]}`}
          disabled={p.sections.indexOf(s) === 1}
          onClick={() => move(s, -1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="icon-button"
          aria-label={`Ниже: ${names[s]}`}
          disabled={p.sections.at(-1) === s}
          onClick={() => move(s, 1)}
        >
          <ArrowDown size={14} />
        </button>
        <button
          className="icon-button"
          aria-label={`Убрать раздел: ${names[s]}`}
          onClick={() => {
            edit({ sections: p.sections.filter((v) => v !== s) });
            notify(
              "Раздел убран. Его содержимое сохранено, действие можно отменить",
            );
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <a className="back-link" href="#/proposals">
          <ArrowLeft size={17} />
          <span>Предложения</span>
        </a>
        <span className="topbar-divider" />
        <div className="editor-file">
          <strong>{p.title || "Новое предложение"}</strong>
          <span>
            <Check size={12} />
            {storageError
              ? "Сохранение не удалось"
              : uploading
                ? "Загружаем фото…"
                : "Сохранено в этом браузере"}
          </span>
        </div>
        <div className="editor-top-actions">
          <button
            className="icon-button"
            aria-label="Отменить последнее действие"
            disabled={!undoCount}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <Button
            variant="secondary"
            aria-label="Предпросмотр черновика"
            onClick={() => setPreview(true)}
          >
            <Eye size={16} />
            <span>Предпросмотр черновика</span>
          </Button>
          <Button
            onClick={() => {
              setCopied(false);
              setShare(true);
            }}
          >
            <Share2 size={16} />
            Поделиться
          </Button>
        </div>
      </header>
      <div className={`editor-workspace ${panel ? "with-panel" : ""}`}>
        <aside className="editor-outline">
          <div className="outline-heading">
            <span>Содержание</span>
            <button
              className="icon-button"
              aria-label="Добавить раздел"
              onClick={() => setAdd(true)}
            >
              <Plus size={16} />
            </button>
          </div>
          <nav aria-label="Разделы предложения">
            {p.sections.map((s, i) => {
              const Icon = icons[s];
              return (
                <button
                  key={s}
                  className={active === s ? "active" : ""}
                  onClick={() => selectSection(s)}
                >
                  <span className="outline-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon size={15} />
                  {names[s]}
                </button>
              );
            })}
          </nav>
          <button className="outline-add" onClick={() => setAdd(true)}>
            <Plus size={15} />
            Добавить раздел
          </button>
          <div className="outline-bottom">
            <button onClick={() => setTemplates(true)}>
              <LayoutTemplate size={16} />
              Заготовки
            </button>
            <button
              className={panel === "params" ? "active" : ""}
              onClick={() => setPanel(panel === "params" ? null : "params")}
            >
              <PanelRight size={16} />
              Параметры КП
            </button>
            <button
              className={panel === "requests" ? "active" : ""}
              onClick={() => setPanel(panel === "requests" ? null : "requests")}
            >
              <MessageSquare size={16} />
              Пожелания
              {requests.length > 0 && (
                <span className="count">{requests.length}</span>
              )}
            </button>
            <div className="release-state">
              {latest ? (
                <>
                  <span className="status-dot" />
                  Клиент видит версию {latest.number}
                  <small>
                    {dirty
                      ? "Новые изменения пока только у вас"
                      : "Опубликованная версия актуальна"}
                  </small>
                </>
              ) : (
                <>
                  Черновик<small>Клиент пока не видит это КП</small>
                </>
              )}
            </div>
          </div>
        </aside>
        <main className="editor-canvas">
          <div className="document-topline">
            <span>{agency.name}</span>
            <span>Черновик предложения</span>
          </div>
          <div className="editable-document">
            {!p.touched && (
              <div className="starter-hint">
                <span>
                  Начните прямо здесь: название, свой текст и фотографии.
                </span>
                <button onClick={() => setTemplates(true)}>
                  Или взять заготовку <ChevronRight size={14} />
                </button>
              </div>
            )}
            {p.sections.map((s) => (
              <section
                className={`edit-section section-${s} ${active === s ? "focused" : ""}`}
                id={`edit-${s}`}
                key={s}
                onFocus={() => setActive(s)}
              >
                <div className="section-label">
                  <span>{names[s]}</span>
                  {sectionTools(s)}
                </div>
                {s === "cover" && (
                  <>
                    <input
                      className="inline-title"
                      aria-label="Название предложения"
                      placeholder="Как назовём событие?"
                      value={p.title}
                      onChange={(e) => text("title", e.target.value)}
                      maxLength={180}
                    />
                    <input
                      className="inline-subtitle"
                      aria-label="Заказчик"
                      placeholder="Для кого готовим предложение"
                      value={p.client}
                      onChange={(e) => text("client", e.target.value)}
                    />
                    <div className="editor-event-facts">
                      <label>
                        <CalendarDays size={16} />
                        <span className="sr-only">Дата события</span>
                        <input
                          aria-label="Дата события"
                          type="date"
                          value={p.date}
                          onChange={(e) => edit({ date: e.target.value })}
                        />
                      </label>
                      <label>
                        <Users size={16} />
                        <input
                          aria-label="Количество гостей"
                          type="number"
                          min="1"
                          max="100000"
                          placeholder="Число гостей"
                          value={p.guests ?? ""}
                          onChange={(e) =>
                            text(
                              "guests",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span>гостей</span>
                      </label>
                    </div>
                    {p.image ? (
                      <div className="editable-cover">
                        <img src={p.image} alt="Обложка предложения" />
                        <button
                          className="button secondary"
                          onClick={() => imageInput.current.click()}
                        >
                          <ImagePlus size={15} />
                          Заменить фото
                        </button>
                      </div>
                    ) : (
                      <button
                        className="photo-placeholder"
                        onClick={() => imageInput.current.click()}
                      >
                        <ImagePlus size={26} />
                        <strong>Добавить атмосферу</strong>
                        <span>
                          Своя фотография · JPG, PNG или WebP до 1,5 МБ
                        </span>
                      </button>
                    )}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      ref={imageInput}
                      aria-label="Загрузить обложку"
                      onChange={(e) => {
                        upload(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
                {s === "idea" && (
                  <>
                    <h2>В чём идея?</h2>
                    <textarea
                      className="inline-text idea-text"
                      aria-label="Идея мероприятия"
                      placeholder="Расскажите, что сделает это событие особенным. Можно вставить готовый текст из презентации."
                      value={p.intro}
                      onChange={(e) => text("intro", e.target.value)}
                    />
                    <span className="fine-note">
                      Абзацы и переносы сохраняются в клиентской версии.
                    </span>
                  </>
                )}
                {s === "program" && (
                  <>
                    <h2>Как пройдёт событие</h2>
                    <div className="program-editor">
                      {p.program.map((r, i) => (
                        <div className="program-row" key={r.id}>
                          <input
                            type="time"
                            aria-label={`Время пункта ${i + 1}`}
                            value={r.time}
                            onChange={(e) =>
                              edit({
                                program: p.program.map((v) =>
                                  v.id === r.id
                                    ? { ...v, time: e.target.value }
                                    : v,
                                ),
                              })
                            }
                          />
                          <div>
                            <input
                              className="inline-row-title"
                              aria-label={`Название пункта ${i + 1}`}
                              placeholder="Что произойдёт"
                              value={r.title}
                              onChange={(e) =>
                                edit(
                                  {
                                    program: p.program.map((v) =>
                                      v.id === r.id
                                        ? { ...v, title: e.target.value }
                                        : v,
                                    ),
                                  },
                                  true,
                                )
                              }
                            />
                            <input
                              className="inline-row-detail"
                              aria-label={`Описание пункта ${i + 1}`}
                              placeholder="Коротко о деталях"
                              value={r.description}
                              onChange={(e) =>
                                edit(
                                  {
                                    program: p.program.map((v) =>
                                      v.id === r.id
                                        ? { ...v, description: e.target.value }
                                        : v,
                                    ),
                                  },
                                  true,
                                )
                              }
                            />
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`Убрать пункт ${i + 1}`}
                            onClick={() =>
                              edit({
                                program: p.program.filter((v) => v.id !== r.id),
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        edit({
                          program: [
                            ...p.program,
                            { id: uid(), time: "", title: "", description: "" },
                          ],
                        })
                      }
                    >
                      <Plus size={15} />
                      Добавить пункт программы
                    </Button>
                  </>
                )}
                {s === "venue" && (
                  <>
                    <h2>{p.venue?.name || "Где встретимся?"}</h2>
                    {p.venue ? (
                      <>
                        <div className="editor-venue">
                          <img
                            src={p.venue.image || "/images/venue.jpg"}
                            alt="Площадка"
                          />
                          <div>
                            <span className="eyebrow">
                              {p.venue.city || "Место уточняется"}
                            </span>
                            <strong>{p.venue.name}</strong>
                            <p>{p.venue.description}</p>
                            <div className="button-row">
                              {p.scene && (
                                <Button onClick={openSpatial}>
                                  <Armchair size={16} />
                                  Расстановка · {seatCount(p.scene)} мест
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                onClick={() => setLibrary(true)}
                              >
                                Заменить
                              </Button>
                            </div>
                          </div>
                        </div>
                        {p.scene && (
                          <p className="fine-note">
                            Учебный зал. Расстановка не бронирует мебель и
                            площадку.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="venue-empty">
                        <MapPin size={24} />
                        <p>
                          Выберите место из библиотеки или пока оставьте его
                          открытым.
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => setLibrary(true)}
                        >
                          Выбрать площадку
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {s === "team" && (
                  <>
                    <h2>Кто создаёт событие</h2>
                    <textarea
                      className="inline-text"
                      aria-label="Команда события"
                      value={p.teamText}
                      placeholder="Команда, ведущий, фотограф — расскажите о людях и их ролях."
                      onChange={(e) => text("teamText", e.target.value)}
                    />
                  </>
                )}
                {s === "estimate" && (
                  <>
                    <h2>Что входит в предложение</h2>
                    <div className="estimate-editor">
                      <div className="estimate-head">
                        <span>Позиция</span>
                        <span>Кол-во</span>
                        <span>Цена, ₽</span>
                        <span>Сумма</span>
                        <span />
                      </div>
                      {p.estimate.map((r, i) => (
                        <div
                          className={`estimate-row ${r.included === false ? "excluded" : ""}`}
                          key={r.id}
                        >
                          <div>
                            <input
                              aria-label={`Позиция ${i + 1}`}
                              placeholder="Услуга или работа"
                              value={r.name}
                              onChange={(e) =>
                                edit(
                                  {
                                    estimate: p.estimate.map((v) =>
                                      v.id === r.id
                                        ? { ...v, name: e.target.value }
                                        : v,
                                    ),
                                  },
                                  true,
                                )
                              }
                            />
                            <label className="include-check">
                              <input
                                type="checkbox"
                                checked={r.included !== false}
                                onChange={(e) =>
                                  edit({
                                    estimate: p.estimate.map((v) =>
                                      v.id === r.id
                                        ? { ...v, included: e.target.checked }
                                        : v,
                                    ),
                                  })
                                }
                              />
                              Включено в итог
                            </label>
                          </div>
                          <input
                            aria-label={`Количество позиции ${i + 1}`}
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="Уточним"
                            value={r.quantity ?? ""}
                            onChange={(e) =>
                              edit(
                                {
                                  estimate: p.estimate.map((v) =>
                                    v.id === r.id
                                      ? {
                                          ...v,
                                          quantity:
                                            e.target.value === ""
                                              ? null
                                              : Number(e.target.value),
                                        }
                                      : v,
                                  ),
                                },
                                true,
                              )
                            }
                          />
                          <input
                            aria-label={`Цена позиции ${i + 1}`}
                            type="number"
                            min="0"
                            placeholder="Уточним"
                            value={r.price ?? ""}
                            onChange={(e) =>
                              edit(
                                {
                                  estimate: p.estimate.map((v) =>
                                    v.id === r.id
                                      ? {
                                          ...v,
                                          price:
                                            e.target.value === ""
                                              ? null
                                              : Number(e.target.value),
                                        }
                                      : v,
                                  ),
                                },
                                true,
                              )
                            }
                          />
                          <span>
                            {r.quantity === null || r.price === null
                              ? "Уточним"
                              : money(r.quantity * r.price)}
                          </span>
                          <button
                            className="icon-button"
                            aria-label={`Убрать позицию ${i + 1}`}
                            onClick={() =>
                              edit({
                                estimate: p.estimate.filter(
                                  (v) => v.id !== r.id,
                                ),
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        edit({
                          estimate: [
                            ...p.estimate,
                            {
                              id: uid(),
                              name: "",
                              quantity: 1,
                              price: null,
                              included: true,
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={15} />
                      Добавить позицию
                    </Button>
                    <div className="estimate-summary">
                      <span>
                        {sum.partial
                          ? "Известная часть"
                          : "Стоимость предложения"}
                        <small>
                          {sum.partial
                            ? "Не все цены определены"
                            : "По включённым позициям"}
                        </small>
                      </span>
                      <strong>
                        {sum.count ? money(sum.amount) : "Пока без расчёта"}
                      </strong>
                    </div>
                  </>
                )}
              </section>
            ))}
            <button className="add-section-bottom" onClick={() => setAdd(true)}>
              <Plus size={17} />
              Добавить раздел
            </button>
          </div>
          <div className="canvas-bottom-note">
            Редактируйте прямо на странице. Всё сохраняется в этом браузере.
          </div>
        </main>
        {panel && (
          <aside className="editor-task-panel">
            <header>
              <h2>
                {panel === "params" ? "Параметры КП" : "Пожелания клиента"}
              </h2>
              <button
                className="icon-button"
                aria-label="Закрыть панель"
                onClick={() => setPanel(null)}
              >
                <X size={17} />
              </button>
            </header>
            {panel === "params" ? (
              <div className="task-panel-body">
                <span className="eyebrow">Клиентские возможности</span>
                <p>
                  Клиент видит только опубликованную версию. Его изменения
                  приходят отдельно.
                </p>
                <label className="check-setting">
                  <input
                    type="checkbox"
                    checked={p.permissions.questions}
                    onChange={(e) =>
                      edit({
                        permissions: {
                          ...p.permissions,
                          questions: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    Вопросы и пожелания
                    <small>Написать по содержанию предложения</small>
                  </span>
                </label>
                <label className="check-setting">
                  <input
                    type="checkbox"
                    disabled={!p.scene}
                    checked={p.permissions.layout && !!p.scene}
                    onChange={(e) =>
                      edit({
                        permissions: {
                          ...p.permissions,
                          layout: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    Своя расстановка
                    <small>
                      {p.scene
                        ? "Попробовать вариант, не меняя ваш"
                        : "Сначала добавьте зал с расстановкой"}
                    </small>
                  </span>
                </label>
                <hr />
                <span className="eyebrow">Оформление</span>
                <div className="brand-summary">
                  <span style={{ background: agency.accent }} />
                  <strong>{agency.name}</strong>
                </div>
                <p>
                  Логотип, цвет и контакты берутся из бренда агентства при
                  публикации.
                </p>
                <a className="text-button" href="#/settings">
                  Настроить бренд <ChevronRight size={14} />
                </a>
                <hr />
                <p className="fine-note">
                  В прототипе совместная работа проверяется на одном устройстве.
                  Авторизация и серверное хранение ещё не подключены.
                </p>
              </div>
            ) : (
              <div className="task-panel-body">
                {!requests.length ? (
                  <Empty icon={MessageSquare} title="Здесь начнётся диалог">
                    Опубликуйте КП и откройте клиентскую ссылку, чтобы отправить
                    пробное пожелание.
                  </Empty>
                ) : (
                  <>
                    <div className="request-selector">
                      {requests.map((r) => (
                        <button
                          key={r.id}
                          className={req?.id === r.id ? "active" : ""}
                          onClick={() => setRequestId(r.id)}
                        >
                          <span className="avatar">{r.author.slice(0, 1)}</span>
                          <span>
                            <strong>{r.author}</strong>
                            <span className="request-excerpt">
                              {names[r.section] || "Предложение"} · {r.text}
                            </span>
                            <small>
                              {r.status === "included"
                                ? "В опубликованной версии"
                                : r.status === "prepared"
                                  ? "Подготовлено в черновике"
                                  : r.status === "answered"
                                    ? "Ответ отправлен"
                                    : "Ждёт рассмотрения"}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                    {req && (
                      <div className="request-detail">
                        <div className="request-context">
                          Клиентская версия{" "}
                          {p.releases.find((v) => v.id === req.releaseId)
                            ?.number || "—"}{" "}
                          · {names[req.section] || "Предложение"}
                        </div>
                        <p>{req.text}</p>
                        {req.scene ? (
                          <>
                            <div className="request-layout">
                              <Armchair size={20} />
                              <span>
                                Вариант клиента
                                <br />
                                <strong>
                                  {seatCount(req.scene)} посадочных мест
                                </strong>
                              </span>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                edit({ scene: clone(req.scene) });
                                onRequestChange(req.id, {
                                  status: "prepared",
                                  preparedRevision: p.revision + 1,
                                });
                                notify("Вариант применён только в черновике");
                              }}
                            >
                              Применить в черновик
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => selectSection(req.section || "idea")}
                          >
                            Перейти к разделу
                          </Button>
                        )}
                        <label className="field">
                          <span>Ваш ответ</span>
                          <textarea
                            value={reply[req.id] ?? ""}
                            placeholder="Напишите, что предлагаете…"
                            onChange={(e) => {
                              setReply({ ...reply, [req.id]: e.target.value });
                              onRequestChange(req.id, {
                                managerDraft: e.target.value,
                              });
                            }}
                          />
                        </label>
                        <Button
                          disabled={!(reply[req.id] || "").trim()}
                          onClick={() => {
                            onRequestChange(req.id, {
                              reply: reply[req.id].trim(),
                              managerDraft: "",
                              status:
                                req.status === "open" ? "answered" : req.status,
                            });
                            setReply({ ...reply, [req.id]: "" });
                            notify("Ответ отправлен в клиентскую версию");
                          }}
                        >
                          Отправить ответ
                        </Button>
                        {req.reply && (
                          <div className="sent-reply">
                            <CheckCircle2 size={15} />
                            <span>Отправлено: {req.reply}</span>
                          </div>
                        )}
                        {req.status !== "included" && (
                          <button
                            className="text-button"
                            onClick={() =>
                              onRequestChange(req.id, {
                                status:
                                  latest && !dirty ? "included" : "prepared",
                                preparedRevision: p.revision,
                                ...(latest && !dirty
                                  ? { includedRelease: latest.number }
                                  : {}),
                              })
                            }
                          >
                            {latest && !dirty
                              ? `Подтвердить: учтено в клиентской версии ${latest.number}`
                              : "Проверил: учтено в текущем черновике"}
                          </button>
                        )}
                        {req.status === "prepared" && (
                          <div className="inline-notice">
                            {req.preparedRevision === p.revision
                              ? "Пока только у вас. Опубликуйте обновление, чтобы клиент увидел изменения."
                              : "Черновик изменился после вашей отметки. Проверьте результат и снова отметьте готовность изменений."}
                          </div>
                        )}
                        {req.status === "included" && (
                          <div className="inline-notice">
                            Учтено в клиентской версии {req.includedRelease}.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
      <Modal
        open={add}
        onClose={() => setAdd(false)}
        title="Добавить раздел"
        description="Выберите нужное. Порядок разделов можно менять."
      >
        <div className="section-picker">
          {Object.keys(names)
            .filter((s) => !p.sections.includes(s))
            .map((s) => {
              const Icon = icons[s];
              return (
                <button key={s} onClick={() => addSection(s)}>
                  <Icon size={20} />
                  <span>
                    <strong>{names[s]}</strong>
                    <small>
                      {s === "venue"
                        ? "Площадка и расстановка"
                        : s === "team"
                          ? "Люди и роли"
                          : "Содержание предложения"}
                    </small>
                  </span>
                  <Plus size={16} />
                </button>
              );
            })}
          {p.sections.length === 6 && (
            <p className="muted">Все доступные разделы уже в документе.</p>
          )}
        </div>
      </Modal>
      <Modal
        open={templates}
        onClose={() => setTemplates(false)}
        title="Готовая основа для вашей идеи"
        description="Если вы уже начали, заготовка заполнит только пустые разделы и сохранит ваш текст."
      >
        <div className="template-choices">
          {[
            ["team", "Командный день", "/images/team.jpg"],
            ["conference", "Конференция", "/images/venue.jpg"],
            ["evening", "Вечер для команды", "/images/evening.jpg"],
          ].map(([id, title, img]) => (
            <button key={id} onClick={() => applyTemplate(id)}>
              <img src={img} alt="" />
              <span>
                <strong>{title}</strong>
                <small>Идея, программа и расчёт</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={library}
        onClose={() => setLibrary(false)}
        title="Выберите площадку"
        description={
          p.scene
            ? "При выборе другой площадки расстановка будет заменена. Её можно вернуть кнопкой отмены. Наличие подтверждается отдельно."
            : "Демонстрационные места. Подтверждение наличия — отдельно."
        }
        wide
      >
        <LibraryView
          embedded
          onUseVenue={chooseVenue}
          onUseTemplate={applyTemplate}
        />
      </Modal>
      <Modal
        open={share}
        onClose={() => setShare(false)}
        title="Поделиться предложением"
        description="Публикация создаёт клиентскую версию. Передача ссылки — отдельный шаг."
      >
        {latest ? (
          <>
            <div className="published-info">
              <CheckCircle2 size={20} />
              <div>
                <strong>Клиентская версия {latest.number}</strong>
                <span>
                  {dirty
                    ? "В черновике есть неопубликованные изменения"
                    : "Содержание совпадает с текущим черновиком"}
                </span>
              </div>
            </div>
            <Field
              label="Ссылка на опубликованную версию"
              hint="Работает в этом браузере: серверное хранение не подключено."
            >
              <input
                readOnly
                value={currentLink}
                onFocus={(e) => e.target.select()}
              />
            </Field>
            <div className="button-row">
              <Button variant="secondary" onClick={copyLink}>
                <Copy size={15} />
                {copied ? "Скопировано" : "Скопировать ссылку"}
              </Button>
              <a className="button secondary" href={currentLink}>
                <ExternalLink size={15} />
                Открыть как клиент
              </a>
            </div>
            {copyFailed && (
              <p role="alert" className="field-error">
                Буфер обмена недоступен. Выделите ссылку в поле выше и
                скопируйте вручную.
              </p>
            )}
          </>
        ) : (
          <div className="inline-notice">
            Ссылки ещё нет. Сначала опубликуйте готовую версию.
          </div>
        )}
        <hr />
        <div className="share-access">
          <strong>Доступ клиента</strong>
          <p>
            Демонстрационный код: <b>{p.code}</b>. Это проверка сценария входа,
            без серверной защиты.
          </p>
          <p>
            {p.permissions.questions ? "Вопросы разрешены" : "Без вопросов"} ·{" "}
            {p.permissions.layout && p.scene
              ? "Своя расстановка разрешена"
              : "Расстановка только для просмотра"}
          </p>
          <button
            className="text-button"
            onClick={() => {
              setShare(false);
              setPanel("params");
            }}
          >
            Изменить возможности клиента <ChevronRight size={14} />
          </button>
        </div>
        {issues.length > 0 && (
          <div className="publish-issues">
            <strong>Перед публикацией</strong>
            {issues.map((i) => (
              <p key={i}>{i}</p>
            ))}
          </div>
        )}
        {requests.some((r) => r.status === "prepared") && (
          <div className="inline-notice">
            <strong>Пожелания в этом обновлении</strong>
            {requests
              .filter((r) => r.status === "prepared")
              .map((r) => (
                <p key={r.id}>
                  {r.preparedRevision === p.revision
                    ? "Будет отмечено как учтённое"
                    : "Требует повторной проверки"}
                  : {r.author} — {r.text}
                </p>
              ))}
          </div>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setShare(false)}>
            Вернуться к работе
          </Button>
          <Button
            disabled={!!issues.length || uploading || (latest && !dirty)}
            onClick={() => {
              try {
                onPublish();
                setCopied(false);
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            {latest ? "Опубликовать обновление" : "Опубликовать КП"}
          </Button>
        </div>
        <p className="fine-note">
          Публикация не отправляет сообщения и незавершённые ответы.
        </p>
      </Modal>
      {preview && (
        <Fullscreen
          title="Предпросмотр черновика"
          onClose={() => setPreview(false)}
          className="preview-overlay"
        >
          <header>
            <Button variant="secondary" onClick={() => setPreview(false)}>
              <ArrowLeft size={16} />К редактированию
            </Button>
            <span>Предпросмотр черновика · клиент пока не видит изменения</span>
            <div className="segmented">
              <button
                className={!phone ? "selected" : ""}
                onClick={() => setPhone(false)}
              >
                Компьютер
              </button>
              <button
                className={phone ? "selected" : ""}
                onClick={() => setPhone(true)}
              >
                Телефон
              </button>
            </div>
          </header>
          <div className={`preview-scroll ${phone ? "phone-preview" : ""}`}>
            <ProposalDocument
              document={publicDocument(p, agency)}
              onLayout={openSpatial}
            />
          </div>
        </Fullscreen>
      )}
      {spatial && (
        <Fullscreen
          title="Расстановка агентства"
          onClose={() => setSpatial(false)}
        >
          <Suspense
            fallback={
              <div className="loading-view">Открываем пространство…</div>
            }
          >
            <SpatialEditor
              scene={{ ...p.scene, expectedGuests: p.guests }}
              title={p.venue?.name}
              onChange={(scene) => edit({ scene })}
              onClose={() => setSpatial(false)}
              onUndo={undo}
              canUndo={undoCount > spatialStart.current}
              readOnly={preview}
              onSaveVariant={() => {
                setSpatial(false);
                notify("Расстановка сохранена в черновике КП");
              }}
            />
          </Suspense>
        </Fullscreen>
      )}
    </div>
  );
}
