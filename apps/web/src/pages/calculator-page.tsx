import { useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';

const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];

export function CalculatorPage() {
  const [display, setDisplay] = useState('0');
  const [saleAmount, setSaleAmount] = useState('');
  const [rate, setRate] = useState('1');
  const isOperator = (value: string) => ['÷', '×', '−', '+'].includes(value);
  const press = (key: string) => {
    if (key === '=') {
      try {
        const value = display.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
        if (!/^[0-9.+*/\- ]+$/.test(value)) return;
        const result = Function(`"use strict"; return (${value})`)();
        setDisplay(Number.isFinite(result) ? String(Number(result.toFixed(6))) : 'Error');
      } catch { setDisplay('Error'); }
      return;
    }
    setDisplay((current) => {
      if (current === 'Error') return isOperator(key) ? '0' + key : key;
      if (isOperator(key)) return isOperator(current.at(-1) ?? '') ? current.slice(0, -1) + key : current + key;
      if (current === '0' && key !== '.') return key;
      if (key === '.' && current.split(/[+−×÷]/).at(-1)?.includes('.')) return current;
      return current + key;
    });
  };
  const amount = Number(saleAmount) || 0;
  const percentage = Number(rate) || 0;
  const commission = amount * percentage / 100;
  return <section className="max-w-4xl">
    <p className="text-sm text-slate-500">Workspace / Calculator</p>
    <div className="mt-2 flex items-center gap-3"><Calculator className="text-gold" size={28} /><div><h2 className="text-2xl font-bold text-navy">Employee calculator</h2><p className="mt-1 text-sm text-slate-600">Quick calculations for every employee, including sales commission.</p></div></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-navy">Quick calculator</h3><button onClick={() => setDisplay('0')} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy"><RotateCcw size={15} />Clear</button></div>
        <div className="mt-4 overflow-x-auto rounded-lg bg-slate-950 px-4 py-5 text-right font-mono text-3xl text-white">{display}</div>
        <div className="mt-4 grid grid-cols-4 gap-2">{keys.map((key) => <button key={key} onClick={() => press(key)} className={`rounded-lg py-3 text-lg font-semibold transition ${key === '=' ? 'bg-gold text-navy hover:bg-amber-400' : isOperator(key) ? 'bg-navy text-white hover:bg-[#0d2d49]' : 'border bg-slate-50 text-navy hover:bg-slate-100'}`}>{key}</button>)}</div>
      </article>
      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-navy">Sales incentive estimate</h3>
        <p className="mt-1 text-sm text-slate-500">Calculate the incentive for a booking, payment, or sale amount.</p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">Amount (₹)<input type="number" min="0" placeholder="e.g. 2500000" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
          <label className="block text-sm font-medium text-slate-700">Incentive rate (%)<input type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
        </div>
        <div className="mt-6 rounded-lg bg-emerald-50 p-5"><p className="text-sm font-medium text-emerald-800">Estimated incentive</p><p className="mt-1 text-3xl font-bold text-emerald-900">₹{commission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p><p className="mt-2 text-xs text-emerald-800">This is an estimate only. Final incentives are controlled in Team management.</p></div>
      </article>
    </div>
  </section>;
}
