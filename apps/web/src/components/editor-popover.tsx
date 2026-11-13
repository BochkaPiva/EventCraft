"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Plus from "lucide-react/icons/plus";
import Type from "lucide-react/icons/type";
import Clock3 from "lucide-react/icons/clock-3";
import Calculator from "lucide-react/icons/calculator";

export function EditorPopover({
  label,
  children,
  className = "",
  disabled = false,
  trigger,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  trigger?: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const panel = details.current?.querySelector<HTMLElement>(
        ".editor-popover-panel",
      );
      const anchor = details.current
        ?.querySelector("summary")
        ?.getBoundingClientRect();
      if (!panel || !anchor) return;
      const below = window.innerHeight - anchor.bottom - 16;
      const above = anchor.top - 116;
      const flip = below < panel.scrollHeight && above > below;
      panel.style.top = flip ? "auto" : "calc(100% + 6px)";
      panel.style.bottom = flip ? "calc(100% + 6px)" : "auto";
      panel.style.maxHeight = `${Math.max(120, flip ? above : below)}px`;
      panel.style.overflowY = "auto";
    };
    position();
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !details.current?.contains(event.target) &&
        details.current
      )
        details.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", position);
    };
  }, [open]);
  return (
    <details
      ref={details}
      className={`editor-popover ${className}`}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          details.current
        )
          details.current.open = false;
      }}
      onKeyDown={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
          details.current
        ) {
          event.preventDefault();
          details.current.open = true;
          const controls = Array.from(
            details.current.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href]",
            ),
          );
          const current = controls.findIndex(
            (control) => control === document.activeElement,
          );
          const target =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? controls.length - 1
                : event.key === "ArrowDown"
                  ? (current + 1) % controls.length
                  : (current - 1 + controls.length) % controls.length;
          controls[target]?.focus();
          return;
        }
        if (event.key === "Escape" && details.current?.open) {
          event.stopPropagation();
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={label}
        title={label}
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        {trigger ?? label}
      </summary>
      <div
        className="editor-popover-panel"
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("button:not(:disabled), a") &&
            details.current
          ) {
            details.current.open = false;
            details.current.querySelector("summary")?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function SectionPicker({
  onAdd,
  disabled,
  label = "Добавить раздел",
  className = "",
}: {
  onAdd: (type: "text" | "program" | "estimate") => void;
  disabled: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <EditorPopover
      label={label}
      disabled={disabled}
      className={`section-picker ${className}`}
      trigger={
        label === "Добавить раздел здесь" ? (
          <Plus size={17} aria-hidden="true" />
        ) : (
          <>
            <Plus size={16} aria-hidden="true" />
            <span>{label}</span>
          </>
        )
      }
    >
      <button disabled={disabled} onClick={() => onAdd("text")}>
        <Type size={18} aria-hidden="true" />
        <strong>Текст</strong>
      </button>
      <button disabled={disabled} onClick={() => onAdd("program")}>
        <Clock3 size={18} aria-hidden="true" />
        <strong>Программа</strong>
      </button>
      <button disabled={disabled} onClick={() => onAdd("estimate")}>
        <Calculator size={18} aria-hidden="true" />
        <strong>Расчёт</strong>
      </button>
    </EditorPopover>
  );
}
