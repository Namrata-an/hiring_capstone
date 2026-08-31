import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Target, ChevronDown, ChevronUp, Star } from 'lucide-react';
import type { PreviousRoundContext as PreviousRoundContextType } from '../apiService';

interface PreviousRoundContextProps {
  context: PreviousRoundContextType;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

export const PreviousRoundContext: React.FC<PreviousRoundContextProps> = ({
  context,
  isCollapsible = true,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div 
      className="glass-card overflow-hidden border-l-4 border-[#0070f3]"
      data-testid="previous-review-context"
    >
      {/* Header */}
      <button
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        className={`w-full p-4 flex items-center justify-between text-white ${
          isCollapsible ? 'hover:bg-[#f4f4f5] cursor-pointer' : ''
        } transition-colors`}
        disabled={!isCollapsible}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center">
            <Target className="w-5 h-5 text-[#0070f3]" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold">Round {context.previousRound} Context</h3>
            <p className="text-sm text-gray-400">
              Reviewed by {context.reviewer} • 
              <span className="ml-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-3 h-3 inline ${
                      star <= context.overallRating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'
                    }`}
                  />
                ))}
              </span>
            </p>
          </div>
        </div>
        {isCollapsible && (
          isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-[#e4e4e7] p-4 space-y-4">
          {/* Gold Areas */}
          <div data-testid="gold-areas">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <h4 className="text-sm font-medium text-green-400 uppercase tracking-wide">Gold Areas (Strengths)</h4>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              {context.goldAreas.length > 0 ? (
                <ul className="space-y-2">
                  {context.goldAreas.map((area, idx) => (
                    <li key={idx} className="text-green-300 text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {area}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No specific strengths noted</p>
              )}
            </div>
          </div>

          {/* Grey Areas */}
          <div data-testid="grey-areas">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-medium text-yellow-400 uppercase tracking-wide">Grey Areas (Needs Probing)</h4>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              {context.greyAreas.length > 0 ? (
                <ul className="space-y-2">
                  {context.greyAreas.map((area, idx) => (
                    <li key={idx} className="text-yellow-300 text-sm flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">!</span>
                      {area}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No specific concerns noted</p>
              )}
            </div>
          </div>

          {/* Suggested Focus Areas */}
          {context.suggestedFocusAreas && context.suggestedFocusAreas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[#0070f3]" />
                <h4 className="text-sm font-medium text-[#0070f3] uppercase tracking-wide">Suggested Focus for This Round</h4>
              </div>
              <div className="bg-[#eff6ff] border border-[#0070f3]/30 rounded-lg p-3">
                <ul className="space-y-2">
                  {context.suggestedFocusAreas.map((area, idx) => (
                    <li key={idx} className="text-orange-300 text-sm flex items-start gap-2">
                      <span className="text-[#0070f3] mt-0.5">→</span>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
