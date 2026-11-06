# Prototype Instructions

## Устойчивые требования к интерфейсу

Владелец поручил подготовить рабочий прототип полного пути и провести 10–20 внутренних циклов проверки. Используется спокойная светлая система из DESIGN.md, один-два уровня навигации, прямое редактирование и понятные русские подписи. Предыдущие визуальные подборки не утверждены; не выдавать их за согласованный окончательный дизайн.

Новые варианты дизайна и технические настройки не должны заменять проверку работающих экранов. Отделять частный план клиента, черновик агентства, опубликованный выпуск, неотправленное сообщение и отправленный ответ. Сохранение варианта не открывает отправку автоматически. Восстанавливать сообщение вместе с его темой и выбранным приложением. Не возвращать «учтено» после Undo автоматически.

Все демонстрации — на синтетических данных. Локальный код входа и visitorId не являются безопасностью SaaS. Не подключать production-данные и платежи в рамках проверки прототипа.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
