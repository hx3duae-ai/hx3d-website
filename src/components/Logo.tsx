export default function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return <span className={`logo ${size}`} aria-label="HX"><span className="h">H</span><span className="x">X</span></span>;
}
