import { encode } from "uqr";
import { WARRANTY_DISCLAIMER, formatDisplayDate, type WarrantySection } from "../../lib/warranty-document";

function WarrantyQr({ value }: { value: string }) {
  const qr = encode(value, { ecc: "M", border: 2 });
  const cells: { x: number; y: number }[] = [];
  qr.data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) cells.push({ x, y });
    });
  });
  return (
    <svg className="portal-qr warranty-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="קוד QR לאחריות">
      <rect className="portal-qr-bg" width={qr.size} height={qr.size} />
      {cells.map((cell) => (
        <rect key={`${cell.x}-${cell.y}`} className="portal-qr-fg" x={cell.x} y={cell.y} width={1} height={1} />
      ))}
    </svg>
  );
}

export function WarrantyDocumentView({
  businessName,
  customerName,
  subject,
  number,
  startsOn,
  endsOn,
  sections,
  compare = false,
  qrValue,
}: {
  businessName: string;
  customerName: string;
  subject: string;
  number: string;
  startsOn: string;
  endsOn: string;
  sections: WarrantySection[];
  compare?: boolean;
  qrValue?: string | null;
}) {
  return (
    <article className="warranty-sheet">
      <header className="warranty-sheet-head">
        <div>
          <p className="warranty-sheet-brand">{businessName || "העסק"}</p>
          <h3 className="warranty-sheet-title">תעודת אחריות</h3>
          <p className="warranty-sheet-meta">{number}</p>
        </div>
        {qrValue ? <WarrantyQr value={qrValue} /> : null}
      </header>
      <dl className="warranty-sheet-facts">
        <div>
          <dt>לקוח</dt>
          <dd>{customerName || "—"}</dd>
        </div>
        <div>
          <dt>מוצר / שירות</dt>
          <dd>{subject || "—"}</dd>
        </div>
        <div>
          <dt>תחילת אחריות</dt>
          <dd>{formatDisplayDate(startsOn)}</dd>
        </div>
        <div>
          <dt>סיום</dt>
          <dd>{formatDisplayDate(endsOn)}</dd>
        </div>
      </dl>
      {sections.map((section) => (
        <section key={section.id} className={compare ? "warranty-sheet-compare" : "warranty-sheet-section"}>
          {compare ? (
            <>
              <div>
                <p className="warranty-sheet-kicker">בחירה</p>
                <h4>{section.heading}</h4>
                <p>{section.source}</p>
              </div>
              <div>
                <p className="warranty-sheet-kicker">נוסח</p>
                <h4>{section.heading}</h4>
                <p>{section.body}</p>
              </div>
            </>
          ) : (
            <>
              <h4>{section.heading}</h4>
              <p>{section.body}</p>
            </>
          )}
        </section>
      ))}
      <footer className="warranty-sheet-foot">
        <p>{WARRANTY_DISCLAIMER}</p>
        <p className="warranty-sheet-sign">אישור העסק · {businessName || "—"}</p>
      </footer>
    </article>
  );
}
