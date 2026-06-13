export interface CodeBlockOptions {
  /** Reserved for future options. */
}

let tooltip: HTMLElement | null = null;

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
  window.setTimeout(() => t.classList.remove("is-visible"), 1500);
}

function formatCopyText(block: HTMLElement, fullFile = false) {
  const pre = block.querySelector("pre");
  if (!pre) return "";
  let text = pre.textContent || "";
  text = text.replace(/^\$\s*/, "");
  if (fullFile) {
    const file = block.getAttribute("data-file");
    if (file) {
      text = `// ${file}\n${text}`;
    }
  }
  return text;
}

export function initCodeBlocks(_options: CodeBlockOptions = {}) {
  document.querySelectorAll(".code-block").forEach((block) => {
    if (block.querySelector(".code-block-header")) return;

    block.classList.add("has-header");

    const lang = block.getAttribute("data-lang") || "";
    const file = block.getAttribute("data-file") || "";
    const blockId = `cb-${Math.random().toString(36).slice(2, 9)}`;
    const langId = `${blockId}-lang`;

    const header = document.createElement("div");
    header.className = "code-block-header";

    const langEl = document.createElement("span");
    langEl.className = "code-block-lang";
    langEl.id = langId;
    langEl.textContent = lang;
    header.appendChild(langEl);

    const actions = document.createElement("div");
    actions.className = "code-block-actions";

    // Wrap button
    const wrapBtn = document.createElement("button");
    wrapBtn.className = "wrap-btn";
    wrapBtn.setAttribute("aria-label", "Toggle word wrap");
    wrapBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M16 17l3-3-3-3" stroke-width="1.5"/></svg> Wrap`;
    wrapBtn.addEventListener("click", () => {
      const body = block.querySelector(".code-block-body");
      if (body) {
        body.classList.toggle("is-wrapped");
        const on = body.classList.contains("is-wrapped");
        wrapBtn.innerHTML = on
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M14 14l3 3 3-3" stroke-width="1.5"/></svg> Unwrap`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M16 17l3-3-3-3" stroke-width="1.5"/></svg> Wrap`;
      }
    });
    actions.appendChild(wrapBtn);

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.setAttribute("aria-label", "Copy code");
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    copyBtn.addEventListener("click", () => {
      const text = formatCopyText(block as HTMLElement, false);
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
        showTooltip(copyBtn, "Copied");
        window.setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
        }, 2000);
      });
    });
    actions.appendChild(copyBtn);

    // Copy full file button
    if (file) {
      const fullBtn = document.createElement("button");
      fullBtn.className = "copy-btn copy-full-btn";
      fullBtn.setAttribute("aria-label", `Copy full file (${file})`);
      fullBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2M8 17h2M14 13h2M14 17h2"/></svg> File`;
      fullBtn.addEventListener("click", () => {
        const text = formatCopyText(block as HTMLElement, true);
        navigator.clipboard.writeText(text).then(() => {
          showTooltip(fullBtn, `Copied ${file}`);
        });
      });
      actions.appendChild(fullBtn);
    }

    header.appendChild(actions);

    // Wrap pre in scrollable body
    const pre = block.querySelector("pre");
    if (pre?.parentNode) {
      pre.classList.remove("overflow-x-auto");
      (pre as HTMLElement).style.overflowX = "";
      pre.setAttribute("aria-labelledby", langId);
      pre.setAttribute("tabindex", "0");
      const body = document.createElement("div");
      body.className = "code-block-body";
      pre.parentNode.insertBefore(body, pre);
      body.appendChild(pre);
    }

    block.insertBefore(header, block.firstChild);

    const bodyEl = block.querySelector(".code-block-body");
    if (bodyEl) {
      const checkWrap = () => {
        if (!bodyEl.classList.contains("is-wrapped")) {
          const overflows = bodyEl.scrollWidth > bodyEl.clientWidth + 1;
          block.classList.toggle("has-wrap", overflows);
        }
      };
      requestAnimationFrame(checkWrap);
      const ro = new ResizeObserver(checkWrap);
      ro.observe(bodyEl);
    }
  });
}
