'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { generatePayslipPdf } from '@/lib/payroll/pdfGenerator';
import { Preloader } from '@/components/Preloader';
import { getArcNetwork } from '@/lib/chain/constants';

function PayslipContent() {
  const searchParams = useSearchParams();

  const payeeName = searchParams.get('name') || 'Ada Lovelace';
  const amount = searchParams.get('amount') || '0.10';
  const currency = searchParams.get('token') || 'USDC';
  const memo = searchParams.get('memo') || 'jan Salary - Ada';
  const paidBy = searchParams.get('paidBy') || '0x0fBB...486d';
  const recipientAddr = searchParams.get('address') || '0xF494...E554';
  const date = searchParams.get('date') || '10/5/2026';
  const batch = searchParams.get('batch') || 'October Salary and Grants Payout';
  const txHash =
    searchParams.get('tx') || '0xc17ec824c880162bc89e7a9ec7359bea6ae201b65084b2deb039544559f23552';

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const pdfBytes = await generatePayslipPdf(
        {
          id: '1',
          index: 1,
          name: payeeName,
          address: recipientAddr.startsWith('0x') ? recipientAddr : '0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554',
          amount,
          memo,
          isValidAddress: true,
          errors: [],
        },
        batch,
        (currency as 'USDC' | 'EURC') || 'USDC',
        txHash
      );
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payeeName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EC] text-[#1A2218] font-sans flex flex-col justify-between p-6 sm:p-12 selection:bg-[#DCE8D8]">
      <Preloader />

      {/* Persistent Breadcrumb Header */}
      <div className="max-w-xl mx-auto w-full flex items-center justify-between pb-6 text-xs text-[#6B7E64]">
        <div className="flex items-center gap-2 font-medium">
          <Link href="/" className="hover:underline">
            PayRun Home
          </Link>
          <span>/</span>
          <span>Shared Payslip</span>
          <span>/</span>
          <span className="text-[#1A2218] font-bold">{payeeName}</span>
        </div>

        <Link
          href="/"
          className="text-[#2C422C] font-semibold hover:underline flex items-center gap-1"
        >
          <span>Launch PayRun</span>
          <span>→</span>
        </Link>
      </div>

      {/* Top Logo Area */}
      <div className="text-center space-y-1 my-4">
        <Link href="/" className="inline-block">
          <h1 className="font-serif font-bold text-3xl tracking-tight text-[#1A2218]">
            PayRun
          </h1>
        </Link>
        <div className="font-mono text-[11px] tracking-widest uppercase font-semibold text-[#6B7E64]">
          PAYSLIP
        </div>
      </div>

      {/* Main Centered Payslip Card (Pixel Perfect with Image 6) */}
      <div className="w-full max-w-xl mx-auto bg-white rounded-3xl border border-[#E8E2D2] shadow-xl p-8 sm:p-10 space-y-8 my-auto">
        {/* Status Badge */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DCE8D8] text-[#2E502E] text-xs font-semibold">
            <span>✓</span>
            <span>Paid and final on Arc</span>
          </span>
        </div>

        {/* Amount & Recipient Title */}
        <div className="space-y-1">
          <div className="font-serif text-5xl sm:text-6xl font-semibold text-[#1A2218] tracking-tight">
            {amount} {currency}
          </div>
          <div className="text-sm text-[#5C6658] font-medium">
            to {payeeName}
          </div>
        </div>

        {/* Key-Value Details Table */}
        <div className="space-y-3.5 text-sm divide-y divide-[#E8E2D2]/80 pt-2">
          <div className="flex justify-between items-center pt-2">
            <span className="text-[#5C6658]">Reference</span>
            <span className="font-mono text-xs text-[#1A2218] font-medium">
              {memo}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3.5">
            <span className="text-[#5C6658]">Paid by</span>
            <span className="font-mono text-xs text-[#1A2218]">
              {paidBy.length > 15 ? `${paidBy.slice(0, 6)}...${paidBy.slice(-4)}` : paidBy}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3.5">
            <span className="text-[#5C6658]">Recipient</span>
            <span className="font-mono text-xs text-[#1A2218]">
              {recipientAddr.length > 15
                ? `${recipientAddr.slice(0, 6)}...${recipientAddr.slice(-4)}`
                : recipientAddr}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3.5">
            <span className="text-[#5C6658]">Date</span>
            <span className="font-mono text-xs text-[#1A2218]">{date}</span>
          </div>

          <div className="flex justify-between items-center pt-3.5">
            <span className="text-[#5C6658]">Batch</span>
            <span className="text-xs text-[#1A2218] font-medium">{batch}</span>
          </div>

          <div className="flex justify-between items-center pt-3.5">
            <span className="text-[#5C6658]">Transaction</span>
            <span className="font-mono text-xs text-[#1A2218]">
              {txHash.slice(0, 6)}...{txHash.slice(-4)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="px-6 py-3 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </button>

          <a
            href={`${getArcNetwork().explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-xl bg-[#EAE4D3] hover:bg-[#DDD6C3] text-[#2C422C] text-xs font-semibold transition-all cursor-pointer"
          >
            Verify on Arc Explorer ↗
          </a>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="text-center text-xs text-[#7A8576] my-6">
        Generated by PayRun. Verified from on-chain Transfer events.
      </div>
    </div>
  );
}

export default function SharedPayslipPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F5EC] flex items-center justify-center font-serif text-[#1A2218]">
          Loading payslip...
        </div>
      }
    >
      <PayslipContent />
    </Suspense>
  );
}
