let tooltip: HTMLElement | null = null;
let tooltipTimeout: number | undefined;
let resizeObserver: ResizeObserver | null = null;

document.addEventListener("astro:before-swap", () => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.clearTimeout(tooltipTimeout);
  tooltip?.remove();
  tooltip = null;
});

function getTooltip(): HTMLElement {
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.className = "code-block-tooltip";
  tooltip.setAttribute("role", "status");
  tooltip.setAttribute("aria-live", "polite");
  tooltip.textContent = "Copied";
  document.body.appendChild(tooltip);
  return tooltip;
}

function showTooltip(target: HTMLElement, text = "Copied") {
  const t = getTooltip();
  t.textContent = text;
  t.classList.add("is-visible");
  const rect = target.getBoundingClientRect();
  const tRect = t.getBoundingClientRect();
  t.style.left = `${rect.left + rect.width / 2 - tRect.width / 2}px`;
  t.style.top = `${rect.top - tRect.height - 8}px`;
  window.clearTimeout(tooltipTimeout);
  tooltipTimeout = window.setTimeout(() => t.classList.remove("is-visible"), 1500);
}

function formatCopyText(block: HTMLElement) {
  const pre = block.querySelector("pre");
  if (!pre) return "";
  let text = pre.textContent || "";
  text = text.replace(/^\$\s*/, "");
  return text;
}

function updateWrap(body: Element) {
  if (body.classList.contains("is-wrapped")) return;
  body
    .closest(".code-block")
    ?.classList.toggle("has-wrap", body.scrollWidth > body.clientWidth + 1);
}

// Creates the wrap/unwrap toggle for a code block. The label flips with wrap state.
export const wrapIcons = {
  off: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M16 17l3-3-3-3" stroke-width="1.5"/></svg> Wrap`,
  on: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M14 14l3 3 3-3" stroke-width="1.5"/></svg> Unwrap`,
  chipOff: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M16 17l3-3-3-3" stroke-width="1.5"/></svg>`,
  chipOn: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M14 14l3 3 3-3" stroke-width="1.5"/></svg>`,
};

function createWrapButton(block: HTMLElement) {
  const wrapBtn = document.createElement("button");
  wrapBtn.className = "wrap-btn";
  wrapBtn.setAttribute("aria-label", "Toggle word wrap");
  wrapBtn.innerHTML = wrapIcons.off;
  wrapBtn.addEventListener("click", () => {
    const body = block.querySelector(".code-block-body");
    if (body) {
      body.classList.toggle("is-wrapped");
      const on = body.classList.contains("is-wrapped");
      wrapBtn.innerHTML = on ? wrapIcons.on : wrapIcons.off;
    }
  });
  return wrapBtn;
}

export function initCodeBlocks() {
  resizeObserver ??= new ResizeObserver((entries) => {
    entries.forEach(({ target }) => updateWrap(target));
  });
  document.querySelectorAll<HTMLElement>(".code-block").forEach((block) => {
    if (block.querySelector(".code-block-header")) return;

    // Hero framework panels: no header bar; the floating file label handles copying.
    const inHeroPanel = Boolean(block.closest("[data-fw-panel]"));
    const lang = block.getAttribute("data-lang") || "";
    const file = block.getAttribute("data-file") || "";

    if (!inHeroPanel) block.classList.add("has-header");

    const blockId = `cb-${Math.random().toString(36).slice(2, 9)}`;
    const langId = `${blockId}-lang`;

    const header = document.createElement("div");
    header.className = "code-block-header";

    const langEl = document.createElement("span");
    langEl.className = "code-block-lang";
    langEl.id = langId;
    langEl.textContent = lang;
    header.appendChild(langEl);

    if (file) {
      const fileEl = document.createElement("span");
      fileEl.className = "code-block-file";
      fileEl.textContent = file;
      header.appendChild(fileEl);
    }

    const actions = document.createElement("div");
    actions.className = "code-block-actions";

    // Wrap button
    const wrapBtn = createWrapButton(block);
    actions.appendChild(wrapBtn);

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.setAttribute("aria-label", "Copy code");
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    const copyIcon = copyBtn.innerHTML;
    copyBtn.addEventListener("click", () => {
      void copyToClipboard(
        copyBtn,
        formatCopyText(block),
        (copied) => {
          if (!copied) {
            showTooltip(copyBtn, "Copy failed");
            return;
          }
          copyBtn.classList.add("copied");
          copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
          showTooltip(copyBtn, "Copied");
        },
        () => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = copyIcon;
        },
      );
    });
    actions.appendChild(copyBtn);

    header.appendChild(actions);

    const pre = block.querySelector("pre");
    if (pre?.parentNode) {
      pre.classList.remove("overflow-x-auto");
      (pre as HTMLElement).style.overflowX = "";
      if (!inHeroPanel) pre.setAttribute("aria-labelledby", langId);
      pre.setAttribute("tabindex", "0");
      const body = document.createElement("div");
      body.className = "code-block-body";
      pre.parentNode.insertBefore(body, pre);
      body.appendChild(pre);
    }

    if (!inHeroPanel) {
      block.insertBefore(header, block.firstChild);
    }
    // Hero panels: no header row at all - the strip (tab bar / mobile picker row)
    // carries the shared wrap toggle.

    const bodyEl = block.querySelector(".code-block-body");
    if (bodyEl) {
      requestAnimationFrame(() => updateWrap(bodyEl));
      resizeObserver?.observe(bodyEl);
    }
  });
}
import { copyToClipboard } from "./clipboard";
