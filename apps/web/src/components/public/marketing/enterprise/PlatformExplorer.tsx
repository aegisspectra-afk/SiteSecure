import { useId, useState } from "react";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { statusLabel } from "./marketing-content";
import {
  DEMO_BADGE,
  DEMO_TABLE,
  EXPLORER_MODULES,
  type ExplorerModule,
  type ExplorerModuleKey,
} from "./demo-data";

function ModulePreview({ mod }: { mod: ExplorerModule }) {
  if (mod.previewKind === "chart") {
    return (
      <div className="mkt-xp-preview-chart" aria-hidden>
        {[40, 65, 48, 80, 55, 70].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  }
  if (mod.previewKind === "map") {
    return (
      <div className="mkt-xp-map" aria-hidden>
        <span className="mkt-xp-pin" style={{ insetInlineStart: "28%", top: "34%" }} />
        <span className="mkt-xp-pin is-warn" style={{ insetInlineStart: "58%", top: "52%" }} />
        <span className="mkt-xp-pin" style={{ insetInlineStart: "42%", top: "68%" }} />
        <p>מפת אתרים · {DEMO_BADGE}</p>
      </div>
    );
  }
  if (mod.previewKind === "board") {
    return (
      <div className="mkt-xp-board" aria-hidden>
        {["ממתין", "בביצוע", "הושלם"].map((col) => (
          <div key={col} className="mkt-xp-col">
            <strong>{col}</strong>
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  }
  if (mod.previewKind === "table") {
    return (
      <table className="mkt-xp-table">
        <caption className="sr-only">טבלת הדגמה</caption>
        <thead>
          <tr>
            <th>מס׳</th>
            <th>לקוח</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_TABLE.slice(0, 3).map((row) => (
            <tr key={row.id}>
              <td dir="ltr">{row.id}</td>
              <td>{row.customer}</td>
              <td>
                <span className="mkt-status is-info">{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <ul className="mkt-xp-list">
      {mod.capabilities.map((c) => (
        <li key={c}>
          <span className="mkt-status-dot is-ok" aria-hidden />
          {c}
        </li>
      ))}
    </ul>
  );
}

export function PlatformExplorer() {
  const baseId = useId();
  const [active, setActive] = useState<ExplorerModuleKey>("quotations");
  const mod = EXPLORER_MODULES.find((m) => m.key === active) ?? EXPLORER_MODULES[0];

  return (
    <div className="mkt-xp">
      <div className="mkt-xp-tabs" role="tablist" aria-label="מודולי פלטפורמה">
        {EXPLORER_MODULES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            id={`${baseId}-${m.key}`}
            aria-selected={active === m.key}
            aria-controls={`${baseId}-panel`}
            className={`mkt-xp-tab${active === m.key ? " is-active" : ""}`}
            onClick={() => {
              setActive(m.key);
              trackMarketingEvent("cta_click", { cta: "explorer_module", module: m.key });
            }}
          >
            {m.title}
          </button>
        ))}
      </div>

      <div
        className="mkt-xp-panel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-${mod.key}`}
      >
        <div className="mkt-xp-copy">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-xl font-semibold">{mod.title}</h3>
            <span className="mkt-badge">{statusLabel(mod.status)}</span>
          </div>
          <p className="mkt-lede mt-2">{mod.value}</p>
          <ul className="mkt-xp-caps">
            {mod.capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <a
            href={mod.cta.href}
            className="mkt-btn mkt-btn-primary mt-6"
            onClick={() => trackMarketingEvent("cta_click", { cta: "explorer_cta", module: mod.key })}
          >
            {mod.cta.label}
          </a>
        </div>
        <div className="mkt-xp-stage">
          <p className="mkt-demo-badge mkt-xp-stage-badge">{DEMO_BADGE}</p>
          <ModulePreview mod={mod} />
        </div>
      </div>
    </div>
  );
}
