/* eslint-disable @next/next/no-img-element */

// The sign-in page's loading screen (beige and gold): the dome turns while the page arrives, and the
// card is drawn as an outline. It reuses the sign-in layout classes so nothing moves when the page lands.
const Sk = ({ w, h = 14, r }: { w: number | string; h?: number; r?: number | string }) =>
  <i className="ld-sk-gold" style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : null) }} />;

export function SigninLoading() {
  return (
    <main className="dome-signin ld-signin" role="status" aria-live="polite" aria-label="Loading">
      <span className="pcv-sr">Loading</span>
      <div className="dome" aria-hidden="true"><div className="ld-disc" /></div>
      <section className="dome-panel" aria-hidden="true">
        <div className="dome-card">
          <img className="dome-card__mark" src="/brand/logo-mark-filled.png" alt="" style={{ animation: "ld-breathe 2.2s ease-in-out infinite" }} />
          <div style={{ display: "grid", gap: 14 }}><Sk w="68%" h={44} r={12} /><Sk w="82%" h={44} r={12} /></div>
          <Sk w="100%" h={16} />
          <Sk w="100%" h={48} r={999} />
          <Sk w="88%" h={12} />
        </div>
      </section>
    </main>
  );
}
