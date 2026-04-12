import type { SimulationState, PlaybackSpeed } from '../hooks/useSimulationState';

interface Props {
  state: SimulationState;
}

export function SimulationPlayer({ state }: Props) {
  const { currentStep, isPlaying, speed, totalSteps, play, pause, setStep, setSpeed, reset } = state;

  const speedOptions: PlaybackSpeed[] = [0.5, 1, 2];

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={reset}
        className="btn-ghost px-2 py-1 text-base leading-none"
        title="Reset"
      >
        ⏮
      </button>
      <button
        onClick={isPlaying ? pause : play}
        disabled={totalSteps === 0}
        className={`${isPlaying ? 'btn-sig' : 'btn-neon'} px-4 py-1.5 text-xs font-bold tracking-widest min-w-[72px]`}
      >
        {isPlaying ? 'PAUSE' : 'PLAY'}
      </button>

      <div className="flex items-center gap-2 flex-1">
        <span className="text-xs font-mono whitespace-nowrap">
          <span className="text-sig">{currentStep}</span>
          <span className="text-ghost">/{totalSteps}</span>
        </span>
        <input
          type="range"
          min={0}
          max={totalSteps}
          value={currentStep}
          onChange={(e) => setStep(Number(e.target.value))}
          disabled={totalSteps === 0}
          className="flex-1 h-1"
        />
      </div>

      <div className="flex gap-1">
        {speedOptions.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`${speed === s ? 'btn-ghost-active' : 'btn-ghost'} text-xs px-2 py-1 font-mono`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
