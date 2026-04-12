import type { SimulationState, PlaybackSpeed } from '../hooks/useSimulationState';

interface Props {
  state: SimulationState;
}

export function SimulationPlayer({ state }: Props) {
  const { currentStep, isPlaying, speed, totalSteps, play, pause, setStep, setSpeed, reset } = state;

  const speedOptions: PlaybackSpeed[] = [0.5, 1, 2];

  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
      <button
        onClick={reset}
        className="text-gray-400 hover:text-white text-sm px-2"
        title="Reset"
      >
        ⏮
      </button>
      <button
        onClick={isPlaying ? pause : play}
        disabled={totalSteps === 0}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded px-3 py-1 text-sm font-medium min-w-[60px]"
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <div className="flex items-center gap-2 flex-1">
        <span className="text-gray-400 text-xs whitespace-nowrap">Step {currentStep}/{totalSteps}</span>
        <input
          type="range"
          min={0}
          max={totalSteps}
          value={currentStep}
          onChange={(e) => setStep(Number(e.target.value))}
          disabled={totalSteps === 0}
          className="flex-1 accent-blue-500"
        />
      </div>

      <div className="flex gap-1">
        {speedOptions.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`text-xs px-2 py-1 rounded ${
              speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
