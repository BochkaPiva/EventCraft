import type { DraftDocument } from "@eventcraft/core";
export type WorkingDraft = { title: string; document: DraftDocument };
export type SaveView = {
  status: "saved" | "unsaved" | "saving" | "error" | "conflict";
  dirty: boolean;
  revision: number;
  error?: unknown;
};
type Save = (
  draft: WorkingDraft,
  revision: number,
) => Promise<{ revision: number }>;

// One request at a time; an acknowledgement belongs to the sent snapshot only.
export class DraftSaver {
  private current: WorkingDraft;
  private saved: string;
  private revision: number;
  private status: SaveView["status"] = "saved";
  private error?: unknown;
  private pending = false;
  private uncertain = false;
  private disposed = false;
  constructor(
    initial: WorkingDraft,
    revision: number,
    private save: Save,
    private changed: (view: SaveView) => void,
  ) {
    this.current = structuredClone(initial);
    this.saved = JSON.stringify(initial);
    this.revision = revision;
  }
  get view(): SaveView {
    return {
      status: this.status,
      dirty:
        this.pending ||
        this.uncertain ||
        JSON.stringify(this.current) !== this.saved,
      revision: this.revision,
      error: this.error,
    };
  }
  update(draft: WorkingDraft) {
    this.current = structuredClone(draft);
    if (!this.pending && this.status !== "error" && this.status !== "conflict")
      this.status = this.view.dirty ? "unsaved" : "saved";
    this.emit();
  }
  retry() {
    if (this.status === "conflict" || this.pending) return;
    this.status = this.view.dirty ? "unsaved" : "saved";
    this.error = undefined;
    this.emit();
  }
  dispose() {
    this.disposed = true;
  }
  connect() {
    this.disposed = false;
  }
  private emit() {
    if (!this.disposed) this.changed(this.view);
  }
  async flush() {
    if (
      this.pending ||
      this.disposed ||
      !this.view.dirty ||
      ["error", "conflict"].includes(this.status)
    )
      return;
    this.pending = true;
    this.status = "saving";
    const snapshot = structuredClone(this.current),
      expected = this.revision;
    this.emit();
    try {
      const result = await this.save(snapshot, expected);
      if (result.revision !== expected + 1)
        throw Error("Invalid save acknowledgement");
      this.revision = result.revision;
      this.saved = JSON.stringify(snapshot);
      this.uncertain = false;
      this.status =
        JSON.stringify(this.current) !== this.saved ? "unsaved" : "saved";
      this.error = undefined;
    } catch (error) {
      this.uncertain = true;
      this.error = error;
      this.status =
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 409
          ? "conflict"
          : "error";
    } finally {
      this.pending = false;
      this.emit();
    }
  }
}
