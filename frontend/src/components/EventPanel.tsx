import { useState } from 'react';
import type { EventSimRequest, EventType } from '../types';

interface Props {
  onRunSimulation: (req: EventSimRequest) => void;
  isLoading: boolean;
}

const DEMO: EventSimRequest = {
  company_name: 'TechCorp',
  event_description: 'TechCorp announces unexpected CEO resignation amid internal restructuring. No official statement on successor yet.',
  event_type: 'negative',
};

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; border: string }> = {
  positive: { label: 'Positive', color: 'text-green-400', border: 'border-green-400/60' },
  negative: { label: 'Negative', color: 'text-risk', border: 'border-risk/60' },
  neutral:  { label: 'Neutral',  color: 'text-dim',  border: 'border-edge-hi' },
};

export function EventPanel({ onRunSimulation, isLoading }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('neutral');

  const handleRun = () => {
    if (!companyName || !eventDescription) return;
    onRunSimulation({ company_name: companyName, event_description: eventDescription, event_type: eventType, n_steps: 20 });
  };

  const inputClass = "w-full bg-card text-fore rounded px-3 py-2 text-sm border border-edge focus:border-sig/60 focus:outline-none transition-colors placeholder:text-ghost";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          onClick={() => { setCompanyName(DEMO.company_name); setEventDescription(DEMO.event_description); setEventType(DEMO.event_type); }}
          className="text-[10px] font-mono px-2 py-0.5 rounded border border-edge text-ghost hover:text-sig hover:border-sig/50 transition-colors"
        >
          Demo
        </button>
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Company Name</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. TechCorp"
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Event Description</label>
        <textarea
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          placeholder="Describe the event that occurred..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Event Type</label>
        <div className="flex gap-2">
          {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
            const cfg = EVENT_TYPE_CONFIG[type];
            const active = eventType === type;
            return (
              <button
                key={type}
                onClick={() => setEventType(type)}
                className={`flex-1 py-1.5 text-xs font-bold tracking-wide rounded border transition-colors ${
                  active
                    ? `${cfg.color} ${cfg.border} bg-white/5`
                    : 'text-ghost border-edge hover:border-edge-hi'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={!companyName || !eventDescription || isLoading}
        className="btn-neon w-full py-2 text-xs font-bold tracking-widest"
      >
        {isLoading ? 'SIMULATING...' : 'RUN EVENT SIMULATION'}
      </button>
    </div>
  );
}
