import type {
  DraftDocument,
  EstimateLine,
  ProgramItem,
} from "@eventcraft/core";

export type EditorBlock = DraftDocument["blocks"][number];
export function newEditorBlock(
  type: EditorBlock["type"],
  identity?: { id: string; visible: boolean },
): EditorBlock {
  const shared = {
    id: identity?.id ?? crypto.randomUUID(),
    visible: identity?.visible ?? true,
  };
  if (type === "text") return { ...shared, type, heading: "Идея", body: "" };
  if (type === "program")
    return {
      ...shared,
      type,
      heading: "Программа",
      items: [
        { id: crypto.randomUUID(), time: null, title: "", description: "" },
      ],
    };
  return {
    ...shared,
    type,
    heading: "Расчёт",
    lines: [
      {
        id: crypto.randomUUID(),
        description: "",
        quantityThousandths: 1000,
        unitPriceMinor: null,
        included: true,
      },
    ],
  };
}
export function firstBlockField(block: EditorBlock) {
  return block.type === "text"
    ? `body-${block.id}`
    : block.type === "program"
      ? block.items[0] && `program-title-${block.items[0].id}`
      : block.lines[0] && `line-${block.lines[0].id}`;
}
const plural = new Intl.PluralRules("ru");
export function blockDescription(block: EditorBlock) {
  if (block.type === "text") return "Текст";
  const count =
    block.type === "program" ? block.items.length : block.lines.length;
  const forms =
    block.type === "program"
      ? ["этап", "этапа", "этапов"]
      : ["услуга", "услуги", "услуг"];
  const category = plural.select(count);
  return `${count} ${forms[category === "one" ? 0 : category === "few" ? 1 : 2]}`;
}
export type DeletedContent =
  | { kind: "block"; label: string; index: number; block: EditorBlock }
  | {
      kind: "line";
      label: string;
      index: number;
      blockId: string;
      line: EstimateLine;
    }
  | {
      kind: "item";
      label: string;
      index: number;
      blockId: string;
      item: ProgramItem;
    };

export function duplicateBlock(block: EditorBlock): EditorBlock {
  const copy = structuredClone(block);
  copy.id = crypto.randomUUID();
  if (copy.type === "estimate")
    copy.lines = copy.lines.map((line) => ({
      ...line,
      id: crypto.randomUUID(),
    }));
  if (copy.type === "program")
    copy.items = copy.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
  return copy;
}

// Restore only the removed object; edits made elsewhere since deletion survive.
export function restoreDeleted(
  document: DraftDocument,
  deleted: DeletedContent,
): DraftDocument | null {
  if (deleted.kind === "block") {
    if (
      document.blocks.length >= 64 ||
      document.blocks.some((block) => block.id === deleted.block.id)
    )
      return null;
    const blocks = [...document.blocks];
    blocks.splice(deleted.index, 0, deleted.block);
    return { ...document, blocks };
  }
  const block = document.blocks.find((block) => block.id === deleted.blockId);
  let restored: EditorBlock;
  if (deleted.kind === "line" && block?.type === "estimate") {
    if (
      block.lines.length >= 200 ||
      block.lines.some((line) => line.id === deleted.line.id)
    )
      return null;
    const lines = [...block.lines];
    lines.splice(deleted.index, 0, deleted.line);
    restored = { ...block, lines };
  } else if (deleted.kind === "item" && block?.type === "program") {
    if (
      block.items.length >= 200 ||
      block.items.some((item) => item.id === deleted.item.id)
    )
      return null;
    const items = [...block.items];
    items.splice(deleted.index, 0, deleted.item);
    restored = { ...block, items };
  } else return null;
  return {
    ...document,
    blocks: document.blocks.map((block) =>
      block.id === restored.id ? restored : block,
    ),
  };
}
