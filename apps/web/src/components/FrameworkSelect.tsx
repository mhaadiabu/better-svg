import * as React from "react";
import { Select } from "@radix-ui/react-select";
import "./framework-select.css";

export type Framework = {
  id: string;
  label: string;
  sub: string;
};

type Props = {
  frameworks: Framework[];
  initial: string;
  onChange?: (id: string) => void;
};

const STORAGE_KEY = "bettersvg:framework";

export function FrameworkSelect({ frameworks, initial, onChange }: Props) {
  const [value, setValue] = React.useState(initial);

  // Restore preference on mount (in case it differs from the SSR default)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== value) {
        setValue(saved);
        window.dispatchEvent(new CustomEvent("framework-change", { detail: { id: saved } }));
      }
    } catch {}
  }, []);

  const handleChange = React.useCallback(
    (id: string) => {
      setValue(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {}
      window.dispatchEvent(new CustomEvent("framework-change", { detail: { id } }));
      onChange?.(id);
    },
    [onChange],
  );

  return (
    <Select.Root value={value} onValueChange={handleChange}>
      <Select.Trigger className="fw-trigger" aria-label="Select framework">
        <Select.Value placeholder="Select framework" />
        <Select.Icon asChild>
          <svg
            className="fw-trigger-chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="fw-content" position="popper" sideOffset={4}>
          <Select.Viewport className="fw-viewport">
            {frameworks.map((fw) => (
              <Select.Item
                key={fw.id}
                value={fw.id}
                className="fw-option"
                textValue={`${fw.label} · ${fw.sub}`}
              >
                <span className="fw-option-label">{fw.label}</span>
                <span className="fw-option-sub">{fw.sub}</span>
                <Select.ItemIndicator asChild>
                  <svg
                    className="fw-option-check"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
