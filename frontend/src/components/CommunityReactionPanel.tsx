import type { CommunityReaction } from '../types';

interface Props {
  communityReactions: Record<string, CommunityReaction>;
}

export function CommunityReactionPanel({ communityReactions }: Props) {
  const entries = Object.entries(communityReactions).sort((a, b) =>
    Math.abs(b[1].avg_sentiment) - Math.abs(a[1].avg_sentiment)
  );

  if (entries.length === 0) {
    return <div className="text-ghost text-xs font-mono text-center py-4">No reaction data</div>;
  }

  const sentimentColor = (v: number) => {
    if (v > 0.2) return 'text-green-400';
    if (v < -0.2) return 'text-risk';
    return 'text-dim';
  };

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([community, reaction]) => (
        <div key={community} className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-mid truncate max-w-[120px]">{community}</span>
            <span className={`text-[10px] font-mono font-bold ${sentimentColor(reaction.avg_sentiment)}`}>
              {reaction.avg_sentiment > 0 ? '+' : ''}{reaction.avg_sentiment.toFixed(2)}
            </span>
          </div>

          {/* Stacked bar */}
          <div className="flex h-4 rounded overflow-hidden">
            {reaction.repost_pct > 0 && (
              <div
                className="flex items-center justify-center"
                style={{ width: `${reaction.repost_pct * 100}%`, backgroundColor: '#7c3aed' }}
                title={`Repost: ${(reaction.repost_pct * 100).toFixed(0)}%`}
              >
                {reaction.repost_pct > 0.15 && (
                  <span className="text-[8px] font-mono text-white">
                    {(reaction.repost_pct * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
            {reaction.comment_pct > 0 && (
              <div
                className="flex items-center justify-center"
                style={{ width: `${reaction.comment_pct * 100}%`, backgroundColor: '#0ea5e9' }}
                title={`Comment: ${(reaction.comment_pct * 100).toFixed(0)}%`}
              >
                {reaction.comment_pct > 0.15 && (
                  <span className="text-[8px] font-mono text-white">
                    {(reaction.comment_pct * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
            {reaction.ignore_pct > 0 && (
              <div
                className="flex items-center justify-center"
                style={{ width: `${reaction.ignore_pct * 100}%`, backgroundColor: '#374151' }}
                title={`Ignore: ${(reaction.ignore_pct * 100).toFixed(0)}%`}
              >
                {reaction.ignore_pct > 0.15 && (
                  <span className="text-[8px] font-mono text-ghost">
                    {(reaction.ignore_pct * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-3 pt-1">
        {[
          { color: '#7c3aed', label: 'Repost' },
          { color: '#0ea5e9', label: 'Comment' },
          { color: '#374151', label: 'Ignore' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono text-ghost">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
