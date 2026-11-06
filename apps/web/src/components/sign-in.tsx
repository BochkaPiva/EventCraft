"use client";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/client-api.ts";

export function SignIn() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/sign-in", {
        email: fields.get("email"),
        password: fields.get("password"),
      });
      form.reset();
      window.location.assign("/proposals");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? "Не удалось войти. Проверьте почту и пароль."
          : cause instanceof ApiError && cause.status === 429
            ? "Слишком много попыток. Подождите немного и попробуйте снова."
            : "Вход временно недоступен. Попробуйте позже.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <a className="brand" href="/">
        EventCraft<span>Предложения для событий</span>
      </a>
      <div className="login-layout">
        <section className="login-intro">
          <div className="intro-line" />
          <h1>
            От идеи
            <br />
            до общего решения.
          </h1>
          <p>
            Ваше предложение, пространство и обсуждение с клиентом — в одном
            месте.
          </p>
          <div className="intro-sample" aria-hidden="true">
            <span>Командное событие</span>
            <strong>
              Идея. Пространство.
              <br />
              Всё складывается.
            </strong>
            <div className="sample-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>
        <section className="login-card">
          <h2>Войти в агентство</h2>
          <p className="muted">Продолжите работу над предложениями.</p>
          <form onSubmit={submit} aria-busy={busy}>
            <label htmlFor="email">Рабочая почта</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="name@agency.ru"
            />
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy}
              type="submit"
            >
              {busy ? "Входим…" : "Войти"}
            </button>
          </form>
          <p className="login-footnote">
            Доступ для участников пилота.
            <br />
            Если у вас ещё нет доступа, обратитесь к владельцу агентства.
          </p>
        </section>
      </div>
      <footer>Рабочее пространство ивент-агентства</footer>
    </main>
  );
}
