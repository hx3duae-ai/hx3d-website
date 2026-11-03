/** Build volumes in mm. Values are settings, to be confirmed by the owner for the actual machine. */
export type Printer = { id: string; name: string; x: number; y: number; z: number };
export const PRINTERS: Printer[] = [
  { id: 'bambu-p2s', name: 'Bambu Lab P2S', x: 256, y: 256, z: 256 },
];
export const DEFAULT_PRINTER = PRINTERS[0];

export type Fit = 'inside' | 'exceeds';
export function fitsBed(size: { x: number; y: number; z: number }, p: Printer): Fit {
  return size.x <= p.x && size.y <= p.y && size.z <= p.z ? 'inside' : 'exceeds';
}
