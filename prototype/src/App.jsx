import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Library,
  Settings,
  Copy,
  Archive,
  FileText,
  MessageSquare,
  Check,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button, Modal, Overflow, Field, Empty } from "./ui.jsx";
import {
  STORAGE_KEY,
  uid,
  clone,
  dateLabel,
  createProposal,
  initialState,
  readState,
  publish,
} from "./model.js";
import { createDefaultScene } from "./sceneModel.js";
import WorkspaceSettings from "./WorkspaceSettings.jsx";
import LibraryView from "./LibraryView.jsx";
import Editor from "./Editor.jsx";
import ClientView from "./ClientView.jsx";
import "@fontsource-variable/inter";
const cleanRoute = () => {
  const [path, query = ""] = (location.hash.slice(1) || "/proposals").split(
    "?",
  );
  return { path, query: new URLSearchParams(query) };
};
const go = (path) => {
  location.hash = path;
};
export function App() {
  const [loaded] = useState(readState);
  const [data, setData] = useState(loaded.data);
  const [storageError, setStorageError] = useState(loaded.error);
  const [route, setRoute] = useState(cleanRoute);
  const [toast, setToast] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    const f = () => setRoute(cleanRoute());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    if (loaded.error) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(null);
    } catch {
      setStorageError(
        "Не удалось сохранить в браузере. Работа остаётся открыта — скачайте резервную копию.",
      );
    }
  }, [data, loaded.error]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (m) => setToast(m);
  const updateProposal = (id, fn) =>
    setData((d) => ({
      ...d,
      proposals: d.proposals.map((p) => (p.id === id ? fn(p) : p)),
    }));
  const create = (kind = "blank") => {
    const p = createProposal(kind);
    setData((d) => ({ ...d, proposals: [p, ...d.proposals] }));
    go(`/proposal/${p.id}`);
  };
  const reset = () => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("eventcraft-")) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("eventcraft-")) sessionStorage.removeItem(key);
    location.hash = "";
    location.reload();
  };
  const backup = () => {
    let raw;
    try {
      raw = loaded.error ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {}
    const url = URL.createObjectURL(
      new Blob([raw || JSON.stringify(data, null, 2)], {
        type: raw ? "text/plain" : "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = raw
      ? "eventcraft-recovery-original.txt"
      : "eventcraft-demo-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const isClient = route.path.startsWith("/client/");
  const id = route.path.split("/")[2];
  const p = data.proposals.find((p) => p.id === id);
  return (
    <>
      {storageError && (
        <div className="storage-warning" role="alert">
          <AlertCircle size={16} />
          {storageError}
          <button onClick={backup}>Скачать копию</button>
          <button onClick={() => setResetOpen(true)}>Начать заново</button>
        </div>
      )}
      {isClient ? (
        <ClientView
          key={route.path + route.query.toString()}
          proposal={p}
          releaseId={route.query.get("release")}
          onSubmit={(r) => {
            setData((d) => ({ ...d, requests: [...d.requests, r] }));
            notify("Пожелание передано агентству");
          }}
          requests={data.requests}
          notify={notify}
        />
      ) : !data.agency ? (
        <Welcome
          onStart={(name) => {
            setData((d) => ({
              ...d,
              agency: { name, accent: "#4f46e5", email: "", phone: "" },
              team: [{ id: uid(), name: "Вы", email: "", role: "Владелец" }],
            }));
            go("/proposals");
          }}
          onDemo={() => {
            setData(initialState(true));
            go("/proposals");
          }}
        />
      ) : route.path.startsWith("/proposal/") ? (
        p ? (
          <Editor
            storageError={storageError}
            key={p.id}
            proposal={p}
            agency={data.agency}
            requests={data.requests.filter((r) => r.proposalId === p.id)}
            initialRequest={route.query.get("request")}
            onChange={(fn) => updateProposal(p.id, fn)}
            onRequestChange={(id, patch) =>
              setData((d) => ({
                ...d,
                requests: d.requests.map((r) =>
                  r.id === id ? { ...r, ...patch } : r,
                ),
              }))
            }
            onPublish={() => {
              const next = publish(p, data.agency);
              setData((d) => ({
                ...d,
                proposals: d.proposals.map((v) => (v.id === p.id ? next : v)),
                requests: d.requests.map((r) =>
                  r.proposalId === p.id &&
                  r.status === "prepared" &&
                  r.preparedRevision === p.revision
                    ? {
                        ...r,
                        status: "included",
                        includedRelease: next.releases.at(-1).number,
                      }
                    : r,
                ),
              }));
              notify("Клиентская версия опубликована");
              return next.releases.at(-1);
            }}
            notify={notify}
          />
        ) : (
          <Empty
            title="Предложение не найдено"
            action={
              <Button onClick={() => go("/proposals")}>К предложениям</Button>
            }
          >
            Возможно, оно удалено из этого демо.
          </Empty>
        )
      ) : (
        <div className="app-shell">
          <Sidebar agency={data.agency} route={route.path} />
          <main className="workspace-main">
            {route.path === "/settings" ? (
              <WorkspaceSettings
                publishedCount={
                  data.proposals.filter((p) => p.releases.length > 0).length
                }
                agency={data.agency}
                team={data.team}
                billing={data.billing}
                onAgencyChange={(agency) => setData((d) => ({ ...d, agency }))}
                onTeamChange={(team) => setData((d) => ({ ...d, team }))}
                onBillingChange={(billing) =>
                  setData((d) => ({ ...d, billing }))
                }
                onReset={reset}
                notify={notify}
              />
            ) : route.path === "/library" ? (
              <LibraryView
                onUseTemplate={create}
                onUseVenue={(venue) => {
                  const v = createProposal();
                  v.venue = venue;
                  v.sections.splice(3, 0, "venue");
                  v.scene = venue.hasScene ? createDefaultScene() : null;
                  v.touched = true;
                  setData((d) => ({ ...d, proposals: [v, ...d.proposals] }));
                  go(`/proposal/${v.id}`);
                }}
              />
            ) : (
              <ProposalList
                agency={data.agency}
                proposals={data.proposals}
                requests={data.requests}
                onCreate={create}
                onArchive={(id) =>
                  updateProposal(id, (v) => ({ ...v, archived: !v.archived }))
                }
                onDuplicate={(v) => {
                  const copy = {
                    ...clone(v),
                    id: uid(),
                    title: `${v.title || "Предложение"} — копия`,
                    client: "",
                    date: "",
                    releases: [],
                    revision: 0,
                    updatedAt: Date.now(),
                    archived: false,
                    touched: true,
                  };
                  setData((d) => ({ ...d, proposals: [copy, ...d.proposals] }));
                  go(`/proposal/${copy.id}`);
                  notify("Копия создана без клиентских ответов и ссылок");
                }}
              />
            )}
          </main>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Начать локальное демо заново?"
        description="Сохранённые данные этого демо будут удалены из браузера. Сначала можно скачать исходную копию."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={backup}>
            Скачать копию
          </Button>
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Вернуться
          </Button>
          <Button onClick={reset}>Очистить демо</Button>
        </div>
      </Modal>
    </>
  );
}
function Welcome({ onStart, onDemo }) {
  const [name, setName] = useState("");
  return (
    <main className="welcome">
      <div className="welcome-content">
        <div className="wordmark">
          <BookOpen size={25} />
          EventCraft<span className="demo-tag">Прототип</span>
        </div>
        <div className="welcome-form">
          <span className="eyebrow">Рабочее пространство агентства</span>
          <h1>
            От идеи до предложения,
            <br />
            которое хочется открыть.
          </h1>
          <p>
            Соберите программу, покажите площадку и обсудите детали с клиентом в
            одном месте.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onStart(name.trim());
            }}
          >
            <Field label="Как называется ваше агентство?">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Студия Север"
                required
                maxLength={80}
              />
            </Field>
            <Button type="submit">
              Создать рабочее пространство
              <ChevronRight size={16} />
            </Button>
          </form>
          <button className="text-button" onClick={onDemo}>
            Сначала посмотреть заполненный пример
          </button>
          <div className="welcome-note">
            <Check size={15} />
            Без карты и настройки библиотеки
            <div>
              Локальное демо. Данные сохраняются только в этом браузере.
            </div>
          </div>
        </div>
        <footer>EventCraft · интерактивные предложения для событий</footer>
      </div>
      <div className="welcome-visual">
        <img src="/images/venue.jpg" alt="Светлый зал для мероприятий" />
        <div className="welcome-caption">
          <span>Ваше предложение. Ваш бренд.</span>
          <h2>
            Программа, пространство
            <br />и решения — вместе.
          </h2>
          <p>
            Редактируйте на странице. Показывайте в 3D. Принимайте пожелания
            клиента.
          </p>
        </div>
      </div>
    </main>
  );
}
function Sidebar({ agency, route }) {
  return (
    <aside className="sidebar">
      <a className="wordmark" href="#/proposals">
        <BookOpen size={23} />
        EventCraft
      </a>
      <div className="agency-label">
        <span className="agency-avatar">{agency.name.slice(0, 1)}</span>
        <div>
          <strong>{agency.name}</strong>
          <span>Рабочее пространство</span>
        </div>
      </div>
      <nav aria-label="Основная навигация">
        <a
          className={route === "/proposals" ? "active" : ""}
          href="#/proposals"
        >
          <FileText size={18} />
          Предложения
        </a>
        <a className={route === "/library" ? "active" : ""} href="#/library">
          <Library size={18} />
          Библиотека
        </a>
      </nav>
      <div className="sidebar-bottom">
        <a className={route === "/settings" ? "active" : ""} href="#/settings">
          <Settings size={18} />
          Настройки
        </a>
        <div className="demo-notice">
          Демонстрационная среда<span>Без реальных оплат и отправок</span>
        </div>
        <div className="profile">
          <span className="avatar">В</span>
          <span>
            Вы<small>Владелец агентства</small>
          </span>
        </div>
      </div>
    </aside>
  );
}
function useListPreference(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem(`eventcraft-list-${key}`)) ?? fallback
      );
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(`eventcraft-list-${key}`, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}
function ProposalList({
  agency,
  proposals,
  requests,
  onCreate,
  onArchive,
  onDuplicate,
}) {
  const [search, setSearch] = useListPreference("search", "");
  const [filter, setFilter] = useListPreference("filter", "all");
  const [sort, setSort] = useListPreference("sort", "recent");
  useEffect(() => {
    let restore;
    try {
      restore = requestAnimationFrame(() =>
        window.scrollTo(
          0,
          Number(sessionStorage.getItem("eventcraft-list-scroll")) || 0,
        ),
      );
    } catch {}
    const remember = () => {
      try {
        sessionStorage.setItem(
          "eventcraft-list-scroll",
          String(window.scrollY),
        );
      } catch {}
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      cancelAnimationFrame(restore);
      window.removeEventListener("scroll", remember);
    };
  }, []);
  const [startOpen, setStartOpen] = useState(false);
  const visible = proposals
    .filter(
      (p) =>
        p.touched ||
        p.title ||
        p.intro ||
        p.program.length ||
        p.estimate.length,
    )
    .filter((p) => (filter === "archive" ? p.archived : !p.archived))
    .filter((p) =>
      `${p.title} ${p.client}`.toLowerCase().includes(search.toLowerCase()),
    )
    .filter(
      (p) =>
        filter !== "requests" ||
        requests.some((r) => r.proposalId === p.id && r.status !== "included"),
    )
    .sort((a, b) =>
      sort === "date"
        ? (a.date || "9999").localeCompare(b.date || "9999")
        : b.updatedAt - a.updatedAt,
    );
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Предложения</h1>
          <p>Ваши идеи, проекты и диалог с клиентом.</p>
        </div>
        <Button onClick={() => onCreate()}>
          <Plus size={17} />
          Создать КП
        </Button>
      </header>
      <div className="list-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Найти предложение"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти предложение или заказчика"
          />
        </label>
        <div className="segmented">
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            Все
          </button>
          <button
            className={filter === "requests" ? "selected" : ""}
            onClick={() => setFilter("requests")}
          >
            С пожеланиями
          </button>
          <button
            className={filter === "archive" ? "selected" : ""}
            onClick={() => setFilter("archive")}
          >
            Архив
          </button>
        </div>
        <select
          className="quiet-select"
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Недавно изменённые</option>
          <option value="date">По дате события</option>
        </select>
      </div>
      {visible.length ? (
        <div className="proposal-table">
          <div className="proposal-table-head">
            <span>Предложение и заказчик</span>
            <span>Дата события</span>
            <span>Клиентская версия</span>
            <span>Пожелания</span>
            <span />
          </div>
          {visible.map((p) => {
            const req = requests.filter(
              (r) => r.proposalId === p.id && r.status !== "included",
            );
            const latest = p.releases.at(-1);
            const dirty =
              latest &&
              (p.revision !== latest.revision ||
                ["name", "accent", "logo", "email", "phone"].some(
                  (k) => (latest.document.brand[k] || "") !== (agency[k] || ""),
                ));
            return (
              <div className="proposal-row" key={p.id}>
                <button
                  className="proposal-title"
                  onClick={() => go(`/proposal/${p.id}`)}
                >
                  {p.image ? (
                    <img src={p.image} alt="" />
                  ) : (
                    <span className="document-thumb">
                      <FileText size={22} />
                    </span>
                  )}
                  <span>
                    <strong>{p.title || "Новое предложение"}</strong>
                    <small>{p.client || "Заказчик не указан"}</small>
                  </span>
                </button>
                <span className="row-date">{dateLabel(p.date)}</span>
                <span>
                  <span className={`badge ${latest ? "green" : "neutral"}`}>
                    {latest ? "Опубликовано" : "Черновик"}
                  </span>
                  {dirty && (
                    <small className="row-subtle">Есть новые изменения</small>
                  )}
                </span>
                <span>
                  {req.length ? (
                    <button
                      className="request-link"
                      onClick={() =>
                        go(`/proposal/${p.id}?request=${req[0].id}`)
                      }
                    >
                      <MessageSquare size={14} />
                      {req.length}{" "}
                      {req.length === 1 ? "пожелание" : "пожелания"}
                    </button>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </span>
                <div className="row-actions">
                  <button
                    className="text-button"
                    onClick={() => go(`/proposal/${p.id}`)}
                  >
                    Продолжить
                  </button>
                  <Overflow
                    items={[
                      {
                        label: "Создать копию",
                        icon: <Copy size={15} />,
                        action: () => onDuplicate(p),
                      },
                      {
                        label: p.archived ? "Вернуть из архива" : "В архив",
                        icon: <Archive size={15} />,
                        action: () => onArchive(p.id),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={filter === "requests" ? MessageSquare : FileText}
          title={
            search || filter !== "all"
              ? "По этому отбору ничего нет"
              : "Ваше первое предложение начинается здесь"
          }
          action={
            search || filter !== "all" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Сбросить отбор
              </Button>
            ) : (
              <div className="button-row">
                <Button onClick={() => onCreate()}>
                  <Plus size={16} />
                  Создать первое КП
                </Button>
                <Button variant="secondary" onClick={() => setStartOpen(true)}>
                  Взять заготовку
                </Button>
              </div>
            )
          }
        >
          {search || filter !== "all"
            ? "Измените поиск или вернитесь ко всем предложениям."
            : "Начните со своего текста и фотографий. Площадку и точную дату можно добавить позже."}
        </Empty>
      )}
      <Modal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        title="С чего начнём?"
        description="Заготовка — редактируемая основа. Все примеры демонстрационные."
      >
        <TemplateChoices
          onChoose={(kind) => {
            setStartOpen(false);
            onCreate(kind);
          }}
        />
      </Modal>
    </>
  );
}
function TemplateChoices({ onChoose }) {
  return (
    <div className="template-choices">
      {[
        [
          "team",
          "Командный день",
          "Идея, командная программа и расчёт",
          "/images/team.jpg",
        ],
        [
          "conference",
          "Конференция",
          "Программа встречи и состав работ",
          "/images/venue.jpg",
        ],
        [
          "evening",
          "Вечер для команды",
          "Ужин, программа и пространство",
          "/images/evening.jpg",
        ],
      ].map(([id, name, description, image]) => (
        <button key={id} onClick={() => onChoose(id)}>
          <img src={image} alt="" />
          <span>
            <strong>{name}</strong>
            <small>{description}</small>
          </span>
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  );
}
