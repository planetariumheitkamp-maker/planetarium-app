import { Camera, Clapperboard, ListPlus, RotateCcw } from 'lucide-react';
import { GoldButton, GhostButton, GoldSlider, ToggleSwitch } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { FisheyeParams } from '@/lib/types';
import { FISHEYE_PRESETS } from '@/lib/fisheye';

const RESOLUTIONS = [1024, 1536, 2048] as const;
export type ExportResolution = (typeof RESOLUTIONS)[number];

const FORMATS = ['png', 'jpeg'] as const;
export type ExportFormat = (typeof FORMATS)[number];

const deg = (v: number) => `${Math.round(v)}°`;
const times = (v: number) => `${v.toFixed(2)}×`;
const off = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;

/** Snap-to-center detent for offset sliders (±0.02, editor.md §4.1). */
function snapCenter(v: number): number {
  return Math.abs(v) <= 0.02 ? 0 : v;
}

/** Log-feel detent for zoom at 1×. */
function zoomDetent(v: number): number {
  return Math.abs(v - 1) <= 0.03 ? 1 : v;
}

function SectionLabel({ children }: { children: string }) {
  return <span className="kicker">{children}</span>;
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  marks,
}: {
  label: string;
  value: number;
  display: (v: number) => string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  marks?: Array<{ at: number; label: string }>;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="font-mono text-xs text-gold tabular-nums">{display(value)}</span>
      </div>
      <GoldSlider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        formatValue={display}
        aria-label={label}
      />
      {marks && (
        <div className="relative mt-1 h-3">
          {marks.map((m) => (
            <span
              key={m.label}
              className="absolute -translate-x-1/2 font-mono text-[8px] uppercase tracking-wider text-ink-faint"
              style={{ left: `${((m.at - min) / (max - min)) * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ControlDeck({
  params,
  onParams,
  onReset,
  horizonMask,
  onHorizonMask,
  activePresetId,
  onPreset,
  resolution,
  onResolution,
  format,
  onFormat,
  hasSource,
  isVideo,
  exporting,
  clipProgress,
  onExportFrame,
  onExportClip,
  onSendToPlaylist,
}: {
  params: FisheyeParams;
  onParams: (p: FisheyeParams) => void;
  onReset: () => void;
  horizonMask: boolean;
  onHorizonMask: (v: boolean) => void;
  activePresetId: string | null;
  onPreset: (id: string) => void;
  resolution: ExportResolution;
  onResolution: (r: ExportResolution) => void;
  format: ExportFormat;
  onFormat: (f: ExportFormat) => void;
  hasSource: boolean;
  isVideo: boolean;
  exporting: 'frame' | 'clip' | null;
  clipProgress: number;
  onExportFrame: () => void;
  onExportClip: () => void;
  onSendToPlaylist: () => void;
}) {
  const set = (patch: Partial<FisheyeParams>) => onParams({ ...params, ...patch });

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line bg-nebula/60 p-4">
      {/* 4.1 PROJECTION */}
      <section className="space-y-4">
        <SectionLabel>Projection</SectionLabel>
        <SliderRow
          label="FOV"
          value={params.fov}
          display={deg}
          min={30}
          max={220}
          step={1}
          onChange={(v) => set({ fov: v })}
          marks={[
            { at: 180, label: '180° dome' },
            { at: 220, label: '220° photo' },
          ]}
        />
        <SliderRow
          label="Azimuth"
          value={params.azimuth}
          display={deg}
          min={0}
          max={360}
          step={1}
          onChange={(v) => set({ azimuth: v })}
        />
        <SliderRow
          label="Tilt"
          value={params.tilt}
          display={deg}
          min={-90}
          max={90}
          step={1}
          onChange={(v) => set({ tilt: v })}
        />
        <SliderRow
          label="Zoom / crop"
          value={params.zoom}
          display={times}
          min={0.25}
          max={3}
          step={0.01}
          onChange={(v) => set({ zoom: zoomDetent(v) })}
        />
        <SliderRow
          label="Center offset X"
          value={params.offsetX}
          display={off}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => set({ offsetX: snapCenter(v) })}
        />
        <SliderRow
          label="Center offset Y"
          value={params.offsetY}
          display={off}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => set({ offsetY: snapCenter(v) })}
        />
        <div className="flex items-center justify-between gap-3 pt-1">
          <GhostButton
            type="button"
            className="px-4 py-1.5 text-[10px]"
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3" /> Reset all
          </GhostButton>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-dim">Dome wireframe</span>
            <ToggleSwitch
              checked={params.wireframe}
              onCheckedChange={(v) => set({ wireframe: v })}
              aria-label="Toggle dome wireframe"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-dim">Safe horizon mask</span>
            <ToggleSwitch
              checked={horizonMask}
              onCheckedChange={onHorizonMask}
              aria-label="Toggle safe horizon mask"
            />
          </div>
        </div>
      </section>

      {/* 4.2 PRESETS */}
      <section className="space-y-3 border-t border-line pt-5">
        <SectionLabel>Presets</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {FISHEYE_PRESETS.map((preset) => {
            const active = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPreset(preset.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-display text-[10px] font-medium uppercase tracking-widest transition-all duration-200 ease-orbital active:scale-95',
                  active
                    ? 'bg-gold text-void shadow-glow-gold'
                    : 'border border-line text-ink-dim hover:border-violet-hi hover:text-ink',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4.3 EXPORT */}
      <section className="space-y-4 border-t border-line pt-5">
        <SectionLabel>Export</SectionLabel>
        <div>
          <span className="mb-1.5 block text-xs text-ink-dim">Resolution (square)</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-dusk/40 p-1">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onResolution(r)}
                className={cn(
                  'rounded-lg py-1.5 font-mono text-[11px] transition-colors duration-200',
                  resolution === r
                    ? 'bg-brand text-ink'
                    : 'text-ink-faint hover:text-ink-dim',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-ink-dim">Format</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-dusk/40 p-1">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFormat(f)}
                title={f === 'jpeg' ? 'JPEG · quality 0.92' : 'PNG · lossless'}
                className={cn(
                  'rounded-lg py-1.5 font-mono text-[11px] uppercase transition-colors duration-200',
                  format === f
                    ? 'bg-brand text-ink'
                    : 'text-ink-faint hover:text-ink-dim',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <GoldButton
          type="button"
          className="w-full text-xs"
          disabled={!hasSource || exporting !== null}
          onClick={onExportFrame}
        >
          <Camera className="h-4 w-4" />
          {exporting === 'frame'
            ? 'Rendering…'
            : `Export Frame (${format.toUpperCase()}) · ${resolution}²`}
        </GoldButton>

        <div className="relative overflow-hidden rounded-full">
          <GoldButton
            type="button"
            className="w-full text-xs"
            disabled={!isVideo || exporting !== null}
            title={isVideo ? 'Record the full warped clip' : 'Load a video to export clips'}
            onClick={onExportClip}
          >
            <Clapperboard className="h-4 w-4" />
            {exporting === 'clip'
              ? `REC ${Math.round(clipProgress * 100)}%`
              : 'Export Clip (WebM)'}
          </GoldButton>
          {exporting === 'clip' && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-void/20"
              style={{ width: `${clipProgress * 100}%` }}
            />
          )}
        </div>
        {!isVideo && (
          <p className="-mt-2 text-center font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            Load a video to export clips
          </p>
        )}

        <GhostButton
          type="button"
          className="w-full text-xs"
          disabled={!hasSource}
          onClick={onSendToPlaylist}
        >
          <ListPlus className="h-4 w-4" /> Send to Playlist →
        </GhostButton>
      </section>
    </aside>
  );
}
