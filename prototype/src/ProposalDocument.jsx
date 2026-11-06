import React from "react";
import {
  MapPin,
  Users,
  CalendarDays,
  ArrowUpRight,
  MessageSquare,
  Armchair,
} from "lucide-react";
import { money, dateLabel, total } from "./model.js";
import { seatCount } from "./sceneModel.js";
import { brandStyle } from "./branding.js";
export default function ProposalDocument({
  document: d,
  onLayout,
  onQuestion,
  compact = false,
  showFooterAction = true,
}) {
  const sum = total(d);
  return (
    <article
      className={`proposal-document ${compact ? "compact" : ""}`}
      style={brandStyle(d.brand.accent)}
    >
      <header className="document-brand">
        {d.brand.logo ? (
          <img src={d.brand.logo} alt={d.brand.name} />
        ) : (
          <strong>{d.brand.name}</strong>
        )}
        <span>Предложение для {d.client || "вашего события"}</span>
      </header>
      <section className="client-cover" id="client-cover">
        {d.image && (
          <img
            className="cover-photo"
            src={d.image}
            alt="Атмосфера предлагаемого мероприятия"
          />
        )}
        <div className="cover-copy">
          <span className="eyebrow">Ваше событие начинается здесь</span>
          <h1>{d.title || "Новое предложение"}</h1>
          <div className="event-facts">
            <span>
              <CalendarDays size={16} />
              {dateLabel(d.date)}
            </span>
            {d.guests && (
              <span>
                <Users size={16} />
                {d.guests} гостей
              </span>
            )}
            {d.venue && (
              <span>
                <MapPin size={16} />
                {d.venue.name}
              </span>
            )}
          </div>
        </div>
      </section>
      {d.sections
        .filter((s) => s !== "cover")
        .map((s) => {
          if (s === "idea" && d.intro)
            return (
              <section className="client-section" id="client-idea" key={s}>
                <span className="eyebrow">Идея</span>
                <h2>День, который объединяет</h2>
                <p className="reading-text">{d.intro}</p>
              </section>
            );
          if (s === "program" && d.program.length)
            return (
              <section className="client-section" id="client-program" key={s}>
                <span className="eyebrow">Программа</span>
                <h2>Как пройдёт событие</h2>
                <div className="client-program">
                  {d.program.map((r, i) => (
                    <div key={r.id || i}>
                      <time>{r.time || "Уточним"}</time>
                      <span className="timeline-dot" />
                      <div>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          if (s === "venue" && d.venue)
            return (
              <section className="client-section" id="client-venue" key={s}>
                <span className="eyebrow">Пространство</span>
                <h2>{d.venue.name}</h2>
                <p className="reading-text">{d.venue.description}</p>
                <div className="venue-display">
                  {d.venue.image && (
                    <img src={d.venue.image} alt={d.venue.name} />
                  )}
                  <div>
                    <MapPin size={20} />
                    <strong>{d.venue.city || "Расположение уточняется"}</strong>
                    {d.scene ? (
                      <>
                        <p>
                          Расстановка на {seatCount(d.scene)} мест
                          {d.guests ? ` · ${d.guests} гостей` : ""}
                        </p>
                        <button className="button primary" onClick={onLayout}>
                          <Armchair size={16} />
                          {d.permissions.layout
                            ? "Осмотреть и попробовать расстановку"
                            : "Осмотреть пространство"}
                          <ArrowUpRight size={16} />
                        </button>
                        <small>
                          План, объёмный вид и прогулка по одному залу.
                        </small>
                      </>
                    ) : (
                      <p>Схему и детали площадки уточнит агентство.</p>
                    )}
                  </div>
                </div>
                {d.scene && (
                  <p className="fine-note">
                    Учебная геометрия. Расстановка не означает бронирование
                    мебели.
                  </p>
                )}
              </section>
            );
          if (s === "team" && d.teamText)
            return (
              <section className="client-section" id="client-team" key={s}>
                <span className="eyebrow">Команда</span>
                <h2>Люди, которые всё устроят</h2>
                <p className="reading-text">{d.teamText}</p>
              </section>
            );
          if (s === "estimate" && d.estimate.length)
            return (
              <section className="client-section" id="client-estimate" key={s}>
                <span className="eyebrow">Состав предложения</span>
                <h2>Прозрачный расчёт</h2>
                <div className="client-estimate">
                  {d.estimate
                    .filter((r) => r.name.trim())
                    .map((r) => (
                      <div
                        key={r.id}
                        className={r.included === false ? "excluded" : ""}
                      >
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.included === false
                              ? "Дополнительно, не включено в итог"
                              : `${r.quantity ?? "Уточняется"} ${r.quantity === 1 ? "услуга" : "ед."}${r.price !== null ? " × " + money(r.price) : " · цену уточним"}`}
                          </small>
                        </span>
                        <strong>
                          {r.quantity === null || r.price === null
                            ? "Уточним"
                            : money(r.quantity * r.price)}
                        </strong>
                      </div>
                    ))}
                </div>
                <div className="estimate-summary">
                  <span>
                    {sum.partial
                      ? "Известная часть стоимости"
                      : "Стоимость предложения"}
                    <small>
                      {sum.partial
                        ? "Часть позиций ещё уточняется"
                        : "По указанному составу работ"}
                    </small>
                  </span>
                  <strong>
                    {sum.count ? money(sum.amount) : "Уточняется"}
                  </strong>
                </div>
                <p className="fine-note">
                  Предварительное предложение. Наличие площадки, мебели и услуг
                  подтверждается отдельно.
                </p>
              </section>
            );
          return null;
        })}
      <footer className="document-footer">
        <div>
          <strong>Обсудим детали?</strong>
          <p>Поделитесь пожеланиями — мы подготовим следующий вариант.</p>
        </div>
        {showFooterAction && onQuestion && d.permissions.questions && (
          <button className="button primary" onClick={onQuestion}>
            <MessageSquare size={16} />
            Написать агентству
          </button>
        )}
        <small>
          {d.brand.email}
          {d.brand.phone && ` · ${d.brand.phone}`}
        </small>
      </footer>
    </article>
  );
}
