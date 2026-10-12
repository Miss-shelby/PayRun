'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { Preloader } from '@/components/Preloader';
import { PayrollRun, PayrollRow } from '@/lib/payroll/types';
import { generatePayslipPdf, generateAllPayslipsPdf } from '@/lib/payroll/pdfGenerator';
import { getArcNetwork } from '@/lib/chain/constants';

type Payee = {
  id: string;
  name: string;
  address: string;
  role: string;
};


export default function PayeesPage() {
  const activeNet = useMemo(() => getArcNetwork(), []);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);

  // Form inputs for Payee
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRole, setNewRole] = useState('');

  // Selected run for Receipt Modal
  const [selectedRunForReceipt, setSelectedRunForReceipt] = useState<PayrollRun | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const localRuns = localStorage.getItem('payrun_history');
    if (localRuns) {
      try {
        setRuns(JSON.parse(localRuns));
      } catch (e) {
        console.error(e);
      }
    }

    const localPayees = localStorage.getItem('payrun_payees');
    if (localPayees) {
      try {
        setPayees(JSON.parse(localPayees));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Add Payee with Role & LocalStorage persistence
  const handleAddPayee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAddress) {
      alert('Please fill in both Name and Wallet Address');
      return;
    }

    const newPayee: Payee = {
      id: String(Date.now()),
      name: newName,
      address: newAddress,
      role: newRole || 'Team Member',
    };

    const updated = [newPayee, ...payees];
    setPayees(updated);
    localStorage.setItem('payrun_payees', JSON.stringify(updated));

    setNewName('');
    setNewAddress('');
    setNewRole('');
  };

  // Remove Payee with LocalStorage persistence
  const handleRemovePayee = (id: string) => {
    const updated = payees.filter((p) => p.id !== id);
    setPayees(updated);
    localStorage.setItem('payrun_payees', JSON.stringify(updated));
  };

  // Delete Run from History with LocalStorage persistence
  const handleDeleteRun = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this run from history?')) {
      const updated = runs.filter((r) => r.id !== id);
      setRuns(updated);
      localStorage.setItem('payrun_history', JSON.stringify(updated));
    }
  };

  // Download PDF Payslip helper (Single)
  const handleDownloadPayslip = async (run: PayrollRun, row: PayrollRow) => {
    const pdfBytes = await generatePayslipPdf(
      row,
      run.title,
      run.token,
      run.txHash
    );
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${row.name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  // Download Unified Multi-page PDF for all rows in a run
  const handleDownloadAllPayslipsForRun = async (run: PayrollRun) => {
    if (!run.rows || run.rows.length === 0) return;

    if (run.rows.length === 1) {
      await handleDownloadPayslip(run, run.rows[0]);
      return;
    }

    const pdfBytes = await generateAllPayslipsPdf(
      run.rows,
      run.title,
      run.token,
      run.txHash
    );
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (run.title || 'payroll_run').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `all_payslips_${safeTitle}.pdf`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F7F5EC] text-[#1A2218] font-sans flex flex-col selection:bg-[#DCE8D8]">
      <Preloader />

      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#F7F5EC]/95 backdrop-blur-md border-b border-[#E2DAC4]/80 px-8 py-4 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#DCE5D5] flex items-center justify-center text-[#2A3F2A]">
              <span className="font-serif font-bold text-sm">P</span>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-[#1A2218]">
              PayRun
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A5546]">
            <Link href="/" className="hover:text-[#1A2218] transition-colors">
              Create Run
            </Link>
            <span className="text-[#1A2218] font-bold cursor-pointer">Run History</span>
            <span className="text-[#1A2218] font-bold cursor-pointer">Payees</span>
          </nav>

          <div className="flex items-center gap-3">
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10 space-y-8">
        {/* ALWAYS PRESENT BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs text-[#6B7E64] font-medium">
          <Link href="/" className="hover:underline">
            PayRun Home
          </Link>
          <span>/</span>
          <span>Run History & Payees Directory</span>
        </div>

        {/* 2-COLUMN GRID (LEFT: RUN HISTORY, RIGHT: PAYEES) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* LEFT COLUMN: RUN HISTORY (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#1A2218] tracking-tight">
                Run history
              </h1>
              {runs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear all run history?')) {
                      setRuns([]);
                      localStorage.removeItem('payrun_history');
                    }
                  }}
                  className="text-xs text-rose-600 hover:underline font-medium cursor-pointer"
                >
                  Clear history
                </button>
              )}
            </div>

            {runs.length === 0 ? (
              <div className="bg-[#FAF8F3] p-8 rounded-2xl border border-[#E8E2D2] text-center space-y-3 shadow-sm">
                <div className="text-3xl">🌿</div>
                <h3 className="font-serif text-xl text-[#1A2218]">No payout runs recorded</h3>
                <p className="text-xs text-[#5C6658]">
                  Once you execute a payroll run, it will appear here with instant receipt downloads, PDF payslips, and Arc Explorer links.
                </p>
                <Link
                  href="/"
                  className="inline-block px-5 py-2.5 rounded-xl bg-[#2C422C] text-white text-xs font-semibold hover:bg-[#1E301E] transition-all"
                >
                  Start a run →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRunForReceipt(run)}
                    className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-3 hover:shadow-md transition-all relative group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg text-[#1A2218]">
                        {run.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-[#DCE8D8] text-[#2E502E] text-xs font-semibold">
                          Executed
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRun(run.id, e)}
                          title="Delete run"
                          className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#5C6658]">
                      {run.recipientCount} {run.recipientCount === 1 ? 'recipient' : 'recipients'} · {run.totalAmount} {run.token} ·{' '}
                      {run.createdAt}
                    </p>

                    <p className="font-mono text-xs text-[#7A8576] break-all">
                      Tx {(run.txHash || '').length > 20
                        ? `${(run.txHash || '').slice(0, 10)}...${(run.txHash || '').slice(-6)}`
                        : run.txHash || ''}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRunForReceipt(run);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                      >
                        View Receipt & Payslips
                      </button>

                      <a
                        href={`${activeNet.explorerUrl}/tx/${run.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 rounded-xl bg-[#EAE4D3] hover:bg-[#DDD6C3] text-[#2C422C] text-xs font-semibold transition-all cursor-pointer"
                      >
                        Arc Explorer ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: PAYEES (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#1A2218] tracking-tight">
                Payees
              </h1>
              {payees.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear all saved payees?')) {
                      setPayees([]);
                      localStorage.removeItem('payrun_payees');
                    }
                  }}
                  className="text-xs text-rose-600 hover:underline font-medium cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* ADD PAYEE FORM CARD WITH CLEAR NAME, ADDRESS, & ROLE INPUTS */}
            <form
              onSubmit={handleAddPayee}
              className="bg-[#FAF8F3] p-5 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-3"
            >
              <div className="text-xs font-semibold text-[#6B7E64] uppercase tracking-wider">
                Add New Payee
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <input
                  type="text"
                  placeholder="Payee Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="sm:col-span-4 px-3.5 py-2.5 rounded-xl bg-[#F2ECE0] border border-[#E2DCD0] text-xs text-[#1A2218] placeholder-[#8E9B94] focus:outline-none focus:border-[#2C422C]"
                />

                <input
                  type="text"
                  placeholder="0x... Wallet Address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="sm:col-span-4 px-3.5 py-2.5 rounded-xl bg-[#F2ECE0] border border-[#E2DCD0] text-xs font-mono text-[#1A2218] placeholder-[#8E9B94] focus:outline-none focus:border-[#2C422C]"
                />

                <input
                  type="text"
                  placeholder="Role (e.g. Lead Dev)"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="sm:col-span-4 px-3.5 py-2.5 rounded-xl bg-[#F2ECE0] border border-[#E2DCD0] text-xs text-[#1A2218] placeholder-[#8E9B94] focus:outline-none focus:border-[#2C422C]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  + Add Payee to Directory
                </button>
              </div>
            </form>

            {/* PAYEES TABLE */}
            {payees.length === 0 ? (
              <div className="bg-[#FAF8F3] p-8 rounded-2xl border border-[#E8E2D2] text-center space-y-2 shadow-sm">
                <div className="text-2xl">👥</div>
                <h4 className="font-serif text-lg text-[#1A2218]">No saved payees</h4>
                <p className="text-xs text-[#5C6658]">
                  Add your team members or grant recipients above. They save permanently in your browser and feed directly into your CSV payout runs!
                </p>
              </div>
            ) : (
              <div className="bg-[#FAF8F3] rounded-2xl border border-[#E8E2D2] shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#EEE8DA] border-b border-[#E8E2D2] text-[#5C6658] uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6 font-semibold">NAME</th>
                      <th className="py-3.5 px-6 font-semibold">ADDRESS</th>
                      <th className="py-3.5 px-6 font-semibold">ROLE</th>
                      <th className="py-3.5 px-6 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D2]">
                    {payees.map((payee) => (
                      <tr key={payee.id} className="hover:bg-[#F5F1E6]/50 transition-colors">
                        <td className="py-4 px-6 font-medium text-[#1A2218]">
                          {payee.name}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-[#1A2218]">
                          {payee.address.length > 15
                            ? `${payee.address.slice(0, 6)}...${payee.address.slice(-4)}`
                            : payee.address}
                        </td>
                        <td className="py-4 px-6 text-xs text-[#5C6658]">
                          {payee.role || 'Team Member'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemovePayee(payee.id)}
                            className="px-3 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* RECEIPT & PAYSLIPS MODAL */}
      {selectedRunForReceipt && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF8F3] rounded-3xl p-8 max-w-xl w-full border border-[#E8E2D2] space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedRunForReceipt(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 text-lg font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-[#DCE8D8] text-[#2E502E] text-xs font-semibold">
                Executed Payout Receipt
              </span>
              <h3 className="font-serif font-bold text-2xl text-[#1A2218]">
                {selectedRunForReceipt.title}
              </h3>
              <p className="text-xs font-mono text-[#5C6658] break-all">
                Tx {selectedRunForReceipt.txHash}
              </p>
            </div>

            <div className="bg-[#F7F5EC] p-5 rounded-2xl border border-[#E2DCD0] space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Total Amount:</span>
                <span className="font-bold text-sm text-[#2C422C]">
                  {selectedRunForReceipt.totalAmount} {selectedRunForReceipt.token}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Recipients Count:</span>
                <span className="font-semibold text-[#1A2218]">
                  {selectedRunForReceipt.recipientCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Date Executed:</span>
                <span className="font-semibold text-[#1A2218]">
                  {selectedRunForReceipt.createdAt}
                </span>
              </div>
            </div>

            {/* Recipient Rows & Payslips */}
            {selectedRunForReceipt.rows && selectedRunForReceipt.rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-sm text-[#1A2218]">
                    Download Official Payslip PDFs:
                  </h4>
                  {selectedRunForReceipt.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDownloadAllPayslipsForRun(selectedRunForReceipt)}
                      className="px-3 py-1 rounded-lg bg-[#34D399] text-[#0C1813] font-bold text-xs hover:bg-[#28B884] transition-colors cursor-pointer"
                    >
                      📦 Download All in 1 PDF
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedRunForReceipt.rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E2D2] text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#1A2218]">{row.name}</div>
                        <div className="text-[11px] text-[#5C6658]">
                          {row.amount} {selectedRunForReceipt.token} • {row.memo}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadPayslip(selectedRunForReceipt, row)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#2C422C] text-white text-xs font-semibold hover:bg-[#1E301E] transition-colors"
                      >
                        📄 Download PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <a
                href={`${activeNet.explorerUrl}/tx/${selectedRunForReceipt.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#2C422C] font-bold underline"
              >
                View on Arc Explorer ↗
              </a>

              <button
                type="button"
                onClick={() => setSelectedRunForReceipt(null)}
                className="px-6 py-2.5 rounded-xl bg-[#2C422C] text-white text-xs font-semibold"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#E6E0CE] bg-[#EEE8DA] py-8 px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C6658]">
          <div>PayRun • 2026</div>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-[#1A2218]">
              Docs
            </Link>
            <a
              href={activeNet.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#1A2218]"
            >
              Arc Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
