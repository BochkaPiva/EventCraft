"use client";
import { useEffect, useRef } from "react";
export function InlineHeading({
  label,
  value,
  limit,
  className,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  limit: number;
  className: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const resize = () => {
      if (field.current) {
        field.current.style.height = "auto";
        field.current.style.height = `${field.current.scrollHeight}px`;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [value]);
  return (
    <textarea
      ref={field}
      className={className}
      aria-label={label}
      value={value}
      maxLength={limit}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
