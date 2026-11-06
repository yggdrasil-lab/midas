import React, { useState } from 'react';
import { Sliders, RefreshCw, Zap } from 'lucide-react';
import { Button, RangeSlider, AlertBanner, GlassCard } from '@yggdrasil-lab/ui';
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
    <GlassCard className="space-y-4">
      {error && (
        <AlertBanner variant="error">
          {error}
        </AlertBanner>
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
        <RangeSlider
          label="Weekly Spend Adjustment"
          valueDisplay={`${burnDelta > 0 ? `+$${burnDelta}` : burnDelta < 0 ? `-$${Math.abs(burnDelta)}` : '$0'} /week`}
          valueClassName={burnDelta < 0 ? 'text-emerald-400' : burnDelta > 0 ? 'text-rose-400' : 'text-slate-200'}
          min={-maxDelta}
          max={maxDelta}
          step={25}
          value={burnDelta}
          onChange={setBurnDelta}
          minLabel={`-$${maxDelta}/w (Frugal)`}
          midLabel={`Current: $${Math.round(baselineBurn)}/w`}
          maxLabel={`+$${maxDelta}/w (High Burn)`}
          variant="amber"
        />

        {/* Real Return Slider */}
        <RangeSlider
          label="Expected Real Portfolio Return"
          valueDisplay={`${(returnRate * 100).toFixed(1)}% /yr`}
          min={0.0}
          max={0.12}
          step={0.005}
          value={returnRate}
          onChange={setReturnRate}
          minLabel="0% (Cash only)"
          midLabel="5% (Balanced)"
          maxLabel="12% (Bull Market)"
          variant="sky"
        />

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
    </GlassCard>
  );
};
