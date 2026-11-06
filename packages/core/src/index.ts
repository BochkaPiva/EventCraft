import { z } from "zod";
export const idSchema = z
  .uuid()
  .refine(
    (v) =>
      v !== "00000000-0000-0000-0000-000000000000" &&
      v.toLowerCase() !== "ffffffff-ffff-ffff-ffff-ffffffffffff",
  )
  .transform((v) => v.toLowerCase());
const money = z.number().int().min(0).max(1_000_000_000_000).nullable();
export const estimateLineSchema = z
  .object({
    id: idSchema,
    description: z.string().max(300),
    quantityThousandths: z.number().int().min(1).max(100_000_000).nullable(),
    unitPriceMinor: money,
    included: z.boolean(),
    unitCostMinor: money.optional(),
    internalNote: z.string().max(2000).optional(),
  })
  .strict();
const textBlock = z
  .object({
    id: idSchema,
    type: z.literal("text"),
    heading: z.string().max(160),
    body: z.string().max(20000),
    visible: z.boolean(),
  })
  .strict();
const estimateBlock = z
  .object({
    id: idSchema,
    type: z.literal("estimate"),
    heading: z.string().max(160),
    lines: z.array(estimateLineSchema).max(200),
    visible: z.boolean(),
  })
  .strict();
export const draftDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    blocks: z
      .array(z.discriminatedUnion("type", [textBlock, estimateBlock]))
      .max(64),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const b of doc.blocks) {
      if (ids.has(b.id))
        ctx.addIssue({ code: "custom", message: "Duplicate block identifier" });
      ids.add(b.id);
      if (b.type === "estimate") {
        const lineIds = new Set<string>();
        for (const l of b.lines) {
          if (lineIds.has(l.id))
            ctx.addIssue({
              code: "custom",
              message: "Duplicate estimate line identifier",
            });
          lineIds.add(l.id);
        }
      }
    }
  });
export type DraftDocument = z.infer<typeof draftDocumentSchema>;
export type EstimateLine = z.infer<typeof estimateLineSchema>;
export const createAgencyInputSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();
export const createProposalInputSchema = z
  .object({
    agencyId: idSchema,
    creationKey: idSchema,
    title: z.string().trim().max(180).default(""),
    document: draftDocumentSchema.default({ schemaVersion: 1, blocks: [] }),
  })
  .strict();
export const saveProposalInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0).max(2_147_483_646),
    title: z.string().trim().max(180),
    document: draftDocumentSchema,
  })
  .strict();
export type ProposalRecord = {
  id: string;
  agencyId: string;
  title: string;
  document: DraftDocument;
  revision: number;
};
export class DomainError extends Error {
  constructor(
    public code: "not_ready" | "money_overflow" | "revision_conflict",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function calculateEstimate(lines: ReadonlyArray<EstimateLine>) {
  let known = 0n;
  let incomplete = false;
  let includedCount = 0;
  for (const raw of lines) {
    const l = estimateLineSchema.parse(raw);
    if (!l.included || !l.description.trim()) continue;
    includedCount++;
    if (l.quantityThousandths === null || l.unitPriceMinor === null) {
      incomplete = true;
      continue;
    }
    known +=
      (BigInt(l.quantityThousandths) * BigInt(l.unitPriceMinor) + 500n) / 1000n;
    if (known > BigInt(Number.MAX_SAFE_INTEGER))
      throw new DomainError(
        "money_overflow",
        "Estimate exceeds supported amount",
      );
  }
  return {
    currency: "RUB" as const,
    knownTotalMinor: Number(known),
    incomplete: incomplete || includedCount === 0,
    includedCount,
  };
}
// Deliberately constructs each public field. Never spread internal commercial data.
export function projectClientSnapshot(
  input: { title: string; document: DraftDocument },
  brand: { name: string; accent: string; logoAssetId?: string | null },
) {
  const doc = draftDocumentSchema.parse(input.document);
  if (!input.title.trim())
    throw new DomainError("not_ready", "Proposal title is required");
  const visible = doc.blocks.filter((b) => b.visible);
  const meaningful = visible.some((b) =>
    b.type === "text"
      ? b.body.trim()
      : b.lines.some((l) => l.description.trim()),
  );
  if (!meaningful)
    throw new DomainError("not_ready", "Visible proposal content is required");
  const blocks = visible.map((b) =>
    b.type === "text"
      ? { id: b.id, type: b.type, heading: b.heading, body: b.body }
      : {
          id: b.id,
          type: b.type,
          heading: b.heading,
          lines: b.lines
            .filter((l) => l.description.trim())
            .map((l) => ({
              id: l.id,
              description: l.description,
              quantityThousandths: l.quantityThousandths,
              unitPriceMinor: l.unitPriceMinor,
              included: l.included,
            })),
          summary: calculateEstimate(b.lines),
        },
  );
  return structuredClone({
    schemaVersion: 1 as const,
    title: input.title.trim(),
    brand: {
      name: brand.name,
      accent: brand.accent,
      logoAssetId: brand.logoAssetId ?? null,
    },
    blocks,
  });
}
export function applyDraftUpdate(
  current: ProposalRecord,
  expectedRevision: number,
  change: { title: string; document: DraftDocument },
): ProposalRecord {
  if (current.revision !== expectedRevision)
    throw new DomainError(
      "revision_conflict",
      "Draft changed since it was opened",
    );
  const input = saveProposalInputSchema.parse({ expectedRevision, ...change });
  return {
    ...current,
    title: input.title,
    document: structuredClone(input.document),
    revision: current.revision + 1,
  };
}
