'use client';
import dynamic from 'next/dynamic';
import type { CK } from '@/lib/checker/strings';
type Strings = (typeof CK)['ar'];
const CheckerTool = dynamic(() => import('./CheckerTool'), { ssr: false, loading: () => <div className="vw-load" /> });
export default function CheckerLoader({ t }: { t: Strings }) { return <CheckerTool t={t} />; }
