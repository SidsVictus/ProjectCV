/* eslint-disable @next/next/no-img-element */

// Skeleton screens in the app's dark and lime theme. They show the shape of the page that is on its way,
// so it seems to fill in instead of jumping. They wait 150ms before appearing, so quick loads show nothing.

const Sk = ({ w, h = 14, r, style }: { w: number | string; h?: number; r?: number | string; style?: React.CSSProperties }) =>
  <i className="ld-sk" style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : null), ...style }} />;

function Table({ rows = 3 }: { rows?: number }) {
  const cell = (w: string, h = 14) => <Sk w={w} h={h} />;
  return (
    <div className="ld-table">
      <div className="ld-row ld-row--head">{cell("60%")}{cell("50%")}{cell("45%")}{cell("40%")}{cell("45%")}{cell("40%")}</div>
      {Array.from({ length: rows }, (_, i) => (
        <div className="ld-row" key={i}>
          {cell("24px")}{cell(i === 1 ? "70%" : "85%", 16)}{cell("60%")}{cell(i === 2 ? "55%" : "90%")}{cell("70px", 28)}{cell("84px", 28)}
        </div>
      ))}
    </div>
  );
}

function Pane({ table = true }: { table?: boolean }) {
  return (
    <section className="ld-pane" aria-hidden="true">
      <Sk w="min(360px, 70%)" h={46} r={12} />
      <Sk w="min(520px, 92%)" h={18} />
      <div className="ld-chips"><Sk w={120} h={30} r={999} /><Sk w={96} h={30} r={999} /><Sk w={132} h={30} r={999} /></div>
      {table && <><div className="ld-rule" /><Table /></>}
    </section>
  );
}

export function SiteLoading({ variant }: { variant: "editor" | "viewer" | "setup" | "card" }) {
  return (
    <div className="ld" role="status" aria-live="polite" aria-label="Loading">
      <span className="ld-top" aria-hidden="true" />
      <span className="pcv-sr">Loading</span>
      {variant === "editor" && (
        <div className="ld-shell" aria-hidden="true">
          <div className="ld-nav"><img className="ld-logo" src="/brand/logo-mark.png" alt="" /><i className="ld-grow" /><Sk w={92} h={36} r={999} /><Sk w={36} h={36} r="50%" /></div>
          <div className="ld-tools"><Sk w={190} h={46} r={23} /><div><Sk w={48} h={48} r="50%" /><Sk w={48} h={48} r="50%" /><Sk w={48} h={48} r="50%" /></div></div>
          <Pane />
        </div>
      )}
      {variant === "viewer" && (
        <div className="ld-shell" aria-hidden="true">
          <div className="ld-tools" style={{ marginTop: 36 }}><Sk w={190} h={46} r={23} /></div>
          <Pane />
        </div>
      )}
      {variant === "setup" && (
        <div className="ld-split" aria-hidden="true">
          <div>
            <img className="ld-logo" src="/brand/logo-mark.png" alt="" style={{ width: 52, height: 52 }} />
            <Sk w={170} h={12} />
            <div className="ld-fields">
              {Array.from({ length: 6 }, (_, i) => (
                <div className="ld-field" key={i} style={i === 5 ? { gridColumn: "1 / -1" } : undefined}><Sk w={90} h={11} /><Sk w="100%" h={48} r={14} /></div>
              ))}
            </div>
            <Sk w={190} h={52} r={999} />
          </div>
          <div><div style={{ width: "100%", maxWidth: 560 }}><Pane table={false} /></div></div>
        </div>
      )}
      {variant === "card" && (
        <div className="ld-center" aria-hidden="true">
          <div className="ld-card">
            <img className="ld-logo" src="/brand/logo-mark.png" alt="" style={{ width: 52, height: 52 }} />
            <Sk w="75%" h={38} r={12} /><Sk w="95%" h={14} /><Sk w="60%" h={14} />
            <Sk w="100%" h={52} r={999} style={{ marginTop: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}
