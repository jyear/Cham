import React, { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import s from "./index.module.css";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function Select<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressToggle = useRef(false);

  const selected = options.find((o) => o.value === value);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const handleToggle = () => {
    // React may re-dispatch the click event to the trigger button
    // after the option button is removed from the DOM (conditional render).
    // Ignore this spurious call.
    if (suppressToggle.current) {
      suppressToggle.current = false;
      return;
    }
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        minWidth: rect.width,
      });
    }
    setOpen((v) => !v);
  };

  const handleSelect = (opt: SelectOption<T>) => {
    suppressToggle.current = true;
    setOpen(false);
    onChange(opt.value);
  };

  return (
    <div className={s.container} ref={containerRef}>
      <button
        type="button"
        className={`${s.trigger} ${open ? s.triggerOpen : ""}`}
        onClick={handleToggle}
      >
        <span>{selected?.label ?? value}</span>
        <Icon
          type="chevron-down"
          size={10}
          className={`${s.arrow} ${open ? s.arrowUp : ""}`}
        />
      </button>

      {open && (
        <div className={s.menu} style={menuStyle}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${s.option} ${opt.value === value ? s.optionActive : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(opt);
              }}
            >
              <span>{opt.label}</span>
              <span className={s.check}>
                {opt.value === value && <Icon type="check" size={12} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
