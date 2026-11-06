import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Armchair,
  ArrowRight,
  Box,
  Building2,
  Check,
  Circle,
  FileText,
  Info,
  MapPin,
  Ruler,
  Search,
  Sofa,
  Table2,
  Trees,
  Users,
  X,
} from "lucide-react";
import "./library.css";

const VENUES = [
  {
    id: "north-hall",
    name: "Север",
    city: "Омск",
    description:
      "Светлый универсальный зал для встреч, конференций и командных событий.",
    kind: "hall",
    image: "/images/venue.jpg",
    hasScene: true,
    detail:
      "Учебный зал 16 × 12 м. План, объёмный вид и прогулка используют одну расстановку. Размеры относятся к демонстрационной геометрии.",
    tags: ["Зал", "16 × 12 м", "Есть 3D"],
  },
  {
    id: "lake-park",
    name: "Парк у озера",
    city: "Омск",
    description:
      "Открытое пространство для командной программы на свежем воздухе.",
    kind: "outdoor",
    image: "/images/team.jpg",
    hasScene: false,
    detail:
      "Для предложения доступны описание и фотография. Точные границы, покрытие и размеры здесь не измерены; пространственный план не подготовлен.",
    tags: ["На открытом воздухе", "Без точного плана"],
  },
];
const FURNITURE = [
  {
    id: "round-table",
    name: "Банкетный комплект",
    group: "Столы",
    Icon: Table2,
    size: "Стол Ø 1,5 м · высота 0,75 м",
    seats: "10 мест",
    detail:
      "Круглый стол и 10 стульев. Места считаются один раз за комплект. Размер столешницы фиксирован.",
    note: "Стол и 10 стульев",
    color: "sand",
  },
  {
    id: "chair",
    name: "Стул для мероприятий",
    group: "Сиденья",
    Icon: Armchair,
    size: "0,45 × 0,5 × 0,85 м",
    seats: "1 место",
    detail:
      "Отдельный стул с фиксированными габаритами. Для проходов и размещения учитывается занимаемая площадь.",
    note: "Один предмет",
    color: "blue",
  },
  {
    id: "cocktail-table",
    name: "Коктейльный стол",
    group: "Столы",
    Icon: Circle,
    size: "Ø 0,7 м · высота 1,1 м",
    seats: "Без посадочных мест",
    detail:
      "Высокий стол для фуршетной зоны. Сам по себе не увеличивает количество сидячих мест.",
    note: "Для фуршетной зоны",
    color: "green",
  },
  {
    id: "sofa",
    name: "Трёхместный диван",
    group: "Сиденья",
    Icon: Sofa,
    size: "2,1 × 0,85 × 0,8 м",
    seats: "3 места",
    detail:
      "Диван с фиксированными размерами для лаунж-зоны. Не растягивается в редакторе как свободная зона.",
    note: "Для зоны общения",
    color: "purple",
  },
];
const MATERIALS = [
  {
    id: "team",
    name: "Командная программа",
    image: "/images/team.jpg",
    label: "Тимбилдинг",
    description:
      "Задача команды, активности и программа дня. Можно начать без площадки.",
  },
  {
    id: "conference",
    name: "Деловая встреча",
    image: "/images/venue.jpg",
    label: "Конференция",
    description: "Сессии, выступления и пространство для общения участников.",
  },
  {
    id: "evening",
    name: "Вечер для команды",
    image: "/images/evening.jpg",
    label: "Корпоративный вечер",
    description: "Идея вечера, программа, питание и предварительный расчёт.",
  },
];

export default function LibraryView({
  onUseVenue,
  onUseTemplate,
  embedded = false,
}) {
  const [category, setCategory] = useState("venues");
  const [query, setQuery] = useState("");
  const [furnitureGroup, setFurnitureGroup] = useState("Все");
  const [detail, setDetail] = useState(null);
  const normalized = query.trim().toLocaleLowerCase("ru");
  const matches = (item) =>
    [
      item.name,
      item.city,
      item.description,
      item.label,
      item.group,
      ...(item.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru")
      .includes(normalized);
  const venues = VENUES.filter(matches);
  const furniture = FURNITURE.filter(
    (item) =>
      matches(item) &&
      (furnitureGroup === "Все" || item.group === furnitureGroup),
  );
  const materials = MATERIALS.filter(matches);
  const count =
    category === "venues"
      ? venues.length
      : category === "furniture"
        ? furniture.length
        : materials.length;

  function changeCategory(value) {
    setCategory(value);
    setQuery("");
  }
  function navigateTabs(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const keys = ["venues", "furniture", "materials"];
    const index = keys.indexOf(category);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? keys.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + keys.length) %
            keys.length;
    changeCategory(keys[next]);
    event.currentTarget.parentElement
      .querySelectorAll('[role="tab"]')
      [next]?.focus();
  }
  function useVenue(venue) {
    setDetail(null);
    onUseVenue?.({
      id: venue.id,
      name: venue.name,
      city: venue.city,
      description: venue.description,
      kind: venue.kind,
      image: venue.image,
      hasScene: venue.hasScene,
    });
  }

  return (
    <section className={`ec-library${embedded ? " ec-library-embedded" : ""}`}>
      {!embedded && (
        <header className="ec-library-page-heading">
          <h1>Библиотека</h1>
          <p>Площадки, мебель и заготовки для ваших предложений.</p>
        </header>
      )}
      {!embedded && (
        <div
          className="ec-library-tabs"
          role="tablist"
          aria-label="Разделы библиотеки"
        >
          {[
            ["venues", Building2, "Площадки"],
            ["furniture", Armchair, "Мебель"],
            ["materials", FileText, "Материалы"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              id={`library-tab-${id}`}
              role="tab"
              aria-selected={category === id}
              aria-controls={`library-panel-${id}`}
              tabIndex={category === id ? 0 : -1}
              onKeyDown={navigateTabs}
              onClick={() => changeCategory(id)}
            >
              <Icon size={16} />
              {label}
              <span>
                {id === "venues"
                  ? VENUES.length
                  : id === "furniture"
                    ? FURNITURE.length
                    : MATERIALS.length}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="ec-library-toolbar">
        <label className="ec-library-search">
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              category === "venues"
                ? "Найти площадку или город"
                : category === "furniture"
                  ? "Найти мебель"
                  : "Найти программу или формат"
            }
            aria-label="Поиск в библиотеке"
          />
          {query && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <span className="ec-library-ownership">
          Учебная библиотека агентства
        </span>
      </div>

      {category === "venues" && (
        <div
          id="library-panel-venues"
          role={embedded ? undefined : "tabpanel"}
          aria-labelledby={embedded ? undefined : "library-tab-venues"}
        >
          <div className="ec-library-section-label">
            <span>Доступные площадки</span>
            <span>{venues.length}</span>
          </div>
          <div className="ec-library-venue-grid">
            {venues.map((venue) => (
              <article className="ec-library-venue-card" key={venue.id}>
                <button
                  type="button"
                  className="ec-library-venue-image"
                  onClick={() => setDetail({ type: "venue", item: venue })}
                  aria-label={`Подробнее о площадке ${venue.name}`}
                >
                  <img
                    src={venue.image}
                    alt={
                      venue.kind === "hall"
                        ? "Светлый зал с естественным освещением"
                        : "Командная программа на открытом воздухе"
                    }
                  />
                  <span
                    className={`ec-library-scene-label${venue.hasScene ? " has-scene" : ""}`}
                  >
                    {venue.hasScene ? <Box size={13} /> : <Trees size={13} />}
                    {venue.hasScene
                      ? "Учебная 3D-сцена"
                      : "Без точной геометрии"}
                  </span>
                </button>
                <div className="ec-library-card-body">
                  <div className="ec-library-card-heading">
                    <h2>{venue.name}</h2>
                    <span>
                      <MapPin size={13} />
                      {venue.city}
                    </span>
                  </div>
                  <p>{venue.description}</p>
                  <div className="ec-library-venue-properties">
                    {venue.hasScene ? (
                      <>
                        <span>
                          <Ruler size={14} />
                          16 × 12 м
                        </span>
                        <span>192 м²</span>
                      </>
                    ) : (
                      <span>
                        <Trees size={14} />
                        Открытая площадка
                      </span>
                    )}
                  </div>
                  <div className="ec-library-card-footer">
                    <button
                      type="button"
                      className="ec-library-text-button"
                      onClick={() => setDetail({ type: "venue", item: venue })}
                    >
                      Подробнее
                    </button>
                    <button
                      type="button"
                      className="ec-library-button ec-library-primary"
                      onClick={() => useVenue(venue)}
                    >
                      Использовать
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="ec-library-note">
            <Info size={16} />
            <p>
              Это примеры для демонстрации. Добавление площадки в КП не означает
              бронирование. Общедоступный каталог и проверка реальных обмеров
              здесь не представлены.
            </p>
          </div>
        </div>
      )}

      {category === "furniture" && (
        <div
          id="library-panel-furniture"
          role="tabpanel"
          aria-labelledby="library-tab-furniture"
        >
          <div className="ec-library-furniture-toolbar">
            <div
              className="ec-library-filter-group"
              role="group"
              aria-label="Категории мебели"
            >
              {["Все", "Столы", "Сиденья"].map((group) => (
                <button
                  key={group}
                  type="button"
                  aria-pressed={furnitureGroup === group}
                  onClick={() => setFurnitureGroup(group)}
                >
                  {group}
                </button>
              ))}
            </div>
            <p>Габариты фиксированы</p>
          </div>
          <div className="ec-library-furniture-grid">
            {furniture.map((item) => (
              <article className="ec-library-furniture-card" key={item.id}>
                <div className={`ec-library-furniture-visual is-${item.color}`}>
                  <item.Icon size={56} strokeWidth={1.1} />
                  <span>{item.group}</span>
                </div>
                <div className="ec-library-furniture-content">
                  <h2>{item.name}</h2>
                  <p>{item.note}</p>
                  <dl>
                    <div>
                      <dt>
                        <Ruler size={13} />
                        Размеры
                      </dt>
                      <dd>{item.size}</dd>
                    </div>
                    <div>
                      <dt>
                        <Users size={13} />
                        Посадка
                      </dt>
                      <dd>{item.seats}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="ec-library-button"
                    onClick={() => setDetail({ type: "furniture", item })}
                  >
                    Сведения о предмете
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="ec-library-note">
            <Info size={16} />
            <p>
              Добавляйте предметы в расстановку из редактора зала. Здесь можно
              изучить учебный каталог; наличие у подрядчика и бронирование не
              проверяются.
            </p>
          </div>
        </div>
      )}

      {category === "materials" && (
        <div
          id="library-panel-materials"
          role="tabpanel"
          aria-labelledby="library-tab-materials"
        >
          <div className="ec-library-section-label">
            <span>Готовые заготовки</span>
            <span>Для начала нового КП</span>
          </div>
          <div className="ec-library-material-grid">
            {materials.map((material) => (
              <article className="ec-library-material-card" key={material.id}>
                <img src={material.image} alt="" />
                <div className="ec-library-material-content">
                  <span className="ec-library-material-label">
                    {material.label}
                  </span>
                  <h2>{material.name}</h2>
                  <p>{material.description}</p>
                  <button
                    type="button"
                    className="ec-library-button"
                    onClick={() => onUseTemplate?.(material.id)}
                  >
                    Создать КП
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="ec-library-note">
            <Check size={16} />
            <p>
              Заготовка создаёт отдельный черновик. Тексты, состав и расчёт
              можно изменить под задачу клиента.
            </p>
          </div>
        </div>
      )}

      {count === 0 && (
        <div className="ec-library-empty">
          <Search size={28} strokeWidth={1.5} />
          <h2>Ничего не найдено</h2>
          <p>
            Попробуйте другое название
            {category === "furniture"
              ? " или выберите другую категорию мебели"
              : ""}
            .
          </p>
          <button
            type="button"
            className="ec-library-button"
            onClick={() => {
              setQuery("");
              setFurnitureGroup("Все");
            }}
          >
            Сбросить поиск
          </button>
        </div>
      )}

      <Dialog.Root
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="ec-library-overlay" />
          <Dialog.Content className="ec-library-dialog">
            <div className="ec-library-dialog-top">
              <Dialog.Title>{detail?.item.name}</Dialog.Title>
              <Dialog.Close
                className="ec-library-icon-button"
                aria-label="Закрыть сведения"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="ec-library-dialog-description">
              {detail?.type === "venue"
                ? "Площадка из учебной библиотеки агентства"
                : "Предмет из учебного каталога"}
            </Dialog.Description>
            {detail?.type === "venue" ? (
              <>
                <img
                  className="ec-library-detail-image"
                  src={detail.item.image}
                  alt=""
                />
                <div className="ec-library-detail-tags">
                  {detail.item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <p className="ec-library-detail-copy">{detail.item.detail}</p>
                <div className="ec-library-note">
                  <Info size={16} />
                  <p>
                    Фотография иллюстративная. Добавление примера не
                    подтверждает доступность или бронирование площадки.
                  </p>
                </div>
                <div className="ec-library-dialog-footer">
                  <Dialog.Close className="ec-library-button">
                    Закрыть
                  </Dialog.Close>
                  <button
                    type="button"
                    className="ec-library-button ec-library-primary"
                    onClick={() => useVenue(detail.item)}
                  >
                    Использовать в КП
                    <ArrowRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              detail && (
                <>
                  <div
                    className={`ec-library-detail-furniture is-${detail.item.color}`}
                  >
                    <detail.item.Icon size={62} strokeWidth={1.1} />
                  </div>
                  <p className="ec-library-detail-copy">{detail.item.detail}</p>
                  <dl className="ec-library-detail-dimensions">
                    <div>
                      <dt>Габариты</dt>
                      <dd>{detail.item.size}</dd>
                    </div>
                    <div>
                      <dt>Посадка</dt>
                      <dd>{detail.item.seats}</dd>
                    </div>
                  </dl>
                  <p className="ec-library-detail-copy">
                    Перейдите в редактор расстановки, чтобы разместить мебель в
                    зале.
                  </p>
                  <div className="ec-library-dialog-footer">
                    <Dialog.Close className="ec-library-button">
                      Понятно
                    </Dialog.Close>
                  </div>
                </>
              )
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
