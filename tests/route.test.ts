import { describe, it, expect } from 'vitest';
import { route, type Candidate } from '@/lib/meta/route';

const reels: Candidate[] = [
  { id: 'f1', keyword: 'طابعة', mediaId: 'MEDIA_1' },
  { id: 'f2', keyword: 'طابعة', mediaId: 'MEDIA_2' },
  { id: 'f4', keyword: 'طابعة', mediaId: 'MEDIA_4' },
  { id: 'f5', keyword: 'resin', mediaId: 'MEDIA_5' },
  { id: 'g1', keyword: 'دليل', mediaId: null }, // one general file for a keyword used on two reels
];

describe('route (reel-specific files)', () => {
  it('same keyword on different reels sends each reel its own file', () => {
    expect(route({ text: 'طابعة', mediaId: 'MEDIA_1' }, reels)).toEqual({ status: 'pending', fileId: 'f1', keyword: 'طابعة' });
    expect(route({ text: 'طابعة', mediaId: 'MEDIA_4' }, reels)).toEqual({ status: 'pending', fileId: 'f4', keyword: 'طابعة' });
  });
  it('a reel with no file for the keyword needs mapping, it never gets another reel\'s file', () => {
    expect(route({ text: 'طابعة', mediaId: 'MEDIA_9' }, reels)).toEqual({ status: 'needs_mapping', keyword: 'طابعة' });
  });
  it('a general file answers any reel that has no file of its own', () => {
    expect(route({ text: 'دليل', mediaId: 'MEDIA_3' }, reels)).toEqual({ status: 'pending', fileId: 'g1', keyword: 'دليل' });
  });
  it('a direct message with a keyword used by several reels asks the admin to choose', () => {
    expect(route({ text: 'طابعة لو سمحت', mediaId: null }, reels)).toEqual({ status: 'needs_choice', keyword: 'طابعة', candidateIds: ['f1', 'f2', 'f4'] });
  });
  it('a direct message with a single-file keyword goes straight to pending', () => {
    expect(route({ text: 'resin', mediaId: null }, reels)).toEqual({ status: 'pending', fileId: 'f5', keyword: 'resin' });
  });
  it('no keyword, no draft', () => {
    expect(route({ text: 'جميل جداً', mediaId: 'MEDIA_1' }, reels)).toEqual({ status: 'none' });
  });
});
