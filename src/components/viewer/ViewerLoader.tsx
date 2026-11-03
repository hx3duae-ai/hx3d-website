'use client';
import dynamic from 'next/dynamic';
import type { VStrings } from '@/lib/viewer/strings';
const Viewer = dynamic(() => import('./Viewer'), { ssr: false, loading: () => <div className="vw-load" /> });
export default function ViewerLoader({ t, lang }: { t: VStrings; lang: 'ar' | 'en' }) { return <Viewer t={t} lang={lang} />; }
