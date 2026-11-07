/* eslint-disable @next/next/no-img-element */
import "./admin-loading.css";

const Sk = ({ w, h = 14, r }: { w: number | string; h?: number; r?: number | string }) =>
  <i className="adm-sk" style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : null) }} />;

/**
 * The dashboard's loading screen: its own layout drawn as an outline (nav, headline, six number cards,
 * the sky, two side cards). It shows while the server gathers the numbers and stays up, with the
 * logo orbiting, until the 3D sky and charts are ready; then `leaving` fades it away.
 */
export function AdminLoading({ leaving = false }: { leaving?: boolean }) {
  return (
    <div className={`adm-ld${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite" aria-label="Opening the dashboard">
      <span className="adm-ld__top" aria-hidden="true" />
      <span className="adm-ld__sr">Opening the dashboard</span>
      <div className="adm-ld__shell" aria-hidden="true">
        <div className="adm-ld__nav"><Sk w={40} h={40} r={12} /><Sk w={104} h={30} r={999} /><i className="adm-ld__grow" /><Sk w={190} h={36} r={999} /><Sk w={36} h={36} r="50%" /></div>
        <div className="adm-ld__head"><Sk w={150} h={12} /><Sk w="min(340px, 70%)" h={44} r={12} /><Sk w="min(520px, 90%)" h={14} /></div>
        <div className="adm-ld__kpis">
          {Array.from({ length: 6 }, (_, i) => <div className="adm-ld__card" key={i}><Sk w="55%" h={11} /><Sk w="70%" h={34} r={10} /><Sk w="100%" h={36} r={8} /></div>)}
        </div>
        <div className="adm-ld__hero">
          <div className="adm-ld__sky">
            <div className="adm-ld__mark"><span className="adm-ld__orbit" /><img src="/brand/logo-mark.png" alt="" /></div>
            <b>Opening the dashboard</b>
          </div>
          <div className="adm-ld__rail"><div className="adm-ld__card"><Sk w="50%" h={14} /><Sk w="100%" h={44} r={10} /><Sk w="100%" h={44} r={10} /><Sk w="100%" h={44} r={10} /></div><div className="adm-ld__card"><Sk w="60%" h={14} /><Sk w="40%" h={36} r={10} /><Sk w="100%" h={8} r={8} /></div></div>
        </div>
      </div>
    </div>
  );
}
