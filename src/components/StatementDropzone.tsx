import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { StatementParseResult } from '../types';
import { uploadStatement } from '../services/api';

interface StatementDropzoneProps {
  onSuccess: () => void;
}

export const StatementDropzone: React.FC<StatementDropzoneProps> = ({ onSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [institution, setInstitution] = useState('ASB');
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [committed, setCommitted] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setCommitted(false);
    try {
      const res = await uploadStatement(file, institution, false);
      setParseResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndSync = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await uploadStatement(file, institution, true, 1);
      setCommitted(true);
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setCommitted(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Statement Ingestion Hub</h3>
            <p className="text-xs text-slate-400">Upload bank or brokerage PDF/CSV to anchor balances</p>
          </div>
        </div>

        <select
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="bg-background border border-border text-xs text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
        >
          <option value="ASB">ASB Bank</option>
          <option value="ANZ">ANZ NZ</option>
          <option value="BNZ">BNZ</option>
          <option value="Sharesies">Sharesies</option>
          <option value="Simplicity">Simplicity KiwiSaver</option>
          <option value="Kernel">Kernel Wealth</option>
        </select>
      </div>

      {!parseResult ? (
        /* Upload Drag and Drop Zone */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragActive ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-slate-600 bg-background/50'
          }`}
        >
          <input
            type="file"
            accept=".pdf,.csv"
            id="statement-upload"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="statement-upload" className="cursor-pointer space-y-2 block">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-300 font-medium">
              {file ? (
                <span className="text-amber-400 font-semibold">{file.name}</span>
              ) : (
                <>
                  <span>Drop your PDF/CSV statement here, or </span>
                  <span className="text-amber-400 underline">browse</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              Extracts official closing balances and deduplicated transactions
            </p>
          </label>

          {file && (
            <button
              onClick={handleParse}
              disabled={loading}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-border inline-flex items-center space-x-1.5 transition-all"
            >
              <span>{loading ? 'Parsing Statement...' : 'Inspect Statement'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* Extraction Preview Drawer */
        <div className="bg-background rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
            <span className="text-slate-400 font-medium">Detected from {file?.name}</span>
            <button onClick={handleReset} className="text-slate-400 hover:text-slate-200 text-xs">
              Upload Different
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-card rounded-lg border border-border/80">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Official Closing Balance</span>
              <div className="text-lg font-bold text-emerald-400">
                {parseResult.closing_balance !== null && parseResult.closing_balance !== undefined
                  ? `$${parseResult.closing_balance.toLocaleString('en-NZ')} NZD`
                  : 'N/A'}
              </div>
            </div>

            <div className="p-2.5 bg-card rounded-lg border border-border/80">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Transactions Found</span>
              <div className="text-lg font-bold text-slate-200">
                {parseResult.transaction_count} <span className="text-xs font-normal text-slate-400">items</span>
              </div>
            </div>
          </div>

          {parseResult.transactions.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {parseResult.transactions.slice(0, 5).map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-card/50">
                  <span className="text-slate-300 truncate max-w-[200px]">{tx.merchant}</span>
                  <span className={tx.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}>
                    ${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {parseResult.transactions.length > 5 && (
                <div className="text-center text-[10px] text-slate-500 pt-1">
                  +{parseResult.transactions.length - 5} more transactions
                </div>
              )}
            </div>
          )}

          {!committed ? (
            <button
              onClick={handleConfirmAndSync}
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Synchronizing...' : 'Confirm & Anchor Balances in Plutus'}</span>
            </button>
          ) : (
            <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-400 py-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Statement Synchronized & Anchored!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
