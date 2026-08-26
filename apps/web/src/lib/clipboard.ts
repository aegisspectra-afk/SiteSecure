/** Safe clipboard write with execCommand fallback when document is unfocused. */

export type ClipboardResult = "copied" | "fallback" | "failed";

export async function copyTextToClipboard(text: string): Promise<ClipboardResult> {
  const value = String(text || "").trim();
  if (!value) return "failed";

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return "copied";
    }
  } catch {
    // Document not focused / permission denied — try legacy fallback below.
  }

  try {
    if (typeof document === "undefined") return "failed";
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok ? "copied" : "fallback";
  } catch {
    return "failed";
  }
}
