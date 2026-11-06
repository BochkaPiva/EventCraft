import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  ImagePlus,
  Info,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import "./settings.css";
import { brandStyle } from "./branding.js";

const ROLES = ["Владелец", "Менеджер", "Редактор"];
const PLANS = [
  {
    name: "Старт",
    price: 4900,
    members: 3,
    proposals: 10,
    storage: 5,
    summary: "Для небольшой команды",
    features: [
      "3 сотрудника",
      "10 опубликованных КП",
      "5 ГБ материалов",
      "Оформление агентства",
    ],
  },
  {
    name: "Команда",
    price: 12900,
    members: 10,
    proposals: 50,
    storage: 30,
    summary: "Для регулярных проектов",
    features: [
      "10 сотрудников",
      "50 опубликованных КП",
      "30 ГБ материалов",
      "Обсуждение и варианты клиента",
    ],
  },
  {
    name: "Студия",
    price: 24900,
    members: 25,
    proposals: 200,
    storage: 100,
    summary: "Для нескольких проектных групп",
    features: [
      "25 сотрудников",
      "200 опубликованных КП",
      "100 ГБ материалов",
      "Несколько наборов оформления",
    ],
  },
];
const money = (amount) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount);
const dateLabel = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Omsk",
      }).format(date);
};

function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ec-settings-overlay" />
        <Dialog.Content
          className={`ec-settings-dialog${wide ? " ec-settings-dialog-wide" : ""}`}
        >
          <div className="ec-settings-dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close
              className="ec-settings-icon-button"
              aria-label="Закрыть диалог"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function WorkspaceSettings({
  agency = {},
  team = [],
  billing = {},
  publishedCount = 0,
  onAgencyChange,
  onTeamChange,
  onBillingChange,
  onReset,
  notify,
}) {
  const [tab, setTab] = useState("brand");
  const [draft, setDraft] = useState({
    name: "",
    accent: "#4f46e5",
    email: "",
    phone: "",
    ...agency,
  });
  const [formError, setFormError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    role: "Менеджер",
  });
  const [inviteError, setInviteError] = useState("");
  const [removeMember, setRemoveMember] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [cycle, setCycle] = useState(billing.cycle || "month");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInput = useRef(null);
  const announce = (message) => notify?.(message);
  useEffect(() => {
    setDraft({ name: "", accent: "#4f46e5", email: "", phone: "", ...agency });
  }, [agency]);

  const currentPlan =
    PLANS.find((plan) => plan.name === billing.tier) || PLANS[0];
  const currentRank = PLANS.indexOf(currentPlan);
  const selectionRank = selectedPlan
    ? PLANS.findIndex((plan) => plan.name === selectedPlan.name)
    : -1;
  const isDowngrade = selectionRank !== -1 && selectionRank < currentRank;
  const cycleOnly =
    selectedPlan?.name === currentPlan.name &&
    cycle !== (billing.cycle || "month");
  const scheduleChange =
    billing.status !== "trial" && (isDowngrade || cycleOnly);
  const periodEnd = dateLabel(billing.periodEnd || billing.trialEnd);
  const isDirty =
    JSON.stringify(draft) !==
    JSON.stringify({
      name: "",
      accent: "#4f46e5",
      email: "",
      phone: "",
      ...agency,
    });
  const ownerCount = team.filter((member) => member.role === "Владелец").length;
  const scheduledName =
    typeof billing.scheduledTier === "object"
      ? billing.scheduledTier?.name
      : billing.scheduledTier;
  const accent = /^#[\da-f]{6}$/i.test(draft.accent) ? draft.accent : "#4f46e5";
  const accentChannels = accent
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => parseInt(channel, 16));
  const accentLuminance = accentChannels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const accentText =
    accentLuminance[0] * 0.2126 +
      accentLuminance[1] * 0.7152 +
      accentLuminance[2] * 0.0722 >
    0.179
      ? "#111827"
      : "#ffffff";

  function navigateTabs(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const keys = ["brand", "team", "billing"];
    const index = keys.indexOf(tab);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? keys.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + keys.length) %
            keys.length;
    setTab(keys[next]);
    event.currentTarget.parentElement
      .querySelectorAll('[role="tab"]')
      [next]?.focus();
  }

  function saveAgency(event) {
    event.preventDefault();
    if (!draft.name.trim()) return setFormError("Укажите название агентства.");
    if (!/^#[\da-f]{6}$/i.test(draft.accent))
      return setFormError("Введите цвет в формате #4F46E5.");
    setFormError("");
    onAgencyChange?.({
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
    });
    announce("Оформление агентства сохранено.");
  }

  function uploadLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return setFormError("Для логотипа подойдёт PNG, JPG или WebP.");
    if (file.size > 1024 * 1024)
      return setFormError(
        "Логотип больше 1 МБ. Выберите файл меньшего размера.",
      );
    const reader = new FileReader();
    reader.onerror = () =>
      setFormError("Не удалось прочитать файл. Попробуйте другой логотип.");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        setFormError(
          "Не удалось открыть изображение. Проверьте файл логотипа.",
        );
      image.onload = () => {
        setDraft((previous) => ({ ...previous, logo: String(reader.result) }));
        setFormError("");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function addMember(event) {
    event.preventDefault();
    const email = invite.email.trim().toLowerCase();
    if (!invite.name.trim() || !email)
      return setInviteError("Укажите имя и почту участника.");
    if (team.some((member) => member.email.toLowerCase() === email))
      return setInviteError("Участник с этой почтой уже есть в команде.");
    onTeamChange?.([
      ...team,
      {
        id: `member-${Date.now()}`,
        name: invite.name.trim(),
        email,
        role: invite.role,
      },
    ]);
    setInviteOpen(false);
    setInvite({ name: "", email: "", role: "Менеджер" });
    setInviteError("");
    announce("Участник добавлен в демокоманду. Письмо не отправлялось.");
  }

  function changeRole(member, role) {
    if (member.role === "Владелец" && ownerCount === 1 && role !== "Владелец")
      return announce("В команде должен остаться хотя бы один владелец.");
    onTeamChange?.(
      team.map((item) => (item.id === member.id ? { ...item, role } : item)),
    );
    announce(`Роль участника «${member.name}» изменена.`);
  }

  function confirmPlan() {
    if (!selectedPlan) return;
    if (scheduleChange) {
      onBillingChange?.({
        ...billing,
        scheduledTier: selectedPlan.name,
        scheduledCycle: cycle,
        cancelAtPeriodEnd: false,
      });
      announce(`Переход на тариф «${selectedPlan.name}» запланирован в демо.`);
    } else {
      const end = new Date();
      if (cycle === "year") end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);
      const periodEnd = [
        end.getFullYear(),
        String(end.getMonth() + 1).padStart(2, "0"),
        String(end.getDate()).padStart(2, "0"),
      ].join("-");
      onBillingChange?.({
        ...billing,
        tier: selectedPlan.name,
        cycle,
        status: "active",
        periodEnd,
        scheduledTier: null,
        scheduledCycle: null,
        cancelAtPeriodEnd: false,
      });
      announce(
        `В демо выбран тариф «${selectedPlan.name}». Оплата не проводилась.`,
      );
    }
    setPlanOpen(false);
    setSelectedPlan(null);
  }

  return (
    <section className="ec-settings">
      <header className="ec-settings-page-heading">
        <h1>Настройки</h1>
        <p>Агентство, команда и условия подписки.</p>
      </header>
      <div
        className="ec-settings-tabs"
        role="tablist"
        aria-label="Разделы настроек"
      >
        {[
          ["brand", Palette, "Оформление"],
          ["team", Users, "Команда"],
          ["billing", CreditCard, "Подписка"],
        ].map(([id, Icon, title]) => (
          <button
            key={id}
            id={`settings-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={navigateTabs}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {title}
          </button>
        ))}
      </div>

      {tab === "brand" && (
        <div
          id="settings-panel-brand"
          role="tabpanel"
          aria-labelledby="settings-tab-brand"
          className="ec-settings-brand-layout"
        >
          <form onSubmit={saveAgency} className="ec-settings-brand-form">
            <div className="ec-settings-section-heading">
              <h2>Оформление агентства</h2>
              <p>
                Используется для новых предложений. Опубликованные версии
                сохраняют своё оформление.
              </p>
            </div>
            <label className="ec-settings-field">
              Название агентства
              <input
                value={draft.name}
                maxLength={70}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder="Например, Северное бюро"
                required
              />
            </label>
            <div className="ec-settings-field">
              <span>Логотип</span>
              <div className="ec-settings-logo-row">
                <div className="ec-settings-logo-preview">
                  {draft.logo ? (
                    <img src={draft.logo} alt="Логотип агентства" />
                  ) : (
                    <ImagePlus size={24} strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <button
                    className="ec-settings-button"
                    type="button"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={15} />
                    {draft.logo ? "Заменить логотип" : "Загрузить логотип"}
                  </button>
                  <p className="ec-settings-help">PNG, JPG или WebP, до 1 МБ</p>
                  {draft.logo && (
                    <button
                      className="ec-settings-text-button"
                      type="button"
                      onClick={() => setDraft({ ...draft, logo: "" })}
                    >
                      Убрать логотип
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="ec-settings-file-input"
                onChange={uploadLogo}
                aria-label="Выбрать логотип"
              />
            </div>
            <div className="ec-settings-field">
              <label htmlFor="agency-accent">Фирменный цвет</label>
              <div className="ec-settings-color-row">
                <input
                  type="color"
                  aria-label="Выбрать фирменный цвет"
                  value={
                    /^#[\da-f]{6}$/i.test(draft.accent)
                      ? draft.accent
                      : "#4f46e5"
                  }
                  onChange={(event) =>
                    setDraft({ ...draft, accent: event.target.value })
                  }
                />
                <input
                  id="agency-accent"
                  value={draft.accent}
                  maxLength={7}
                  onChange={(event) =>
                    setDraft({ ...draft, accent: event.target.value })
                  }
                  spellCheck="false"
                />
              </div>
              <p className="ec-settings-help">
                Акцент для кнопок и деталей предложения.
              </p>
            </div>
            <div className="ec-settings-section-divider" />
            <div className="ec-settings-section-heading">
              <h2>Контакты в предложении</h2>
              <p>Клиент сможет связаться с вашей командой.</p>
            </div>
            <div className="ec-settings-two-columns">
              <label className="ec-settings-field">
                Электронная почта
                <input
                  type="email"
                  value={draft.email}
                  maxLength={150}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                  placeholder="hello@example.test"
                />
              </label>
              <label className="ec-settings-field">
                Телефон
                <input
                  type="tel"
                  value={draft.phone}
                  maxLength={35}
                  onChange={(event) =>
                    setDraft({ ...draft, phone: event.target.value })
                  }
                  placeholder="+7 (000) 000-00-00"
                />
              </label>
            </div>
            {formError && (
              <p className="ec-settings-error" role="alert">
                {formError}
              </p>
            )}
            <div className="ec-settings-form-footer">
              <span>
                {isDirty
                  ? "Есть несохранённые изменения"
                  : "Изменения сохранены"}
              </span>
              <button
                className="ec-settings-button ec-settings-primary"
                disabled={!isDirty}
                type="submit"
              >
                Сохранить изменения
              </button>
            </div>
          </form>
          <aside className="ec-settings-brand-aside">
            <span className="ec-settings-preview-label">
              Предпросмотр оформления
            </span>
            <div
              className="ec-settings-proposal-preview"
              style={{
                "--agency-accent": accent,
                "--agency-on": brandStyle(accent)["--brand-on"],
                "--agency-text": brandStyle(accent)["--brand-text"],
                "--agency-on-accent": accentText,
              }}
            >
              <div className="ec-settings-preview-brand">
                {draft.logo ? (
                  <img src={draft.logo} alt="" />
                ) : (
                  <span className="ec-settings-brand-mark">
                    {(draft.name || "А").charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{draft.name || "Ваше агентство"}</span>
              </div>
              <span className="ec-settings-preview-rule" />
              <p className="ec-settings-preview-client">
                Персональное предложение
              </p>
              <h3>
                Люди.
                <br />
                Идеи. События.
              </h3>
              <p>Мероприятие, которое соберёт вашу команду.</p>
              <div className="ec-settings-preview-cta">
                Обсудить предложение
                <ArrowRight size={14} />
              </div>
              <span className="ec-settings-preview-contact">
                {draft.email || "Почта вашей команды"}
              </span>
            </div>
            <p className="ec-settings-help">
              Пример показывает фирменный цвет, логотип и контакты. Содержимое
              КП настраивается в редакторе.
            </p>
          </aside>
        </div>
      )}

      {tab === "team" && (
        <div
          id="settings-panel-team"
          role="tabpanel"
          aria-labelledby="settings-tab-team"
          className="ec-settings-team-panel"
        >
          <div className="ec-settings-section-heading ec-settings-heading-with-action">
            <div>
              <h2>
                Команда агентства{" "}
                <span className="ec-settings-count">{team.length}</span>
              </h2>
              <p>Сотрудники работают с предложениями в одном пространстве.</p>
            </div>
            <button
              type="button"
              className="ec-settings-button ec-settings-primary"
              onClick={() => {
                setInviteError("");
                setInviteOpen(true);
              }}
            >
              <Plus size={16} />
              Пригласить участника
            </button>
          </div>
          <div className="ec-settings-team-table">
            <div className="ec-settings-team-table-head">
              <span>Участник</span>
              <span>Роль</span>
              <span />
            </div>
            {team.map((member, index) => (
              <div className="ec-settings-member-row" key={member.id}>
                <div className="ec-settings-member">
                  <span
                    className={`ec-settings-avatar ec-settings-avatar-${index % 4}`}
                  >
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                  </div>
                </div>
                <label className="ec-settings-role-select">
                  <span className="ec-settings-sr-only">
                    Роль участника {member.name}
                  </span>
                  <select
                    value={member.role}
                    onChange={(event) => changeRole(member, event.target.value)}
                  >
                    {!ROLES.includes(member.role) && (
                      <option>{member.role}</option>
                    )}
                    {ROLES.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <button
                  type="button"
                  className="ec-settings-icon-button"
                  disabled={member.role === "Владелец" && ownerCount === 1}
                  aria-label={`Удалить участника ${member.name}`}
                  title={
                    member.role === "Владелец" && ownerCount === 1
                      ? "В команде должен остаться владелец"
                      : "Удалить участника"
                  }
                  onClick={() => setRemoveMember(member)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!team.length && (
              <div className="ec-settings-empty">
                <Users size={25} />
                <h3>Соберите команду</h3>
                <p>Добавьте участников, чтобы готовить предложения вместе.</p>
              </div>
            )}
          </div>
          <div className="ec-settings-info">
            <Info size={16} />
            <p>
              В прототипе участники добавляются только в локальную демокоманду.
              Приглашения по почте не отправляются.
            </p>
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div
          id="settings-panel-billing"
          role="tabpanel"
          aria-labelledby="settings-tab-billing"
          className="ec-settings-billing-panel"
        >
          <div className="ec-settings-section-heading">
            <h2>Подписка и использование</h2>
            <p>Текущие условия рабочего пространства.</p>
          </div>
          <div className="ec-settings-current-plan">
            <div className="ec-settings-current-plan-main">
              <div>
                <span className="ec-settings-plan-label">Текущий тариф</span>
                <h3>
                  {currentPlan.name}
                  <span
                    className={`ec-settings-status ${billing.status === "trial" ? "is-trial" : ""}`}
                  >
                    {billing.status === "trial"
                      ? "Пробный период"
                      : "Активен в демо"}
                  </span>
                </h3>
                <p>
                  {billing.status === "trial"
                    ? periodEnd
                      ? `Пробный период до ${periodEnd}`
                      : "Пробный период в демонстрационном пространстве"
                    : `${money(billing.cycle === "year" ? currentPlan.price * 10 : currentPlan.price)} ${billing.cycle === "year" ? "за год" : "в месяц"}`}
                </p>
              </div>
              <button
                type="button"
                className="ec-settings-button"
                onClick={() => {
                  setCycle(billing.cycle || "month");
                  setSelectedPlan(null);
                  setPlanOpen(true);
                }}
              >
                Изменить тариф
                <ArrowRight size={15} />
              </button>
            </div>
            {scheduledName && (
              <div className="ec-settings-scheduled">
                <Info size={16} />
                <p>
                  Переход на «{scheduledName}»
                  {billing.scheduledCycle === "year" ? ", годовой период" : ""}{" "}
                  {periodEnd ? `с ${periodEnd}` : "после текущего периода"}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onBillingChange?.({
                      ...billing,
                      scheduledTier: null,
                      scheduledCycle: null,
                    });
                    announce("Запланированный переход отменён.");
                  }}
                >
                  Отменить переход
                </button>
              </div>
            )}
            {billing.cancelAtPeriodEnd && (
              <div className="ec-settings-scheduled">
                <Info size={16} />
                <p>Продление отключено в демо. Текущий тариф сохранён.</p>
                <button
                  type="button"
                  onClick={() => {
                    onBillingChange?.({ ...billing, cancelAtPeriodEnd: false });
                    announce("Продление восстановлено в демо.");
                  }}
                >
                  Вернуть продление
                </button>
              </div>
            )}
          </div>
          <h3 className="ec-settings-usage-title">
            Использование <span>Учебные данные</span>
          </h3>
          <div className="ec-settings-usage-grid">
            {[
              {
                title: "Сотрудники",
                value: team.length,
                limit: currentPlan.members,
                unit: "",
              },
              {
                title: "Опубликованные КП",
                value: publishedCount,
                limit: currentPlan.proposals,
                unit: "",
              },
              {
                title: "Материалы",
                value: 0.4,
                limit: currentPlan.storage,
                unit: " ГБ",
              },
            ].map((item) => (
              <div key={item.title} className="ec-settings-usage-item">
                <span>{item.title}</span>
                <strong>
                  {String(item.value).replace(".", ",")}
                  {item.unit}{" "}
                  <small>
                    из {item.limit}
                    {item.unit}
                  </small>
                </strong>
                <div
                  className="ec-settings-meter"
                  role="meter"
                  aria-label={item.title}
                  aria-valuenow={item.value}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(item.limit, item.value)}
                >
                  <span
                    style={{
                      width: `${Math.min(100, (item.value / item.limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="ec-settings-info">
            <Info size={16} />
            <p>
              Демонстрационные тарифы. Оплата не проводится, платёжные данные не
              запрашиваются. Лимиты показаны для проверки интерфейса.
            </p>
          </div>
          <div className="ec-settings-billing-actions">
            <div>
              <h3>
                {billing.status === "trial"
                  ? "Завершение пробного периода"
                  : "Продление подписки"}
              </h3>
              <p>
                {billing.cancelAtPeriodEnd
                  ? "Запланированную отмену можно отменить в любой момент."
                  : "Изменение продления сначала потребует подтверждения."}
              </p>
            </div>
            <button
              type="button"
              className="ec-settings-text-button ec-settings-danger-text"
              disabled={!!billing.cancelAtPeriodEnd}
              onClick={() => setCancelOpen(true)}
            >
              {billing.cancelAtPeriodEnd
                ? "Завершение запланировано"
                : billing.status === "trial"
                  ? "Запланировать завершение"
                  : "Отменить продление"}
            </button>
          </div>
        </div>
      )}

      <div className="ec-settings-reset">
        <div>
          <h3>Начать демонстрацию заново</h3>
          <p>Очистить локальные данные и вернуться к первому входу.</p>
        </div>
        <button
          type="button"
          className="ec-settings-button"
          onClick={() => setResetOpen(true)}
        >
          <RotateCcw size={14} />
          Сбросить демо
        </button>
      </div>

      <SettingsDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Пригласить участника"
        description="Добавьте человека в учебное пространство. Письмо не отправляется."
      >
        <form onSubmit={addMember} className="ec-settings-dialog-form">
          <label className="ec-settings-field">
            Имя
            <input
              autoFocus
              value={invite.name}
              maxLength={70}
              onChange={(event) =>
                setInvite({ ...invite, name: event.target.value })
              }
              placeholder="Александр Соколов"
              required
            />
          </label>
          <label className="ec-settings-field">
            Электронная почта
            <input
              type="email"
              value={invite.email}
              maxLength={150}
              onChange={(event) =>
                setInvite({ ...invite, email: event.target.value })
              }
              placeholder="alex@example.test"
              required
            />
          </label>
          <label className="ec-settings-field">
            Роль
            <select
              value={invite.role}
              onChange={(event) =>
                setInvite({ ...invite, role: event.target.value })
              }
            >
              {ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          {inviteError && (
            <p className="ec-settings-error" role="alert">
              {inviteError}
            </p>
          )}
          <div className="ec-settings-dialog-footer">
            <button
              type="button"
              className="ec-settings-button"
              onClick={() => setInviteOpen(false)}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="ec-settings-button ec-settings-primary"
            >
              <Plus size={15} />
              Добавить участника
            </button>
          </div>
        </form>
      </SettingsDialog>

      <SettingsDialog
        open={!!removeMember}
        onOpenChange={(open) => {
          if (!open) setRemoveMember(null);
        }}
        title="Удалить участника?"
        description={`${removeMember?.name || "Участник"} больше не будет в демокоманде. Предложения останутся в рабочем пространстве.`}
      >
        <div className="ec-settings-dialog-footer">
          <button
            type="button"
            className="ec-settings-button"
            onClick={() => setRemoveMember(null)}
          >
            Оставить
          </button>
          <button
            type="button"
            className="ec-settings-button ec-settings-danger"
            onClick={() => {
              onTeamChange?.(
                team.filter((member) => member.id !== removeMember.id),
              );
              setRemoveMember(null);
              announce("Участник удалён из демокоманды.");
            }}
          >
            Удалить участника
          </button>
        </div>
      </SettingsDialog>

      <SettingsDialog
        open={planOpen}
        onOpenChange={(open) => {
          setPlanOpen(open);
          if (!open) setSelectedPlan(null);
        }}
        title={
          selectedPlan
            ? scheduleChange
              ? "Запланировать смену тарифа"
              : "Подтвердить выбор тарифа"
            : "Выберите тариф"
        }
        description="Демонстрационные тарифы. Оплата не проводится."
        wide={!selectedPlan}
      >
        {!selectedPlan ? (
          <>
            <div className="ec-settings-plan-toolbar">
              <p>
                Все суммы в рублях. Выбранный период виден до подтверждения.
              </p>
              <div
                className="ec-settings-cycle"
                role="group"
                aria-label="Период подписки"
              >
                <button
                  type="button"
                  aria-pressed={cycle === "month"}
                  onClick={() => setCycle("month")}
                >
                  Месяц
                </button>
                <button
                  type="button"
                  aria-pressed={cycle === "year"}
                  onClick={() => setCycle("year")}
                >
                  Год <span>−17%</span>
                </button>
              </div>
            </div>
            <div className="ec-settings-plans">
              {PLANS.map((plan) => {
                const same =
                  plan.name === currentPlan.name &&
                  cycle === (billing.cycle || "month");
                return (
                  <article
                    className={`ec-settings-plan-card${plan.name === currentPlan.name ? " is-current" : ""}`}
                    key={plan.name}
                  >
                    <div className="ec-settings-plan-card-title">
                      <h3>{plan.name}</h3>
                      {plan.name === currentPlan.name && <span>Текущий</span>}
                    </div>
                    <p className="ec-settings-plan-summary">{plan.summary}</p>
                    <div className="ec-settings-price">
                      {money(plan.price * (cycle === "year" ? 10 : 1))}
                      <span>/{cycle === "year" ? "год" : "месяц"}</span>
                    </div>
                    <p className="ec-settings-price-note">
                      {cycle === "year"
                        ? `≈ ${money((plan.price * 10) / 12)} в месяц · весь год одним платежом`
                        : "Ежемесячный период"}
                    </p>
                    <ul>
                      {plan.features.map((feature) => (
                        <li key={feature}>
                          <Check size={15} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={`ec-settings-button${plan.name !== currentPlan.name ? " ec-settings-primary" : ""}`}
                      disabled={same}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      {same ? "Ваш тариф" : `Выбрать «${plan.name}»`}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="ec-settings-confirm-plan">
            <button
              type="button"
              className="ec-settings-text-button"
              onClick={() => setSelectedPlan(null)}
            >
              <ArrowLeft size={14} />К сравнению тарифов
            </button>
            <div className="ec-settings-plan-comparison">
              <span>{currentPlan.name}</span>
              <ArrowRight size={18} />
              <strong>{selectedPlan.name}</strong>
            </div>
            <dl>
              <div>
                <dt>Период</dt>
                <dd>{cycle === "year" ? "Год" : "Месяц"}</dd>
              </div>
              <div>
                <dt>Стоимость периода</dt>
                <dd>
                  {money(selectedPlan.price * (cycle === "year" ? 10 : 1))}
                </dd>
              </div>
              <div>
                <dt>Изменение вступит</dt>
                <dd>
                  {scheduleChange
                    ? periodEnd || "После текущего периода"
                    : "Сейчас, в демонстрации"}
                </dd>
              </div>
              <div>
                <dt>К оплате сейчас</dt>
                <dd>0 ₽ — демонстрация</dd>
              </div>
            </dl>
            {isDowngrade && (
              <div className="ec-settings-info">
                <Info size={16} />
                <p>
                  Новые лимиты: {selectedPlan.members} сотрудника,{" "}
                  {selectedPlan.proposals} КП, {selectedPlan.storage} ГБ.{" "}
                  {scheduleChange
                    ? "Понижение запланируется на конец периода."
                    : "Выбор применится сразу в демонстрации."}{" "}
                  Текущие материалы не удаляются.
                </p>
              </div>
            )}
            <div className="ec-settings-dialog-footer">
              <button
                type="button"
                className="ec-settings-button"
                onClick={() => setPlanOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ec-settings-button ec-settings-primary"
                onClick={confirmPlan}
              >
                {scheduleChange ? "Запланировать в демо" : "Применить в демо"}
              </button>
            </div>
          </div>
        )}
      </SettingsDialog>

      <SettingsDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Отключить продление в демо?"
        description="В учебном сценарии будет отмечена отмена продления. Оплата не проводится, текущие материалы сохраняются."
      >
        <div className="ec-settings-confirm-copy">
          <p>
            Тариф «{currentPlan.name}» останется текущим. Вы сможете вернуть
            продление здесь же.
          </p>
          {periodEnd && (
            <p>
              Окончание текущего периода: <strong>{periodEnd}</strong>.
            </p>
          )}
        </div>
        <div className="ec-settings-dialog-footer">
          <button
            type="button"
            className="ec-settings-button"
            onClick={() => setCancelOpen(false)}
          >
            Оставить продление
          </button>
          <button
            type="button"
            className="ec-settings-button ec-settings-danger"
            onClick={() => {
              onBillingChange?.({
                ...billing,
                cancelAtPeriodEnd: true,
                scheduledTier: null,
                scheduledCycle: null,
              });
              setCancelOpen(false);
              announce("Продление отключено в демонстрации.");
            }}
          >
            Отключить в демо
          </button>
        </div>
      </SettingsDialog>

      <SettingsDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Очистить локальное демо?"
        description="Учебные предложения, личные варианты и настройки будут удалены из этого браузера. Вы вернётесь к первому входу. Это действие нельзя отменить."
      >
        <div className="ec-settings-dialog-footer">
          <button
            type="button"
            className="ec-settings-button"
            onClick={() => setResetOpen(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="ec-settings-button ec-settings-danger"
            onClick={() => {
              setResetOpen(false);
              onReset?.();
            }}
          >
            Сбросить демонстрацию
          </button>
        </div>
      </SettingsDialog>
    </section>
  );
}
