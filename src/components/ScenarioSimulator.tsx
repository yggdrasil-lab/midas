import React, { useState } from 'react';
import { Sliders, RefreshCw, Zap, Sparkles } from 'lucide-react';
import { Button, RangeSlider, AlertBanner, GlassCard, CollapsibleSection, AiSynthesizerModal } from '@yggdrasil-lab/ui';
import { RunwayAiSynthesisResult, RunwayScenarioResult } from '../types';
import { simulateScenario, synthesizeRunway } from '../services/api';

interface ScenarioSimulatorProps {
  baselineBurn: number;
}

const RUNWAY_PILLARS = [
  {
    label: 'Safe Withdrawal Floor',
    description: 'Trinity Study 4% rule and Bengen sequence of returns protection for perpetual capital.',
  },
  {
    label: 'Dynamic Burn Titration',
    description: 'Kitces and Guyton-Klinger spending guardrails to titrate discretionary spend during drawdowns.',
  },
  {
    label: 'Liquidity Waterfall',
    description: 'Protect 26-week liquid cash buffer before relying on volatile growth equity yield.',
  },
  {
    label: 'Autonomy Horizon',
    description: 'Prioritize structural weekly burn reduction over speculative return chasing.',
  },
];

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ baselineBurn }) => {
  const [burnDelta, setBurnDelta] = useState(0);
  const [returnRate, setReturnRate] = useState(0.05);
  const [lumpSum, setLumpSum] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunwayScenarioResult | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSynthesis, setAiSynthesis] = useState<RunwayAiSynthesisResult | null>(null);

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

  const handleAiSynthesize = async (customContext?: string) => {
    setError(null);
    try {
      const res = await synthesizeRunway({
        weekly_burn_adjustment: burnDelta,
        custom_annual_return: returnRate,
        lump_sum_adjustment: lumpSum,
        custom_context: customContext,
      });
      setAiSynthesis(res);
      setResult({
        simulated_runway_weeks: res.simulated_runway_weeks ?? null,
        simulated_runway_years: res.simulated_runway_years ?? null,
        is_perpetual: res.is_perpetual,
        delta_weeks_compared_to_baseline: res.delta_weeks_compared_to_baseline ?? null,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'AI runway synthesis failed');
      throw err;
    }
  };

  const handleReset = () => {
    setBurnDelta(0);
    setReturnRate(0.05);
    setLumpSum(0);
    setResult(null);
    setAiSynthesis(null);
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

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
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

          <Button
            variant="amber"
            size="md"
            fullWidth
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setIsAiModalOpen(true)}
          >
            AI Freedom Advisor
          </Button>
        </div>
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

      {/* AI Freedom Synthesis Insights */}
      {aiSynthesis && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mt-3 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI Freedom Protocol
            </span>
            <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded-full bg-background/50 border border-border">
              {aiSynthesis.is_llm_generated ? 'Muninn app-synthesize' : 'Deterministic Guardrails'}
            </span>
          </div>

          <div className="text-sm font-semibold text-slate-100">
            {aiSynthesis.headline}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {aiSynthesis.rationale}
          </p>

          {aiSynthesis.recommendations.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Actionable Levers:
              </div>
              {aiSynthesis.recommendations.map((rec, idx) => (
                <div key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {aiSynthesis.research_citation && (
            <CollapsibleSection
              variant="inline"
              icon="📚"
              title={aiSynthesis.research_citation}
              className="mt-2 text-xs"
            >
              <div>🏛️ <strong>Bengen and Trinity Study:</strong> 4% safe withdrawal floor establishes the boundary where asset growth matches living burn.</div>
              <div>📉 <strong>Kitces Guardrails:</strong> Titrating discretionary spend downwards during market drawdowns preserves capital.</div>
              <div>💧 <strong>Liquidity Waterfall:</strong> Maintain cash floor (26+ weeks) to avoid liquidating equities during drawdowns.</div>
            </CollapsibleSection>
          )}
        </div>
      )}

      <AiSynthesizerModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title="AI Freedom Runway Advisor"
        subtitle="Trinity Study, Safe Withdrawal & Kitces Dynamic Burn Titration"
        citationTitle="Trinity Study (Safe Withdrawal) & Kitces (Dynamic Burn Titration)"
        variant="amber"
        pillars={RUNWAY_PILLARS}
        inputLabel="Lifestyle Adjustments, Goals, or Sabbatical Notes (Optional)"
        inputPlaceholder="e.g. Planning a 4-month sabbatical; moving to lower-cost housing in Takapuna; receiving a $10,000 bonus"
        submitLabel="Synthesize Freedom Scenario"
        onSynthesize={handleAiSynthesize}
      />
    </GlassCard>
  );
};
