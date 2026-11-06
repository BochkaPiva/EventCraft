import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { X, MoreHorizontal } from "lucide-react";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Fullscreen({ title, onClose, children, className = "" }) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          className={`fullscreen-panel ${className}`}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? "modal-wide" : ""}`}>
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className={description ? "muted" : "sr-only"}>
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Закрыть">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Overflow({ items, label = "Действия с предложением" }) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button className="icon-button" aria-label={label}>
          <MoreHorizontal size={18} />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="dropdown" align="end" sideOffset={6}>
          {items.map((i, n) =>
            i.separator ? (
              <Menu.Separator key={n} />
            ) : (
              <Menu.Item
                key={i.label}
                disabled={i.disabled}
                className={i.danger ? "danger" : ""}
                onSelect={i.action}
              >
                {i.icon}
                {i.label}
              </Menu.Item>
            ),
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-icon">
          <Icon size={25} />
        </span>
      )}
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
