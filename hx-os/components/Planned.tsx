export default function Planned({ n, title, pitch, plan, links }: { n: number; title: string; pitch: string; plan: string[]; links?: string[] }) {
  return (
    <>
      <div className="head">
        <div>
          <h1>
            <span className="muted">{n}.</span> {title}
          </h1>
          <p>{pitch}</p>
        </div>
        <span className="chip">المرحلة التالية</span>
      </div>
      <div className="card planned">
        <b>الخطة</b>
        <ul>
          {plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        {links && <div className="muted small" style={{ marginTop: 12 }}>مربوط مع: {links.join(" · ")}</div>}
      </div>
    </>
  );
}
