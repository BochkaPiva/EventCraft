import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { projectClientSnapshot, type DraftDocument } from "@eventcraft/core";
import { ClientDocument } from "../src/components/proposal-preview.tsx";

test("client preview renders only projected content, keeps unknown costs explicit and escapes text", () => {
  const document: DraftDocument = {
    schemaVersion: 1,
    blocks: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        type: "text",
        heading: "Идея",
        body: '<script>alert("x")</script>\nВторая строка',
        visible: true,
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        type: "text",
        heading: "Скрытый раздел",
        body: "SECRET_HIDDEN",
        visible: false,
      },
      {
        id: "10000000-0000-4000-8000-000000000003",
        type: "program",
        heading: "Программа",
        visible: true,
        items: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            time: "10:00",
            title: "Конференция",
            description: "Деловая часть",
          },
          {
            id: "20000000-0000-4000-8000-000000000002",
            time: null,
            title: "Ужин",
            description: "Время уточним",
          },
        ],
      },
      {
        id: "10000000-0000-4000-8000-000000000004",
        type: "estimate",
        heading: "Стоимость",
        visible: true,
        lines: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            description: "Программа",
            quantityThousandths: 1000,
            unitPriceMinor: 12345,
            included: true,
            unitCostMinor: 999,
            internalNote: "SECRET_INTERNAL",
          },
          {
            id: "30000000-0000-4000-8000-000000000002",
            description: "Площадка",
            quantityThousandths: 1000,
            unitPriceMinor: null,
            included: true,
          },
          {
            id: "30000000-0000-4000-8000-000000000003",
            description: "Дополнительная услуга",
            quantityThousandths: 1000,
            unitPriceMinor: 50000,
            included: false,
          },
        ],
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(ClientDocument, {
      snapshot: projectClientSnapshot(
        { title: "Предложение", document },
        { name: "Пример", accent: "#4f46e5" },
      ),
    }),
  );
  for (const privateValue of [
    "SECRET_HIDDEN",
    "Скрытый раздел",
    "SECRET_INTERNAL",
    "unitCostMinor",
    "internalNote",
  ])
    assert.equal(html.includes(privateValue), false);
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Время уточняется"));
  assert.ok(html.indexOf("Конференция") < html.indexOf("Ужин"));
  assert.ok(html.includes("Известная часть стоимости"));
  assert.ok(html.includes("цена уточняется"));
  assert.ok(html.includes("123,45"));
  assert.ok(html.includes("500,00"));
  assert.ok(html.includes("не включено в итог"));
});
