import React, { useState } from 'react';
import { Sliders, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@yggdrasil-lab/ui';
import { RunwayScenarioResult } from '../types';
import { simulateScenario } from '../services/api';

interface ScenarioSimulatorProps {
  baselineBurn: number;
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ baselineBurn }) => {
  const [burnDelta, setBurnDelta] = useState(0);
  const [returnRate, setReturnRate] = useState(0.05);
  const [lumpSum, setLumpSum] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunwayScenarioResult | null>(null);

  const maxDelta = Math.max(500, Math.round(baselineBurn || 1000));

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await simulateScenario({
        weekly_burn_adjustment: burnDelta,
        custom_annual_return: returnRate,
        lump_sum_adjustment: lumpSum,
      });
      setResult(res);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Scenario simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setBurnDelta(0);
    setReturnRate(0.05);
    setLumpSum(0);
    setResult(null);
    setError(null);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Time Machine & Scenario Modeler</h3>
            <p className="text-xs text-slate-400">Simulate how spending & return shifts your freedom horizon</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="xs"
          icon={<RefreshCw className="w-3 h-3" />}
          onClick={handleReset}
        >
          Reset
        </Button>
      </div>

      {/* Sliders */}
      <div className="space-y-4 pt-1">
        {/* Weekly Burn Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Weekly Spend Adjustment</span>
            <span className={`font-semibold ${burnDelta < 0 ? 'text-emerald-400' : burnDelta > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {burnDelta > 0 ? `+$${burnDelta}` : burnDelta < 0 ? `-$${Math.abs(burnDelta)}` : '$0'} /week
            </span>
          </div>
          <input
            type="range"
            min={-maxDelta}
            max={maxDelta}
            step="25"
            value={burnDelta}
            onChange={(e) => setBurnDelta(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-background rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>-${maxDelta}/w (Frugal)</span>
            <span>Current: ${Math.round(baselineBurn)}/w</span>
            <span>+${maxDelta}/w (High Burn)</span>
          </div>
        </div>

        {/* Real Return Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Expected Real Portfolio Return</span>
            <span className="font-semibold text-slate-200">
              {(returnRate * 100).toFixed(1)}% /yr
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.12"
            step="0.005"
            value={returnRate}
            onChange={(e) => setReturnRate(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer h-1.5 bg-background rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0% (Cash only)</span>
            <span>5% (Balanced)</span>
            <span>12% (Bull Market)</span>
          </div>
        </div>

        {/* Action Button */}
        <Button
          variant="secondary"
          size="md"
          fullWidth
          loading={loading}
          loadingText="Simulating..."
          icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
          onClick={handleSimulate}
        >
          Recalculate Freedom Horizon
        </Button>
      </div>

      {/* Simulation Result */}
      {result && (
        <div className="p-4 rounded-xl bg-background/80 border border-border mt-3 space-y-2 animate-fadeIn">
          <div className="text-xs text-slate-400">Simulated Freedom Horizon:</div>
          <div className="flex items-baseline space-x-3">
            <div className="text-3xl font-black text-amber-400">
              {result.is_perpetual ? (
                'Perpetual Freedom'
              ) : (
                <>
                  {result.simulated_runway_weeks ? Math.round(result.simulated_runway_weeks) : 'N/A'}{' '}
                  <span className="text-lg font-semibold text-slate-300">Weeks</span>
                </>
              )}
            </div>

            {result.delta_weeks_compared_to_baseline !== null && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  result.delta_weeks_compared_to_baseline >= 0
                    ? 'text-emerald-300 bg-emerald-500/10'
                    : 'text-rose-300 bg-rose-500/10'
                }`}
              >
                {result.delta_weeks_compared_to_baseline >= 0 ? '+' : ''}
                {result.delta_weeks_compared_to_baseline} weeks
              </span>
            )}
          </div>
          {!result.is_perpetual && result.simulated_runway_years && (
            <p className="text-xs text-slate-400">
              Equivalent to approx <strong>{result.simulated_runway_years} years</strong> of full living autonomy.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
