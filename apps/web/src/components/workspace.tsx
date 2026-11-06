"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "../lib/client-api.ts";
type Agency = { id: string; name: string };
type Proposal = {
  id: string;
  title: string;
  updated_at: string;
  revision: number;
};
type Listing = { proposals: Proposal[]; nextCursor: string | null };

export function Workspace() {
  const [agencies, setAgencies] = useState<Agency[] | null>(null),
    [agency, setAgency] = useState("");
  const [listing, setListing] = useState<Listing>({
    proposals: [],
    nextCursor: null,
  });
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const creationKey = useRef("");
  useEffect(() => {
    let current = true;
    void api("/api/auth/session")
      .then(() => api<{ agencies: Agency[] }>("/api/agencies"))
      .then((data) => {
        if (!current) return;
        setAgencies(data.agencies);
        setAgency(data.agencies[0]?.id || "");
        if (!data.agencies.length) setLoading(false);
      })
      .catch((cause) => {
        if (!current) return;
        if (cause instanceof ApiError && cause.status === 401)
          window.location.replace("/login");
        else {
          setError(errorMessage(cause));
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!agency) return;
    let current = true;
    setLoading(true);
    setError("");
    setListing({ proposals: [], nextCursor: null });
    void api<Listing>(
      `/api/proposals?agencyId=${agency}&q=${encodeURIComponent(query)}`,
    )
      .then((data) => {
        if (current) setListing(data);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [agency, query]);
  async function createAgency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = new FormData(event.currentTarget).get("name");
    setBusy(true);
    setError("");
    try {
      await api("/api/agencies", { name });
      window.location.reload();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "agency_exists")
        window.location.reload();
      else setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function createProposal() {
    if (busy || !agency) return;
    creationKey.current ||= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ proposal: { id: string } }>("/api/proposals", {
        agencyId: agency,
        creationKey: creationKey.current,
      });
      window.location.assign(`/proposals/${result.proposal.id}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  async function more() {
    if (!listing.nextCursor || busy || loading || search !== query) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Listing>(
        `/api/proposals?agencyId=${agency}&q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(listing.nextCursor)}`,
      );
      setListing((prev) => ({
        proposals: [
          ...prev.proposals,
          ...data.proposals.filter(
            (p) => !prev.proposals.some((old) => old.id === p.id),
          ),
        ],
        nextCursor: data.nextCursor,
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/auth/sign-out", {});
      window.location.replace("/login");
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="/proposals">
          EventCraft
        </a>
        <div className="agency-switch">
          {agencies && agencies.length > 1 ? (
            <select
              aria-label="Агентство"
              value={agency}
              disabled={busy || loading}
              onChange={(e) => {
                creationKey.current = "";
                setAgency(e.target.value);
              }}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <span>{agencies?.[0]?.name || "Рабочее пространство"}</span>
          )}
        </div>
        <nav aria-label="Основная навигация">
          <a className="nav-active" href="/proposals" aria-current="page">
            <span aria-hidden="true">▤</span> Предложения
          </a>
        </nav>
        <button
          className="button subtle sign-out"
          onClick={signOut}
          disabled={busy}
        >
          Выйти
        </button>
      </aside>
      <main className="workspace-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Работа с клиентами</p>
            <h1>Предложения</h1>
          </div>
          {agency && (
            <button
              className="button primary"
              onClick={createProposal}
              disabled={busy}
            >
              + Новое предложение
            </button>
          )}
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            {!agencies && (
              <button
                className="button"
                onClick={() => window.location.reload()}
              >
                Попробовать снова
              </button>
            )}
            <a href="/login">Войти</a>
          </div>
        )}
        {agencies?.length === 0 ? (
          <section className="onboarding">
            <h2>Как называется ваше агентство?</h2>
            <p className="muted">
              Это название рабочего пространства. Оформление предложений можно
              настроить позже.
            </p>
            <form onSubmit={createAgency}>
              <label htmlFor="agency-name">Название агентства</label>
              <input
                id="agency-name"
                name="name"
                required
                maxLength={100}
                autoComplete="organization"
              />
              <button className="button primary" disabled={busy}>
                Создать пространство
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="list-toolbar">
              <label className="search-field">
                <span className="sr-only">Поиск по названию</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти предложение"
                  maxLength={180}
                  disabled={!agency || busy}
                />
              </label>
              <span className="muted">Приватные черновики</span>
            </div>
            {loading ? (
              <div className="empty-state" role="status">
                Загружаем предложения…
              </div>
            ) : !listing.proposals.length && !error ? (
              <section className="empty-state">
                <span className="empty-symbol" aria-hidden="true">
                  ▤
                </span>
                <h2>
                  {query
                    ? "Ничего не нашлось"
                    : "Первое предложение начинается здесь"}
                </h2>
                <p className="muted">
                  {query
                    ? "Попробуйте другое название."
                    : "Начните с идеи. Дату, программу и площадку можно добавить по ходу работы."}
                </p>
                {!query && agency && (
                  <button
                    className="button primary"
                    onClick={createProposal}
                    disabled={busy}
                  >
                    Создать предложение
                  </button>
                )}
              </section>
            ) : (
              <div className="proposal-list">
                {listing.proposals.map((p) => (
                  <a
                    key={p.id}
                    className="proposal-row"
                    href={`/proposals/${p.id}`}
                  >
                    <span className="document-icon" aria-hidden="true">
                      ▤
                    </span>
                    <span className="proposal-title">
                      {p.title || "Новое предложение"}
                      <small>Редактировать предложение</small>
                    </span>
                    <span className="status-tag">Черновик</span>
                    <time dateTime={p.updated_at}>
                      {new Date(p.updated_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                    <span aria-hidden="true">›</span>
                  </a>
                ))}
              </div>
            )}
            {listing.nextCursor && (
              <button
                className="button load-more"
                onClick={more}
                disabled={busy || loading || search !== query}
              >
                Показать ещё
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
