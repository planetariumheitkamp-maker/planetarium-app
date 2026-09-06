/** Shared data model — design.md §10 */

export type MediaType = 'image' | 'video';
export type MediaSource = 'imported' | 'bundled' | 'render';

export interface FisheyeParams {
  /** Field of view, degrees: 30–220 (default 180) */
  fov: number;
  /** Rotation around the dome axis, degrees: 0–360 */
  azimuth: number;
  /** Tilt up/down, degrees: -90–90 */
  tilt: number;
  /** Zoom factor: 0.25–3 */
  zoom: number;
  /** Frame offset, normalized: -1–1 */
  offsetX: number;
  offsetY: number;
  /** Show dome wireframe overlay */
  wireframe: boolean;
}

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  source: MediaSource;
  /** Binary payload for imported/rendered items (IndexedDB-persisted) */
  blob?: Blob;
  /** Small preview blob */
  thumbnailBlob?: Blob;
  /** Static path for bundled items, e.g. `/media/earth.jpg` */
  path?: string;
  /** Seconds — video length or configured image display duration */
  duration?: number;
  width?: number;
  height?: number;
  tags: string[];
  fisheyeParams?: FisheyeParams;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistEntry {
  id: string;
  mediaId: string;
  order: number;
  /** Seconds an image stays on screen in auto mode (overrides default) */
  durationOverride?: number;
}

export interface StorageUsage {
  /** Bytes used (best estimate) */
  usage: number;
  /** Bytes available (quota) — 0 when unknown */
  quota: number;
  /** usage / quota in 0..1 — 0 when unknown */
  ratio: number;
}
