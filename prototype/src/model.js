import { createDefaultScene } from "./sceneModel.js";
export const STORAGE_KEY = "eventcraft-prototype-v1";
export const uid = () => crypto.randomUUID();
export const clone = (v) => structuredClone(v);
export const money = (v) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v);
export const dateLabel = (v) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Дата уточняется";
export function total(p) {
  const rows = p.estimate.filter((r) => r.name.trim() && r.included !== false);
  return {
    amount: rows.reduce(
      (s, r) => s + (Number(r.quantity) || 0) * (Number(r.price) || 0),
      0,
    ),
    partial:
      !rows.length || rows.some((r) => r.price === null || r.quantity === null),
    count: rows.length,
  };
}
export function createProposal(kind = "blank") {
  const p = {
    id: uid(),
    title: "",
    client: "",
    date: "",
    guests: null,
    intro: "",
    image: "",
    sections: ["cover", "idea", "program", "estimate"],
    program: [],
    estimate: [],
    venue: null,
    scene: null,
    teamText: "",
    updatedAt: Date.now(),
    archived: false,
    releases: [],
    permissions: { questions: true, layout: false },
    code: "2468",
    revision: 0,
    touched: false,
  };
  if (kind !== "blank")
    Object.assign(p, {
      title:
        kind === "team"
          ? "Командный день"
          : kind === "conference"
            ? "Встреча партнёров"
            : "Зимний вечер",
      client: "Компания «Вектор»",
      date: kind === "team" ? "2026-11-26" : "2026-12-18",
      guests: 80,
      intro:
        kind === "team"
          ? "Общий день вне привычных ролей: командная игра, живое общение и финал, который объединяет. Программа адаптируется под задачи вашей команды."
          : "Вечер для команды: тёплая встреча, общая история и пространство для общения. Соединим программу и ужин в одном продуманном событии.",
      image: kind === "team" ? "/images/team.jpg" : "/images/evening.jpg",
      program: [
        {
          id: uid(),
          time: "17:00",
          title: "Встреча гостей",
          description: "Знакомство, приветственные напитки",
        },
        {
          id: uid(),
          time: "18:00",
          title: kind === "team" ? "Командная игра" : "Общая программа",
          description: "Механика под вашу команду",
        },
        {
          id: uid(),
          time: "20:00",
          title: "Ужин и свободное общение",
          description: "Завершаем день вместе",
        },
      ],
      estimate: [
        {
          id: uid(),
          name: "Разработка и проведение программы",
          quantity: 1,
          price: 120000,
          included: true,
        },
        {
          id: uid(),
          name: "Питание",
          quantity: 80,
          price: 2500,
          included: true,
        },
        {
          id: uid(),
          name: "Фотограф",
          quantity: 1,
          price: 25000,
          included: true,
        },
      ],
      touched: true,
    });
  if (kind === "conference")
    Object.assign(p, {
      intro:
        "Деловая встреча, которая помогает обменяться опытом и договориться о следующих шагах. Короткие выступления, работа в группах и время для знакомства.",
      image: "/images/venue.jpg",
      program: [
        {
          id: uid(),
          time: "10:00",
          title: "Регистрация и кофе",
          description: "Встречаем участников, знакомимся с программой",
        },
        {
          id: uid(),
          time: "10:30",
          title: "Выступления и дискуссия",
          description: "Практика, кейсы и вопросы участников",
        },
        {
          id: uid(),
          time: "13:00",
          title: "Обед и общение",
          description: "Продолжаем обсуждение в свободном формате",
        },
      ],
      estimate: [
        {
          id: uid(),
          name: "Организация деловой программы",
          quantity: 1,
          price: 90000,
          included: true,
        },
        {
          id: uid(),
          name: "Кофе и обед",
          quantity: 80,
          price: 1200,
          included: true,
        },
        {
          id: uid(),
          name: "Техническое оснащение",
          quantity: 1,
          price: null,
          included: true,
        },
      ],
    });
  return p;
}
const numeric = (v) =>
  (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) &&
  Number.isFinite(Number(v));
export function publicationIssues(p) {
  const issues = [];
  if (!p.title.trim()) issues.push("Добавьте название предложения");
  const visible = p.sections;
  if (
    !(visible.includes("idea") && p.intro.trim()) &&
    !(visible.includes("program") && p.program.some((r) => r.title.trim())) &&
    !(visible.includes("estimate") && p.estimate.some((r) => r.name.trim())) &&
    !(visible.includes("team") && p.teamText.trim())
  )
    issues.push(
      "Добавьте идею, программу или состав предложения в видимый раздел",
    );
  for (const r of p.estimate.filter(
    (r) => r.name.trim() && r.included !== false,
  )) {
    if (
      r.quantity !== null &&
      (!numeric(r.quantity) || Number(r.quantity) <= 0)
    )
      issues.push(`Проверьте количество: ${r.name}`);
    if (r.price !== null && (!numeric(r.price) || Number(r.price) < 0))
      issues.push(`Проверьте цену: ${r.name}`);
  }
  if (p.guests !== null && (!Number.isInteger(p.guests) || p.guests <= 0))
    issues.push("Число гостей должно быть целым и больше нуля");
  return [...new Set(issues)];
}
const pick = (v, keys) =>
  Object.fromEntries(
    keys.filter((k) => v[k] !== undefined).map((k) => [k, v[k]]),
  );
export function publicDocument(p, a) {
  return clone({
    title: p.title,
    client: p.client,
    date: p.date,
    guests: p.guests,
    intro: p.sections.includes("idea") ? p.intro : "",
    image: p.image,
    sections: p.sections,
    program: (p.sections.includes("program") ? p.program : [])
      .filter((r) => r.title.trim())
      .map((r) => pick(r, ["id", "time", "title", "description"])),
    estimate: (p.sections.includes("estimate") ? p.estimate : [])
      .filter((r) => r.name.trim())
      .map((r) => pick(r, ["id", "name", "quantity", "price", "included"])),
    venue:
      p.sections.includes("venue") && p.venue
        ? pick(p.venue, [
            "id",
            "name",
            "city",
            "description",
            "kind",
            "image",
            "hasScene",
          ])
        : null,
    scene:
      p.sections.includes("venue") && p.scene
        ? {
            items: p.scene.items.map((r) =>
              pick(r, ["id", "type", "x", "z", "rotation", "width", "depth"]),
            ),
            expectedGuests: p.guests,
          }
        : null,
    teamText: p.sections.includes("team") ? p.teamText : "",
    permissions: {
      questions: !!p.permissions.questions,
      layout:
        !!p.permissions.layout && !!p.scene && p.sections.includes("venue"),
    },
    brand: {
      name: a.name,
      accent: a.accent || "#4f46e5",
      logo: a.logo || "",
      email: a.email || "",
      phone: a.phone || "",
    },
  });
}
export function publish(p, a) {
  const issues = publicationIssues(p);
  if (issues.length) throw new Error(issues[0]);
  const r = {
    id: uid(),
    number: p.releases.length + 1,
    createdAt: Date.now(),
    revision: p.revision,
    document: publicDocument(p, a),
  };
  return { ...p, releases: [...p.releases, r] };
}
export function initialState(demo = false) {
  const agency = demo
    ? {
        name: "Студия Север",
        accent: "#4f46e5",
        email: "hello@example.test",
        phone: "+7 (000) 000-00-00",
      }
    : null;
  let proposals = [],
    requests = [];
  if (demo) {
    let p = createProposal("evening");
    p.scene = createDefaultScene();
    p.venue = {
      id: "north",
      name: "Учебный зал «Север»",
      city: "Омск",
      description:
        "Демонстрационный зал 16 × 12 м. Геометрия учебная, не модель реальной площадки.",
      kind: "hall",
      image: "/images/venue.jpg",
      hasScene: true,
    };
    p.sections.splice(3, 0, "venue");
    p.permissions.layout = true;
    p = publish(p, agency);
    proposals = [p, createProposal("team"), createProposal("conference")];
    requests = [
      {
        id: uid(),
        proposalId: p.id,
        releaseId: p.releases[0].id,
        author: "Елена",
        text: "Можно освободить больше места перед сценой? Хотим завершить вечер общим танцем.",
        section: "venue",
        createdAt: Date.now() - 1800000,
        status: "open",
        reply: "",
        scene: null,
      },
    ];
  }
  return {
    schema: 1,
    agency,
    team: demo
      ? [
          {
            id: uid(),
            name: "Анна Морозова",
            email: "anna@example.test",
            role: "Владелец",
          },
        ]
      : [],
    billing: {
      tier: "Команда",
      cycle: "month",
      status: "trial",
      trialEnd: "2026-11-20",
    },
    proposals,
    requests,
  };
}
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v, keys) =>
  object(v) && keys.every((k) => typeof v[k] === "string");
const sceneShape = (v) =>
  v === null ||
  (object(v) &&
    Array.isArray(v.items) &&
    v.items.every(
      (i) =>
        strings(i, ["id", "type"]) &&
        ["roundTable", "banquetTable", "chair", "stage", "dancefloor"].includes(
          i.type,
        ) &&
        ["x", "z", "rotation", "width", "depth"].every(
          (k) => typeof i[k] === "number" && Number.isFinite(i[k]),
        ),
    ));
function documentShape(v) {
  return (
    strings(v, ["title", "client", "date", "intro", "image", "teamText"]) &&
    Array.isArray(v.sections) &&
    v.sections.every((s) =>
      ["cover", "idea", "program", "venue", "team", "estimate"].includes(s),
    ) &&
    Array.isArray(v.program) &&
    v.program.every((r) =>
      strings(r, ["id", "title", "time", "description"]),
    ) &&
    Array.isArray(v.estimate) &&
    v.estimate.every(
      (r) =>
        strings(r, ["id", "name"]) &&
        [r.quantity, r.price].every((n) => n === null || typeof n === "number"),
    ) &&
    sceneShape(v.scene) &&
    (v.venue === null || strings(v.venue, ["name", "description"])) &&
    object(v.permissions) &&
    typeof v.permissions.questions === "boolean" &&
    typeof v.permissions.layout === "boolean"
  );
}
function storedShape(d) {
  return (
    object(d) &&
    d.schema === 1 &&
    (d.agency === null ||
      strings(d.agency, ["name", "accent", "email", "phone"])) &&
    Array.isArray(d.team) &&
    d.team.every((v) => strings(v, ["id", "name", "email", "role"])) &&
    strings(d.billing, ["tier", "cycle", "status"]) &&
    Array.isArray(d.proposals) &&
    d.proposals.every(
      (p) =>
        strings(p, ["id", "code"]) &&
        documentShape(p) &&
        Array.isArray(p.releases) &&
        p.releases.every(
          (r) =>
            strings(r, ["id"]) &&
            typeof r.number === "number" &&
            documentShape(r.document) &&
            strings(r.document.brand, ["name", "accent", "email", "phone"]),
        ),
    ) &&
    Array.isArray(d.requests) &&
    d.requests.every(
      (r) =>
        strings(r, [
          "id",
          "proposalId",
          "releaseId",
          "author",
          "text",
          "status",
          "reply",
        ]) && sceneShape(r.scene),
    )
  );
}
export function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: initialState(), error: null };
    const data = JSON.parse(raw);
    if (!storedShape(data)) throw Error();
    return { data, error: null };
  } catch {
    return {
      data: initialState(),
      error:
        "Не удалось восстановить сохранённое демо. Исходные данные не перезаписаны.",
    };
  }
}
