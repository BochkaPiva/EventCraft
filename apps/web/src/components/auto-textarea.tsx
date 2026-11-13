"use client";
import { useEffect, useRef, type ComponentProps } from "react";

export function AutoTextarea(props: ComponentProps<"textarea">) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const resize = () => {
      if (!field.current) return;
      field.current.style.height = "auto";
      field.current.style.height = `${field.current.scrollHeight}px`;
    };
    resize();
    let width = field.current?.parentElement?.clientWidth;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width !== width) {
        width = entry.contentRect.width;
        resize();
      }
    });
    // Observe the container width, not the textarea's self-adjusting height.
    if (field.current?.parentElement)
      observer.observe(field.current.parentElement, { box: "content-box" });
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={field} rows={1} />;
}
