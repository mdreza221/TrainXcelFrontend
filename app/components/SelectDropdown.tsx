"use client";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled,
  className,
  menuClassName,
  ariaLabel,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = Math.min(options.length * 34 + 12, 240);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const up = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, Math.min(240, window.innerWidth - 16));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    const top = up ? rect.top - 8 - menuHeight : rect.bottom + 8;
    setPos({ top, left, width });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) computePos();
  }, [open, computePos]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    const onResize = () => computePos();
    const onClick = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, computePos]);

  const select = (opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const menu = open && pos ? (
    <div
      ref={menuRef}
      role="listbox"
      className={`fixed z-[9999] rounded-xl border border-slate-200 bg-white py-1 shadow-xl overflow-y-auto dark:border-zinc-700 dark:bg-[#1c1c1c] ${menuClassName ?? ""}`}
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 240 }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => select(opt)}
            className={`block w-full text-left px-3 py-2 text-xs whitespace-normal break-words transition ${
              active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                : "text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 w-full text-left ${className ?? ""}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined" && createPortal(menu, document.body)}
    </>
  );
}
