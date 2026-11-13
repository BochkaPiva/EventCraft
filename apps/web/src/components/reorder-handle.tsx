"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type ComponentProps,
  type ReactNode,
} from "react";
import GripVertical from "lucide-react/icons/grip-vertical";
import { reorderAtSlot } from "../lib/reorder.ts";

type Drag = {
  id: string;
  slot: number;
  keyboard: boolean;
  active: boolean;
  x: number;
  y: number;
  originX: number;
  originY: number;
  inside: boolean;
};

export function useReorderList<T extends { id: string }>(
  items: T[],
  onChange: (items: T[]) => void,
  announce: (message: string) => void,
) {
  const root = useRef<HTMLElement | null>(null);
  const session = useRef<Drag | null>(null);
  const frame = useRef(0);
  const latest = useRef({ items, onChange, announce });
  latest.current = { items, onChange, announce };
  const [drag, setDrag] = useState<Drag | null>(null);
  const hintId = useId();

  function clear() {
    cancelAnimationFrame(frame.current);
    session.current = null;
    setDrag(null);
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function updatePointer() {
    const current = session.current;
    if (!current || current.keyboard || !root.current) return;
    const bounds = root.current.getBoundingClientRect();
    const inside =
      current.x >= bounds.left - 56 &&
      current.x <= bounds.right + 24 &&
      current.y >= bounds.top - 60 &&
      current.y <= bounds.bottom + 60;
    const rows = Array.from(
      root.current.querySelectorAll<HTMLElement>(
        ":scope > [data-reorder-item]",
      ),
    ).filter((row) => row.dataset.reorderItem !== current.id);
    let slot = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return current.y < rect.top + rect.height / 2;
    });
    if (slot < 0) slot = rows.length;
    const next = { ...current, slot, inside };
    session.current = next;
    setDrag(next);
  }
  function autoScroll() {
    const current = session.current;
    if (!current?.active || current.keyboard) return;
    const delta =
      current.y < 100
        ? -Math.ceil((100 - current.y) / 5)
        : current.y > window.innerHeight - 90
          ? Math.ceil((current.y - window.innerHeight + 90) / 5)
          : 0;
    if (delta) {
      window.scrollBy(0, Math.max(-20, Math.min(20, delta)));
      updatePointer();
    }
    frame.current = requestAnimationFrame(autoScroll);
  }
  function finish() {
    const current = session.current;
    if (current?.active && current.inside) {
      const next = reorderAtSlot(
        latest.current.items,
        current.id,
        current.slot,
      );
      if (next) {
        latest.current.onChange(next);
        latest.current.announce(
          `Перемещено на позицию ${current.slot + 1} из ${next.length}.`,
        );
      }
    }
    clear();
  }
  const remaining = drag ? items.filter((item) => item.id !== drag.id) : [];
  return {
    root: (element: HTMLElement | null) => {
      root.current = element;
    },
    dragging: Boolean(drag?.active),
    hint: (
      <span id={hintId} className="sr-only">
        Пробел — взять или положить. Стрелки — выбрать место. Escape — отменить.
        Alt и стрелка — переместить на одну позицию.
      </span>
    ),
    itemProps: (id: string) => ({
      "data-reorder-item": id,
      "data-dragging": drag?.active && drag.id === id ? "true" : undefined,
      "data-drop-before":
        drag?.active && drag.inside && remaining[drag.slot]?.id === id
          ? "true"
          : undefined,
      "data-drop-after":
        drag?.active &&
        drag.inside &&
        drag.slot === remaining.length &&
        remaining.at(-1)?.id === id
          ? "true"
          : undefined,
    }),
    handleProps: (id: string) => ({
      "aria-describedby": hintId,
      "aria-pressed": Boolean(drag?.active && drag.id === id),
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 || items.length < 2) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const current = {
          id,
          slot: items.findIndex((item) => item.id === id),
          keyboard: false,
          active: false,
          x: event.clientX,
          y: event.clientY,
          originX: event.clientX,
          originY: event.clientY,
          inside: true,
        };
        session.current = current;
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const current = session.current;
        if (!current || current.keyboard || current.id !== id) return;
        const active =
          current.active ||
          Math.hypot(
            event.clientX - current.originX,
            event.clientY - current.originY,
          ) > 6;
        session.current = {
          ...current,
          x: event.clientX,
          y: event.clientY,
          active,
        };
        if (active) {
          updatePointer();
          if (!current.active)
            frame.current = requestAnimationFrame(autoScroll);
        }
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        if (session.current?.keyboard || session.current?.id !== id) return;
        finish();
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: clear,
      onBlur: () => {
        if (session.current?.keyboard && session.current.id === id) clear();
      },
      onLostPointerCapture: () => {
        if (session.current && !session.current.keyboard) clear();
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        const current = session.current;
        if (event.key === "Escape" && current) {
          event.preventDefault();
          latest.current.announce("Перемещение отменено.");
          clear();
          return;
        }
        if ((event.key === " " || event.key === "Enter") && items.length > 1) {
          event.preventDefault();
          if (current?.keyboard) finish();
          else {
            const next = {
              id,
              slot: items.findIndex((item) => item.id === id),
              keyboard: true,
              active: true,
              inside: true,
              x: 0,
              y: 0,
              originX: 0,
              originY: 0,
            };
            session.current = next;
            setDrag(next);
            latest.current.announce(
              "Выбрано для перемещения. Выберите место стрелками.",
            );
          }
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          const delta = event.key === "ArrowUp" ? -1 : 1;
          if (current?.keyboard) {
            event.preventDefault();
            const next = {
              ...current,
              slot: Math.max(
                0,
                Math.min(items.length - 1, current.slot + delta),
              ),
            };
            session.current = next;
            setDrag(next);
            latest.current.announce(
              `Позиция ${next.slot + 1} из ${items.length}.`,
            );
          } else if (event.altKey) {
            event.preventDefault();
            const next = reorderAtSlot(
              items,
              id,
              items.findIndex((item) => item.id === id) + delta,
            );
            if (next) {
              onChange(next);
              latest.current.announce("Порядок изменён.");
            }
          }
        }
      },
    }),
  };
}

export function ReorderHandle({
  label,
  ...props
}: { label: string } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      className="reorder-handle"
      aria-label={label}
      title={label}
      {...props}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}

export function ReorderSurface<T extends { id: string }>({
  items,
  onChange,
  children,
  label,
  className,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  children: (controls: ReturnType<typeof useReorderList<T>>) => ReactNode;
  label: string;
  className: string;
}) {
  const [announcement, setAnnouncement] = useState("");
  const controls = useReorderList(items, onChange, setAnnouncement);
  return (
    <div
      className={className}
      role="group"
      aria-label={label}
      ref={controls.root}
    >
      {controls.hint}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {children(controls)}
    </div>
  );
}
