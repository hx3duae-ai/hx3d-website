'use client';
import dynamic from 'next/dynamic';
import type { VStrings } from '@/lib/viewer/strings';
const Viewer = dynamic(() => import('./Viewer'), { ssr: false, loading: () => <div className="vw-load" /> });
export default function ViewerLoader({ t }: { t: VStrings }) { return <Viewer t={t} />; }
