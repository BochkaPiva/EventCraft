import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import {
  ArrowLeft,
  MessageSquare,
  X,
  CheckCircle2,
  Armchair,
  Send,
  LockKeyhole,
} from "lucide-react";
import ProposalDocument from "./ProposalDocument.jsx";
const SpatialEditor = lazy(() => import("./SpatialEditor.jsx"));
import { Button, Modal, Field, Empty, Fullscreen } from "./ui.jsx";
import { uid, clone } from "./model.js";
import { seatCount } from "./sceneModel.js";
function readPersonal(release) {
  try {
    const v = JSON.parse(
      localStorage.getItem(`eventcraft-personal-${release?.id}`) || "null",
    );
    if (
      v &&
      Array.isArray(v.variants) &&
      v.variants.every(
        (x) =>
          typeof x.name === "string" && x.scene && Array.isArray(x.scene.items),
      ) &&
      typeof v.name === "string" &&
      typeof v.text === "string" &&
      (!v.scene || Array.isArray(v.scene.items))
    )
      return v;
  } catch {}
  return {
    scene: clone(release?.document.scene || null),
    name: "",
    text: "",
    variants: [],
    changed: false,
  };
}
function visitorIdentity() {
  try {
    let id = localStorage.getItem("eventcraft-visitor");
    if (!id) {
      id = uid();
      localStorage.setItem("eventcraft-visitor", id);
    }
    return id;
  } catch {
    return uid();
  }
}
function MiniPlan({ scene }) {
  return (
    <svg
      className="mini-plan"
      viewBox="0 0 16 12"
      aria-label="Миниатюра расстановки"
      role="img"
    >
      <rect
        x=".1"
        y=".1"
        width="15.8"
        height="11.8"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth=".1"
      />
      {scene.items.map((i) => (
        <g
          key={i.id}
          transform={`translate(${i.x} ${i.z}) rotate(${i.rotation || 0})`}
        >
          {i.type === "roundTable" ? (
            <circle
              r={i.width / 2}
              fill="#e0e7ff"
              stroke="#818cf8"
              strokeWidth=".08"
            />
          ) : (
            <rect
              x={-i.width / 2}
              y={-i.depth / 2}
              width={i.width}
              height={i.depth}
              fill={i.type === "stage" ? "#a5b4fc" : "#e2e8f0"}
              stroke="#94a3b8"
              strokeWidth=".08"
            />
          )}
        </g>
      ))}
    </svg>
  );
}
export default function ClientView({
  proposal: p,
  releaseId,
  onSubmit,
  requests,
  notify,
}) {
  const r = releaseId
    ? p?.releases.find((v) => v.id === releaseId)
    : p?.releases.at(-1);
  const [personal] = useState(() => readPersonal(r)),
    [visitorId] = useState(visitorIdentity);
  const [unlocked, setUnlocked] = useState(false),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [question, setQuestion] = useState(false),
    [name, setName] = useState(personal.name),
    [text, setText] = useState(personal.text),
    [section, setSection] = useState(personal.section || "idea"),
    [spatial, setSpatial] = useState(false),
    [variant, setVariant] = useState(personal.scene),
    [variantChanged, setVariantChanged] = useState(personal.changed),
    [sent, setSent] = useState(false),
    [includeVariant, setIncludeVariant] = useState(!!personal.includeVariant),
    [attachment, setAttachment] = useState(personal.attachment || null),
    [variants, setVariants] = useState(personal.variants),
    [saveOpen, setSaveOpen] = useState(false),
    [variantName, setVariantName] = useState(""),
    [gallery, setGallery] = useState(false),
    [personalError, setPersonalError] = useState(false);
  const history = useRef([]),
    [undoCount, setUndoCount] = useState(0);
  useEffect(() => {
    if (!r) return;
    try {
      localStorage.setItem(
        `eventcraft-personal-${r.id}`,
        JSON.stringify({
          scene: variant,
          name,
          text,
          variants,
          changed: variantChanged,
          section,
          includeVariant,
          attachment,
        }),
      );
      setPersonalError(false);
    } catch {
      setPersonalError(true);
    }
  }, [
    r?.id,
    variant,
    name,
    text,
    variants,
    variantChanged,
    section,
    includeVariant,
    attachment,
  ]);
  if (!r)
    return (
      <main className="unavailable">
        <Empty
          icon={LockKeyhole}
          title="Предложение недоступно в этом браузере"
          action={
            <a className="button secondary" href="#/proposals">
              В кабинет агентства
            </a>
          }
        >
          В локальном прототипе ссылка открывает данные только на устройстве,
          где создано КП. В production они будут храниться на сервере.
        </Empty>
      </main>
    );
  const d = r.document;
  const mine = requests.filter(
    (q) => q.proposalId === p.id && q.visitorId === visitorId,
  );
  const newer = p.releases.at(-1).id !== r.id;
  const previousVariants = p.releases
    .filter((v) => v.id !== r.id)
    .map((v) => ({ release: v, variants: readPersonal(v).variants }))
    .filter((v) => v.variants.length);
  const variantCount =
    variants.length +
    previousVariants.reduce((n, v) => n + v.variants.length, 0);
  if (!unlocked)
    return (
      <main className="access-page">
        <a className="demo-back" href={`#/proposal/${p.id}`}>
          <ArrowLeft size={16} />
          Вернуться в агентство
        </a>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code === p.code) {
              setUnlocked(true);
              setError("");
            } else
              setError("Код не подошёл. Проверьте цифры и попробуйте ещё раз.");
          }}
        >
          <span className="access-mark" style={{ background: d.brand.accent }}>
            {d.brand.name.slice(0, 1)}
          </span>
          <span className="eyebrow">{d.brand.name}</span>
          <h1>{d.title}</h1>
          <p>
            Персональное предложение для {d.client || "вашего события"}. Введите
            код, который прислало агентство.
          </p>
          <Field label="Код доступа">
            <input
              autoFocus
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="4 цифры"
              aria-invalid={!!error}
              maxLength={16}
            />
          </Field>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">Открыть предложение</Button>
          <small>
            Локальное демо · код для проверки: {p.code}
            <br />
            Это демонстрация входа, без серверной авторизации.
          </small>
        </form>
      </main>
    );
  return (
    <div className="client-page">
      <div className="client-demo-bar">
        <a href={`#/proposal/${p.id}`}>
          <ArrowLeft size={14} />В агентство
        </a>
        <span>Клиентская версия {r.number} · локальное демо</span>
        <button
          className="text-button"
          onClick={() =>
            document
              .getElementById("client-estimate")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          К расчёту
        </button>
      </div>
      {newer && (
        <div className="new-release">
          Агентство подготовило обновление. Вы сейчас смотрите версию {r.number}
          .{" "}
          <a href={`#/client/${p.id}?release=${p.releases.at(-1).id}`}>
            Открыть версию {p.releases.at(-1).number}
          </a>
        </div>
      )}
      {personalError && (
        <p className="new-release" role="alert">
          Не удалось сохранить личный вариант в браузере. Не закрывайте страницу
          до отправки пожелания.
        </p>
      )}
      {variantCount > 0 && (
        <div className="personal-toolbar">
          <button className="text-button" onClick={() => setGallery(true)}>
            <Armchair size={15} />
            Мои варианты ({variantCount})
          </button>
          <span>Сохранены на этом устройстве</span>
        </div>
      )}
      <ProposalDocument
        document={d}
        showFooterAction={false}
        onLayout={() => setSpatial(true)}
        onQuestion={() => {
          setSent(false);
          setQuestion(true);
        }}
      />
      {d.permissions.questions && (
        <button
          className="client-contact"
          onClick={() => {
            setSent(false);
            setQuestion(true);
          }}
        >
          <MessageSquare size={18} />
          <span>Написать агентству</span>
        </button>
      )}
      <Modal
        open={question}
        onClose={() => setQuestion(false)}
        title={sent ? "Пожелание передано" : "Обсудить предложение"}
        description={
          sent
            ? "Оно сохранено отдельно от предложения агентства."
            : "Сообщите, что важно изменить или уточнить."
        }
      >
        {sent ? (
          <div className="message-success">
            <CheckCircle2 size={38} />
            <h3>Спасибо, мы получили ваше пожелание</h3>
            <p>
              Менеджер рассмотрит его и подготовит ответ. Опубликованное
              предложение пока осталось прежним.
            </p>
            <Button
              onClick={() => {
                setQuestion(false);
                setSent(false);
              }}
            >
              Вернуться к предложению
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !text.trim()) return;
              onSubmit({
                id: uid(),
                proposalId: p.id,
                releaseId: r.id,
                visitorId,
                author: name.trim(),
                text: text.trim(),
                section,
                scene:
                  includeVariant && d.permissions.layout
                    ? clone(attachment?.scene || variant)
                    : null,
                sceneName: includeVariant
                  ? attachment?.name || "Моя расстановка"
                  : "",
                status: "open",
                reply: "",
                createdAt: Date.now(),
              });
              setText("");
              setSent(true);
              setIncludeVariant(false);
            }}
          >
            <Field label="Как к вам обращаться?">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                required
                maxLength={80}
              />
            </Field>
            <Field label="О чём поговорим?">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="idea">Предложение в целом</option>
                <option value="program">Программа</option>
                <option value="estimate">Стоимость и состав</option>
                {d.venue && (
                  <option value="venue">Площадка и расстановка</option>
                )}
              </select>
            </Field>
            <Field
              label="Ваше пожелание"
              hint="Черновик сообщения сохраняется на этом устройстве."
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Например: давайте оставим больше времени для общения"
                required
                rows={4}
              />
            </Field>
            {variantChanged && d.permissions.layout && (
              <label className="check-setting">
                <input
                  type="checkbox"
                  checked={includeVariant}
                  onChange={(e) => {
                    setIncludeVariant(e.target.checked);
                    if (e.target.checked && !attachment)
                      setAttachment({
                        name: "Моя текущая расстановка",
                        scene: clone(variant),
                      });
                  }}
                />
                <span>
                  Приложить мою расстановку
                  <small>
                    {attachment ? `«${attachment.name}» · ` : ""}
                    {seatCount(attachment?.scene || variant)} мест. Вариант
                    агентства не изменится.
                  </small>
                </span>
              </label>
            )}
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setQuestion(false)}
              >
                Пока не отправлять
              </Button>
              <Button type="submit" disabled={!name.trim() || !text.trim()}>
                <Send size={15} />
                Отправить пожелание
              </Button>
            </div>
          </form>
        )}
        {mine.length > 0 && !sent && (
          <div className="client-messages">
            <h3>Мои пожелания и ответы</h3>
            {mine.map((m) => (
              <div key={m.id}>
                <strong>
                  {m.author} · версия{" "}
                  {p.releases.find((v) => v.id === m.releaseId)?.number}
                </strong>
                <p>{m.text}</p>
                {m.reply && (
                  <div className="sent-reply">
                    {d.brand.name}: {m.reply}
                  </div>
                )}
                <small>
                  {m.status === "included"
                    ? `Учтено в версии ${m.includedRelease}`
                    : m.reply
                      ? "Агентство ответило"
                      : "Ожидает ответа агентства"}
                </small>
              </div>
            ))}
          </div>
        )}
      </Modal>
      {spatial && (
        <Fullscreen
          title="Моя расстановка"
          onClose={() => setSpatial(false)}
          className="client-spatial"
        >
          <Suspense
            fallback={
              <div className="loading-view">Открываем пространство…</div>
            }
          >
            <SpatialEditor
              scene={{ ...variant, expectedGuests: d.guests }}
              title={d.venue?.name}
              readOnly={!d.permissions.layout}
              canUndo={!!undoCount}
              onUndo={() => {
                const prev = history.current.pop();
                if (prev) setVariant(prev);
                setUndoCount(history.current.length);
                setVariantChanged(true);
              }}
              onChange={(next) => {
                history.current.push(clone(variant));
                setVariant(next);
                setVariantChanged(true);
                setUndoCount(history.current.length);
              }}
              onClose={() => setSpatial(false)}
              onSaveVariant={() => {
                setVariantName(`Моя расстановка ${variants.length + 1}`);
                setSaveOpen(true);
              }}
            />
          </Suspense>
          <div className="client-variant-note">
            {d.permissions.layout
              ? "Ваш личный вариант · агентство увидит его только после отправки"
              : "Просмотр расстановки агентства"}
          </div>
        </Fullscreen>
      )}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Сохранить мой вариант"
        description="Он останется на этом устройстве. Предложение агентства не изменится."
      >
        <MiniPlan scene={variant || { items: [] }} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!variantName.trim()) return;
            setVariants([
              ...variants,
              { id: uid(), name: variantName.trim(), scene: clone(variant) },
            ]);
            setSaveOpen(false);
            setSpatial(false);
            setGallery(true);
            notify("Личный вариант сохранён. Он ещё не отправлен агентству.");
          }}
        >
          <Field label="Название варианта">
            <input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              required
              maxLength={80}
            />
          </Field>
          <div className="modal-actions">
            <Button type="submit">Сохранить у меня</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={gallery}
        onClose={() => setGallery(false)}
        title="Мои варианты расстановки"
        description="Личные сохранения на этом устройстве. Агентство получит только отправленный вариант."
      >
        <div className="variants-grid">
          {variants.map((v) => (
            <div key={v.id}>
              <MiniPlan scene={v.scene} />
              <strong>{v.name}</strong>
              <small>{seatCount(v.scene)} мест</small>
              <div className="button-row">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setVariant(clone(v.scene));
                    setVariantChanged(true);
                    setGallery(false);
                    setSpatial(true);
                  }}
                >
                  Открыть
                </Button>
                {d.permissions.questions && (
                  <Button
                    onClick={() => {
                      setVariant(clone(v.scene));
                      setVariantChanged(true);
                      setIncludeVariant(true);
                      setAttachment({ name: v.name, scene: clone(v.scene) });
                      setSection("venue");
                      if (!text.trim())
                        setText(`Посмотрите мой вариант «${v.name}».`);
                      setGallery(false);
                      setSent(false);
                      setQuestion(true);
                    }}
                  >
                    Обсудить с агентством
                  </Button>
                )}
              </div>
            </div>
          ))}
          {previousVariants.map((group) => (
            <div key={group.release.id}>
              <h3>К клиентской версии {group.release.number}</h3>
              <p className="fine-note">
                Эти варианты сохранены для прежнего предложения. Геометрия в
                новом выпуске могла измениться.
              </p>
              {group.variants.map((v) => (
                <div key={v.id}>
                  <MiniPlan scene={v.scene} />
                  <strong>{v.name}</strong>
                  <small>
                    {seatCount(v.scene)} мест · версия {group.release.number}
                  </small>
                </div>
              ))}
              <a
                className="button secondary"
                href={`#/client/${p.id}?release=${group.release.id}`}
              >
                Открыть исходную версию
              </a>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
