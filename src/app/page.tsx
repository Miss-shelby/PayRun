'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { Preloader } from '@/components/Preloader';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { formatUnits, parseUnits, encodeFunctionData, isAddress, getAddress, parseGwei } from 'viem';
import { parsePayrollCsv } from '@/lib/payroll/parseCsv';
import { PayrollRow, PayrollRun, Token } from '@/lib/payroll/types';
import { generatePayslipPdf, generateAllPayslipsPdf } from '@/lib/payroll/pdfGenerator';
import { erc20Abi, multicall3FromAbi } from '@/lib/chain/abis';
import { getArcNetwork } from '@/lib/chain/constants';
import { buildSubcalls } from '@/lib/chain/encoding';

export default function Home() {
  const activeNet = useMemo(() => getArcNetwork(), []);
  const { isConnected, address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [isMounted, setIsMounted] = useState(false);
  // Mode: 'landing' vs 'app'
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');

  // App Stepper State (1: Input CSV, 2: Review Batch, 3: Sign & Execute)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState<Token>('USDC');
  const [batchTitle, setBatchTitle] = useState('October Salary and Grants Payout');
  const [csvContent, setCsvContent] = useState(
    `name,address,amount,currency,memo\n` +
    `Ada Lovelace,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.1,USDC,jan Salary - Ada\n` +
    `Ammie,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.2,USDC,feb salary - Charles\n` +
    `Charles Babbage,0x3600000000000000000000000000000000000000,0.5,USDC,Grant`
  );

  // Execution state
  const [executionStatus, setExecutionStatus] = useState<
    'idle' | 'preparing' | 'signing' | 'success' | 'failed'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [txHashResult, setTxHashResult] = useState<string>('');
  const [selectedRowForPreview, setSelectedRowForPreview] = useState<PayrollRow | null>(null);

  // Sample payslip modal state
  const [showSamplePayslipModal, setShowSamplePayslipModal] = useState(false);

  // Persistent runs history state
  const [savedRuns, setSavedRuns] = useState<PayrollRun[]>([]);

  useEffect(() => {
    setIsMounted(true);
    const local = localStorage.getItem('payrun_history');
    if (local) {
      try {
        setSavedRuns(JSON.parse(local));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Active token contract address (USDC vs EURC)
  const activeTokenAddress = token === 'EURC' ? activeNet.eurcAddress : activeNet.usdcAddress;

  // Read wallet token balance on active network (Arc Mainnet)
  const { data: tokenBalanceRaw, refetch: refetchBalance } = useReadContract({
    address: activeTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: activeNet.chainId,
    query: {
      enabled: !!address,
      refetchInterval: 2000,
    },
  });

  const balanceUnitsBigInt = (tokenBalanceRaw as bigint | undefined) ?? 0n;

  const formattedBalance =
    isConnected && address && tokenBalanceRaw !== undefined
      ? formatUnits(tokenBalanceRaw, 6)
      : null;

  // Dynamic CSV parsing
  const parsedRows: PayrollRow[] = useMemo(() => {
    return parsePayrollCsv(csvContent);
  }, [csvContent]);

  const validRows = useMemo(() => {
    return parsedRows.filter(
      (r) =>
        r.isValidAddress &&
        r.address.toLowerCase() !== activeNet.usdcAddress.toLowerCase() &&
        r.address.toLowerCase() !== activeNet.eurcAddress.toLowerCase()
    );
  }, [parsedRows, activeNet]);

  const invalidRows = useMemo(() => {
    return parsedRows.filter(
      (r) =>
        !r.isValidAddress ||
        r.address.toLowerCase() === activeNet.usdcAddress.toLowerCase() ||
        r.address.toLowerCase() === activeNet.eurcAddress.toLowerCase()
    );
  }, [parsedRows, activeNet]);

  const totalUnitsBigInt = useMemo(() => {
    return validRows.reduce((acc, row) => {
      try {
        return acc + parseUnits(row.amount, 6);
      } catch {
        return acc;
      }
    }, 0n);
  }, [validRows]);

  const totalAmountSum = useMemo(() => {
    return formatUnits(totalUnitsBigInt, 6);
  }, [totalUnitsBigInt]);

  const estimatedGasFeeUsd = (validRows.length * 0.002).toFixed(3);

  const balanceAfter = useMemo(() => {
    if (!isConnected || !address || tokenBalanceRaw === undefined) return '—';
    if (balanceUnitsBigInt < totalUnitsBigInt) return 'Insufficient Balance';
    return formatUnits(balanceUnitsBigInt - totalUnitsBigInt, 6);
  }, [isConnected, address, tokenBalanceRaw, balanceUnitsBigInt, totalUnitsBigInt]);

  // File Upload handler
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Import from Payees Directory (dynamic from localStorage)
  const handleImportPayees = () => {
    const localPayees = localStorage.getItem('payrun_payees');
    if (localPayees) {
      try {
        const parsed = JSON.parse(localPayees);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const rows = parsed.map(
            (p: any) =>
              `${p.name || 'Payee'},${p.address},0.1,USDC,Oct Salary - ${p.name || 'Payee'}`
          );
          setCsvContent(`name,address,amount,currency,memo\n${rows.join('\n')}`);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const defaultSample =
      `name,address,amount,currency,memo\n` +
      `Ada Lovelace,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.1,USDC,jan Salary - Ada\n` +
      `Ammie,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.2,USDC,feb salary - Charles`;
    setCsvContent(defaultSample);
  };

  // REAL ON-CHAIN TRANSACTION EXECUTION VIA WAGMI & Multicall3From
  const handleExecutePayout = async () => {
    if (!isConnected || !address) {
      alert('Please connect your Web3 wallet first!');
      return;
    }

    if (validRows.length === 0) {
      alert('No valid recipient rows to process. Please check your CSV input.');
      return;
    }

    if (balanceUnitsBigInt < totalUnitsBigInt) {
      alert(
        `Insufficient ${token} balance! Your balance is ${formatUnits(
          balanceUnitsBigInt,
          6
        )} ${token}, but total payout is ${totalAmountSum} ${token}.`
      );
      return;
    }

    // Switch wallet network if connected to wrong chain
    if (chain && chain.id !== activeNet.chainId && switchChain) {
      try {
        await switchChain({ chainId: activeNet.chainId });
      } catch (e: any) {
        console.warn('Network switch request:', e);
      }
    }

    setExecutionStatus('signing');
    setErrorMessage('');

    try {
      const calls = buildSubcalls(validRows, token, activeNet);

      const txHash = await writeContractAsync({
        address: activeNet.multicall3FromAddress,
        abi: multicall3FromAbi,
        functionName: 'aggregate3',
        args: [calls],
        chainId: activeNet.chainId,
        maxFeePerGas: parseGwei('20'),
      });

      setTxHashResult(txHash);
      setExecutionStatus('success');
      refetchBalance();

      const newRun: PayrollRun = {
        id: String(Date.now()),
        title: batchTitle || 'Untitled Payout Run',
        token,
        recipientCount: validRows.length,
        totalAmount: totalAmountSum,
        txHash,
        status: 'success',
        createdAt: new Date().toLocaleDateString(),
        rows: validRows,
        feeUsd: estimatedGasFeeUsd,
      };

      const updated = [newRun, ...savedRuns];
      setSavedRuns(updated);
      localStorage.setItem('payrun_history', JSON.stringify(updated));
    } catch (err: any) {
      console.error('On-chain transaction failed:', err);
      setExecutionStatus('failed');
      setErrorMessage(
        err?.shortMessage || err?.message || 'Transaction was rejected or failed.'
      );
    }
  };

  // Download PDF Payslip (Single)
  const handleDownloadPayslip = async (row: PayrollRow) => {
    const pdfBytes = await generatePayslipPdf(
      row,
      batchTitle,
      token,
      txHashResult || '0x5042...999'
    );
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${row.name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  // Download Unified Multi-page PDF for All Payslips
  const handleDownloadAllPayslips = async () => {
    if (validRows.length === 0) return;

    if (validRows.length === 1) {
      await handleDownloadPayslip(validRows[0]);
      return;
    }

    const pdfBytes = await generateAllPayslipsPdf(
      validRows,
      batchTitle,
      token,
      txHashResult || '0x5042...999'
    );
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (batchTitle || 'batch_run').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `all_payslips_${safeTitle}.pdf`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F7F5EC] text-[#1A2218] font-sans flex flex-col selection:bg-[#DCE8D8]">
      {/* Sleek Preloader */}
      <Preloader />

      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#F7F5EC]/95 backdrop-blur-md border-b border-[#E2DAC4]/80 px-8 py-4 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setViewMode('landing')}
          >
            <div className="w-8 h-8 rounded-full bg-[#DCE5D5] flex items-center justify-center text-[#2A3F2A]">
              <span className="font-serif font-bold text-sm">P</span>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-[#1A2218]">
              PayRun
            </span>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A5546]">
            {viewMode === 'app' ? (
              <>
                <button
                  onClick={() => {
                    setViewMode('app');
                    setActiveStep(1);
                    setExecutionStatus('idle');
                  }}
                  className={`transition-colors ${
                    activeStep === 1 && executionStatus !== 'success'
                      ? 'text-[#1A2218] font-bold'
                      : 'hover:text-[#1A2218]'
                  }`}
                >
                  Create Run
                </button>
                <Link
                  href="/payees"
                  className="hover:text-[#1A2218] transition-colors"
                >
                  Run History
                </Link>
                <Link href="/payees" className="hover:text-[#1A2218] transition-colors">
                  Payees
                </Link>
              </>
            ) : (
              <>
                <a href="#features" className="hover:text-[#1A2218] transition-colors">
                  Features
                </a>
                <a href="#how-it-works" className="hover:text-[#1A2218] transition-colors">
                  How it works
                </a>
                <button
                  onClick={() => setShowSamplePayslipModal(true)}
                  className="hover:text-[#1A2218] transition-colors"
                >
                  Payslips
                </button>
                <Link
                  href="/docs"
                  className="hover:text-[#1A2218] transition-colors"
                >
                  Docs
                </Link>
              </>
            )}
          </nav>

          {/* Right CTA / Wallet Badges */}
          <div className="flex items-center gap-3">
            {/* Network Pill indicator & Switch Network prompt if wallet is on testnet/wrong chain */}
            {isConnected && chain && chain.id !== activeNet.chainId ? (
              <button
                type="button"
                onClick={() => switchChain && switchChain({ chainId: activeNet.chainId })}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold border border-amber-300 transition-colors cursor-pointer"
                title={`Wallet connected to ${chain.name || 'different network'}. Click to switch to ${activeNet.chain.name}.`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Switch to {activeNet.chain.name}</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAE4D3] text-xs font-semibold text-[#2C422C] border border-[#DCD4C0]">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>{activeNet.chain.name}</span>
              </div>
            )}

            {viewMode === 'app' ? (
              <>
                {/* Balance Badge pill */}
                {isConnected && address && formattedBalance !== null && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#E2DAC4] text-xs font-medium text-[#2C422C]">
                    <span>{Number(formattedBalance).toFixed(2)} {token}</span>
                  </div>
                )}
                <ConnectWalletButton />
              </>
            ) : (
              <button
                onClick={() => {
                  setViewMode('app');
                  setActiveStep(1);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white font-medium text-sm transition-all shadow-sm cursor-pointer"
              >
                Launch App
              </button>
            )}
          </div>
        </div>
      </header>

      {/* RENDER VIEW MODE: LANDING vs APP STEP 1 / 2 / 3 */}
      {viewMode === 'landing' ? (
        <>
          {/* HERO SECTION */}
          <section className="px-8 pt-10 pb-20 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-7">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DCE8D8] text-[#2E502E] text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E502E]"></span>
                <span>Live on Arc • Multicall3From</span>
              </div>

              <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-normal text-[#1A2218] tracking-tight leading-[1.08]">
                Pay your whole team in one transaction.
              </h1>

              <p className="text-lg sm:text-xl text-[#5C6658] max-w-lg leading-relaxed">
                Upload a CSV. Sign once. Up to 200 people get USDC or EURC with a memo and a payslip, final in under a second.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => {
                    setViewMode('app');
                    setActiveStep(1);
                  }}
                  className="px-7 py-4 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white font-medium text-base transition-all shadow-sm cursor-pointer"
                >
                  Start a payroll run →
                </button>
                <button
                  onClick={() => setShowSamplePayslipModal(true)}
                  className="px-7 py-4 rounded-xl bg-[#E3D8C4] hover:bg-[#D6C9B2] text-[#2C422C] font-medium text-base transition-all cursor-pointer"
                >
                  View sample payslip
                </button>
              </div>
            </div>

            {/* Right Terminal Code Preview Column */}
            <div className="lg:col-span-6">
              <div className="relative">
                <div className="absolute -inset-2 bg-emerald-500/25 rounded-[2.5rem] blur-2xl pointer-events-none"></div>

                <div className="relative rounded-3xl bg-[#0D1914] p-7 shadow-[0_0_50px_rgba(52,211,153,0.2)] border border-emerald-500/30">
                  <div className="font-mono text-xs sm:text-sm space-y-4 text-emerald-400/90 leading-relaxed">
                    <div className="text-[#34D399] font-semibold pb-3 border-b border-[#182C23] flex items-center justify-between">
                      <span>aggregate3([ 50 calls ]) • allowFailure=false</span>
                    </div>

                    <div className="space-y-2.5 text-[#E5E7EB]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#34D399] font-bold">→</span>
                        <span className="text-[#34D399]">transfer</span>
                        <span className="text-gray-400 font-mono text-xs">0xF494...E554</span>
                        <span className="text-white font-bold">1,200 USDC</span>
                        <span className="text-[#34D399]/80 italic">"Sept salary - Ada"</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[#34D399] font-bold">→</span>
                        <span className="text-[#34D399]">transfer</span>
                        <span className="text-gray-400 font-mono text-xs">0x0fBB...486d</span>
                        <span className="text-white font-bold">800 EURC</span>
                        <span className="text-[#34D399]/80 italic">"Grant - Charles"</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[#34D399] font-bold">→</span>
                        <span className="text-[#34D399]">transfer</span>
                        <span className="text-gray-400 font-mono text-xs">0x3600...0000</span>
                        <span className="text-white font-bold">450 USDC</span>
                        <span className="text-[#34D399]/80 italic">"Bounty #12"</span>
                      </div>

                      <div className="text-gray-500 pt-1 text-xs">... 47 more</div>
                    </div>

                    <div className="pt-4 border-t border-[#182C23] text-[#34D399] text-xs font-semibold flex items-center gap-2">
                      <span>✓ Finalized</span>
                      <span>•</span>
                      <span>1 signature</span>
                      <span>•</span>
                      <span>msg.sender = payer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: "Built for how Arc works" */}
          <section id="features" className="bg-[#EEE8DA] py-24 px-8">
            <div className="max-w-7xl mx-auto space-y-12">
              <h2 className="font-serif text-4xl sm:text-5xl font-normal text-[#1A2218]">
                Built for how Arc works
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-7 rounded-2xl bg-[#F7F5EE] border border-[#E5DEC9]/80 space-y-3">
                  <h3 className="font-semibold text-lg text-[#1A2218]">
                    No approvals
                  </h3>
                  <p className="text-sm text-[#5C6658] leading-relaxed">
                    Multicall3From keeps your wallet as the sender, so every Transfer shows the real payer.
                  </p>
                </div>

                <div className="p-7 rounded-2xl bg-[#F7F5EE] border border-[#E5DEC9]/80 space-y-3">
                  <h3 className="font-semibold text-lg text-[#1A2218]">
                    Memo on every line
                  </h3>
                  <p className="text-sm text-[#5C6658] leading-relaxed">
                    Each recipient gets a reference like "Sept salary – Ada" recorded on-chain.
                  </p>
                </div>

                <div className="p-7 rounded-2xl bg-[#F7F5EE] border border-[#E5DEC9]/80 space-y-3">
                  <h3 className="font-semibold text-lg text-[#1A2218]">
                    USDC and EURC
                  </h3>
                  <p className="text-sm text-[#5C6658] leading-relaxed">
                    Pay dollar and euro contractors from the same run.
                  </p>
                </div>

                <div className="p-7 rounded-2xl bg-[#F7F5EE] border border-[#E5DEC9]/80 space-y-3">
                  <h3 className="font-semibold text-lg text-[#1A2218]">
                    Instant payslips
                  </h3>
                  <p className="text-sm text-[#5C6658] leading-relaxed">
                    Download PDFs or share a link the moment the batch is final.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: "Three steps" */}
          <section id="how-it-works" className="py-24 px-8 max-w-7xl mx-auto w-full space-y-14">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-4xl sm:text-5xl font-normal text-[#1A2218]">
                Three steps
              </h2>
              <span className="text-xs font-mono font-medium text-[#2E502E] bg-[#DCE8D8] px-3 py-1 rounded-full">
                Simple & Fast
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-[#FAF8F3] border border-[#E5DEC9] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all space-y-4 relative group">
                <div className="w-12 h-12 rounded-2xl bg-[#DCE8D8] border border-[#BACDA9] flex items-center justify-center font-mono font-bold text-[#2E502E] text-base shadow-sm group-hover:bg-[#2C422C] group-hover:text-white transition-colors">
                  01
                </div>
                <h3 className="font-semibold text-xl text-[#1A2218]">
                  Upload CSV
                </h3>
                <p className="text-sm text-[#5C6658] leading-relaxed">
                  Addresses, amounts and memos are validated as you paste or drop your recipient file.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-[#FAF8F3] border border-[#E5DEC9] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all space-y-4 relative group">
                <div className="w-12 h-12 rounded-2xl bg-[#DCE8D8] border border-[#BACDA9] flex items-center justify-center font-mono font-bold text-[#2E502E] text-base shadow-sm group-hover:bg-[#2C422C] group-hover:text-white transition-colors">
                  02
                </div>
                <h3 className="font-semibold text-xl text-[#1A2218]">
                  Review and sign
                </h3>
                <p className="text-sm text-[#5C6658] leading-relaxed">
                  Check totals and the fee estimate, then approve one atomic signature in MetaMask.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-[#FAF8F3] border border-[#E5DEC9] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all space-y-4 relative group">
                <div className="w-12 h-12 rounded-2xl bg-[#DCE8D8] border border-[#BACDA9] flex items-center justify-center font-mono font-bold text-[#2E502E] text-base shadow-sm group-hover:bg-[#2C422C] group-hover:text-white transition-colors">
                  03
                </div>
                <h3 className="font-semibold text-xl text-[#1A2218]">
                  Share payslips
                </h3>
                <p className="text-sm text-[#5C6658] leading-relaxed">
                  Every recipient gets an official PDF receipt tied directly to the Arc transaction.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* APP VIEW: STEPPER 1, 2, 3 */
        <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10 space-y-8">
          {/* BREADCRUMB & STEPPER HEADER (ONLY VISIBLE BEFORE FINAL TRANSACTION SUCCESS) */}
          {executionStatus !== 'success' && (
            <>
              {/* ALWAYS VISIBLE BREADCRUMB */}
              <div className="flex items-center gap-2 text-xs text-[#6B7E64] font-medium">
                <span
                  className="hover:underline cursor-pointer"
                  onClick={() => setViewMode('landing')}
                >
                  PayRun Home
                </span>
                <span>/</span>
                <span>New Payroll Run</span>
                <span>/</span>
                <span className="text-[#1A2218] font-bold">
                  {activeStep === 1
                    ? 'Step 1: Input CSV'
                    : activeStep === 2
                    ? 'Step 2: Review Batch'
                    : 'Step 3: Sign and Execute'}
                </span>
              </div>

              {/* Page Title & Stepper Header */}
              <div className="space-y-2">
                <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#1A2218] tracking-tight">
                  New payroll run
                </h1>

                <p className="text-sm text-[#5C6658]">
                  {activeStep === 1 && 'Step 1 of 3 · Upload or paste recipients'}
                  {activeStep === 2 && 'Step 2 of 3 · Review batch before signing'}
                  {activeStep === 3 && 'Step 3 of 3 · Sign and execute transaction'}
                </p>

                {/* Stepper Badges Matching Image 2 and Image 3 */}
                <div className="flex items-center gap-3 pt-3">
                  <button
                    onClick={() => setActiveStep(1)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      activeStep === 1
                        ? 'bg-[#2C422C] text-white shadow-sm'
                        : 'bg-[#DCE8D8] text-[#2E502E]'
                    }`}
                  >
                    1 Input CSV {activeStep > 1 ? '✓' : ''}
                  </button>

                  <button
                    onClick={() => setActiveStep(2)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      activeStep === 2
                        ? 'bg-[#2C422C] text-white shadow-sm'
                        : activeStep > 2
                        ? 'bg-[#DCE8D8] text-[#2E502E]'
                        : 'bg-[#EAE4D3] text-[#5C6658]'
                    }`}
                  >
                    2 Review {activeStep > 2 ? '✓' : ''}
                  </button>

                  <button
                    onClick={() => setActiveStep(3)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      activeStep === 3
                        ? 'bg-[#2C422C] text-white shadow-sm'
                        : 'bg-[#EAE4D3] text-[#5C6658]'
                    }`}
                  >
                    3 Sign and execute
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 1: CSV INPUT */}
          {activeStep === 1 && executionStatus !== 'success' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Form Column */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-2">
                  <label className="block text-[11px] font-semibold text-[#6B7E64] uppercase tracking-wider">
                    BATCH TITLE
                  </label>
                  <input
                    type="text"
                    value={batchTitle}
                    onChange={(e) => setBatchTitle(e.target.value)}
                    placeholder="October Salary and Grants Payout"
                    className="w-full px-4 py-3 rounded-xl bg-[#F7F5EE] border border-[#E2DCD0] text-[#1A2218] text-sm focus:outline-none focus:border-[#2C422C]"
                  />
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="bg-[#FAF8F3] p-8 rounded-2xl border-2 border-dashed border-[#A8BBA2] text-center space-y-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <h3 className="font-serif text-2xl font-normal text-[#1A2218]">
                      Drop your CSV here
                    </h3>
                    <p className="text-xs text-[#5C6658]">
                      5 to 200 rows • columns: name, address, amount, currency, memo
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <label className="px-5 py-2.5 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm">
                      Upload CSV
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const sample = `name,address,amount,currency,memo\nAda Lovelace,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.1,USDC,jan Salary - Ada\nAmmie,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.2,USDC,feb salary - Charles\nCharles Babbage,0x3600000000000000000000000000000000000000,0.5,USDC,Grant`;
                        const blob = new Blob([sample], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'payrun_template.csv';
                        a.click();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#E3D8C4] hover:bg-[#D6C9B2] text-[#2C422C] text-xs font-semibold transition-colors"
                    >
                      Download template
                    </button>
                  </div>
                </div>

                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#6B7E64] uppercase tracking-wider">
                      OR PASTE CSV
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleImportPayees}
                        className="px-3.5 py-1.5 rounded-xl bg-[#E3D8C4] hover:bg-[#D6C9B2] text-[#2C422C] text-xs font-medium transition-colors"
                      >
                        Import from payees
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsvContent('')}
                        className="px-3.5 py-1.5 rounded-xl bg-[#E3D8C4] hover:bg-[#D6C9B2] text-[#2C422C] text-xs font-medium transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#0D1914] p-4 border border-[#182C23]">
                    <textarea
                      rows={6}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      className="w-full bg-transparent text-[#48D19F] font-mono text-xs leading-relaxed focus:outline-none resize-y"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-7 py-3.5 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    Review batch ({parsedRows.length} payees) →
                  </button>
                </div>
              </div>

              {/* Right Live Validation Sidebar */}
              <div className="lg:col-span-4">
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-5 sticky top-28">
                  <h3 className="font-serif text-xl font-normal text-[#1A2218]">
                    Live validation
                  </h3>

                  <div className="space-y-3.5 text-sm divide-y divide-[#E8E2D2]/60">
                    <div className="flex justify-between pt-1">
                      <span className="text-[#5C6658]">Rows parsed</span>
                      <span className="font-bold text-[#1A2218]">{parsedRows.length}</span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Checksum valid</span>
                      <span className="font-bold text-[#1A2218]">
                        {validRows.length} / {parsedRows.length}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Zero address</span>
                      <span className="font-bold text-[#1A2218]">
                        {invalidRows.length > 0 ? `${invalidRows.length} detected` : 'None'}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Total</span>
                      <span className="font-bold text-[#1A2218]">
                        {totalAmountSum} {token}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Est. fee</span>
                      <span className="font-semibold text-[#1A2218]">
                        ~${estimatedGasFeeUsd}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Wallet balance</span>
                      <span className="font-bold text-[#1A2218] flex items-center gap-1">
                        {isConnected && address && formattedBalance !== null ? (
                          <>
                            <span>{Number(formattedBalance).toFixed(2)} USDC</span>
                            <span className="text-emerald-700">✓</span>
                          </>
                        ) : (
                          <span className="text-[#8C9886] font-medium text-xs">Not connected</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {invalidRows.length === 0 ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-[#DCE8D8] text-[#2E502E] text-xs font-semibold">
                        Ready to review
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold">
                        Fix zero address errors
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW BATCH (PIXEL PERFECT WITH IMAGE 3) */}
          {activeStep === 2 && executionStatus !== 'success' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT REVIEW TABLE COLUMN (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-[#FAF8F3] rounded-2xl border border-[#E8E2D2] shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#EEE8DA] border-b border-[#E8E2D2] text-[#5C6658] uppercase text-[11px] font-semibold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-6 font-semibold">#</th>
                        <th className="py-3.5 px-6 font-semibold">PAYEE</th>
                        <th className="py-3.5 px-6 font-semibold">ADDRESS</th>
                        <th className="py-3.5 px-6 font-semibold">AMOUNT</th>
                        <th className="py-3.5 px-6 font-semibold">MEMO</th>
                        <th className="py-3.5 px-6 font-semibold text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D2]">
                      {parsedRows.map((row) => {
                        const isInvalid = !row.isValidAddress;
                        return (
                          <tr
                            key={row.id}
                            className={isInvalid ? 'bg-rose-50/70' : 'hover:bg-[#F5F1E6]/50'}
                          >
                            <td className="py-4 px-6 text-xs font-mono text-[#5C6658]">
                              {row.index}
                            </td>
                            <td className="py-4 px-6 font-medium text-[#1A2218]">
                              {row.name}
                            </td>
                            <td className="py-4 px-6 font-mono text-xs text-[#1A2218]">
                              {row.address.slice(0, 6)}...{row.address.slice(-4)}
                            </td>
                            <td className="py-4 px-6 font-mono text-xs font-semibold text-[#1A2218]">
                              {Number(row.amount).toFixed(2)} {token}
                            </td>
                            <td className="py-4 px-6 font-mono text-xs text-[#1A2218]">
                              {row.memo}
                            </td>
                            <td className="py-4 px-6 text-right">
                              {!isInvalid ? (
                                <span className="inline-block px-3 py-1 rounded-full bg-[#DCE8D8] text-[#2E502E] text-[11px] font-semibold">
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-block px-3 py-1 rounded-full bg-[#FCE8E6] text-[#C53030] text-[11px] font-semibold">
                                  {row.errors[0] || 'Invalid'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-[#75886F] px-1">
                  Rows with errors are blocked until fixed. Arc reverts transfers to the zero address.
                </p>
              </div>

              {/* RIGHT SUMMARY SIDEBAR COLUMN (4 cols) */}
              <div className="lg:col-span-4">
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-5 sticky top-28">
                  <h3 className="font-serif text-xl font-normal text-[#1A2218]">
                    Summary
                  </h3>

                  <div className="space-y-3 text-sm divide-y divide-[#E8E2D2]/60">
                    <div className="flex justify-between pt-1">
                      <span className="text-[#5C6658]">Recipients</span>
                      <span className="font-bold text-[#1A2218]">
                        {validRows.length} valid {invalidRows.length > 0 ? `· ${invalidRows.length} error` : ''}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Total</span>
                      <span className="font-bold text-[#1A2218]">
                        {totalAmountSum} {token}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Est. fee</span>
                      <span className="font-semibold text-[#1A2218]">
                        ~${estimatedGasFeeUsd}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#5C6658]">Balance after</span>
                      <span className="font-bold text-[#1A2218]">
                        {formattedBalance !== null ? `${balanceAfter} ${token}` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Dark Call Spec Box */}
                  <div className="rounded-xl bg-[#0D1914] p-4 text-[#34D399] font-mono text-xs leading-relaxed border border-[#182C23]">
                    aggregate3 • allowFailure=false • direct EOA call
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveStep(3)}
                      className="w-full py-3.5 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      Sign with wallet →
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="w-full py-3.5 rounded-xl bg-[#E3D8C4] hover:bg-[#D6C9B2] text-[#2C422C] text-sm font-semibold transition-all cursor-pointer"
                    >
                      Edit CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SIGN AND EXECUTE (ONLY WHEN NOT YET SUCCESSFUL) */}
          {activeStep === 3 && executionStatus !== 'success' && (
            <div className="py-6 flex items-center justify-center">
              <div className="relative w-full max-w-xl">
                {/* Emerald Ambient Glow Halo */}
                <div className="absolute -inset-1 bg-[#34D399]/20 rounded-[2.5rem] blur-xl pointer-events-none"></div>

                <div className="relative bg-[#0C1813] border border-[#1C362A] rounded-[2.2rem] p-8 sm:p-10 text-left shadow-2xl space-y-7">
                  {/* Step Badge Pill */}
                  <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#34D399] uppercase font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#34D399]"></span>
                    <span>STEP 3 · SIGN AND EXECUTE</span>
                  </div>

                  {/* Header Title */}
                  <div className="space-y-1.5">
                    <h2 className="font-serif text-3xl sm:text-4xl font-normal text-white tracking-tight">
                      Confirm in your wallet
                    </h2>
                    <p className="text-sm text-[#9CA3AF]">
                      One signature sends all {validRows.length} payments.
                    </p>
                  </div>

                  {/* Monospace Details Terminal Box */}
                  <div className="rounded-xl bg-[#060D0A] border border-[#162B21] p-4 font-mono text-xs space-y-2.5 text-[#E5E7EB]">
                    <div className="flex justify-between">
                      <span className="text-[#8E9B94]">Total</span>
                      <span className="font-semibold text-white">
                        {totalAmountSum} {token}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8E9B94]">Fee</span>
                      <span className="text-white">~${estimatedGasFeeUsd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8E9B94]">Method</span>
                      <span className="text-white">aggregate3</span>
                    </div>
                  </div>

                  {/* Live Progress Checklist */}
                  <div className="space-y-3.5 text-sm pt-1">
                    {/* Step 1: Batch Validated */}
                    <div className="flex items-center gap-3 text-[#34D399] font-medium">
                      <span className="text-base font-bold">✓</span>
                      <span>Batch validated</span>
                    </div>

                    {/* Step 2: Waiting for signature */}
                    <div className="flex items-center gap-3 text-white font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-pulse"></span>
                      <span>
                        {executionStatus === 'signing'
                          ? 'Waiting for wallet signature...'
                          : executionStatus === 'idle'
                          ? 'Ready for wallet signature'
                          : 'Processing signature...'}
                      </span>
                    </div>

                    {/* Step 3: Finalizing on Arc */}
                    <div className="flex items-center gap-3 font-medium text-[#4A5D53]">
                      <span className="w-2 h-2 rounded-full border border-[#4A5D53]"></span>
                      <span>Finalizing on Arc</span>
                    </div>

                    {/* Step 4: Generating payslips */}
                    <div className="flex items-center gap-3 font-medium text-[#4A5D53]">
                      <span className="w-2 h-2 rounded-full border border-[#4A5D53]"></span>
                      <span>Generating payslips</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-[#14261E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#34D399] rounded-full transition-all duration-700"
                      style={{
                        width: executionStatus === 'signing' ? '50%' : '35%',
                      }}
                    />
                  </div>

                  {/* Interactive Execution Actions */}
                  {executionStatus === 'idle' && (
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="px-6 py-2.5 rounded-xl bg-[#162B21] hover:bg-[#1F3D2F] text-[#E5E7EB] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleExecutePayout}
                        className="px-7 py-3 rounded-xl bg-[#34D399] hover:bg-[#28B884] text-[#0C1813] text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                      >
                        <span>Sign with wallet →</span>
                      </button>
                    </div>
                  )}

                  {executionStatus === 'signing' && (
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setExecutionStatus('idle')}
                        className="px-6 py-2.5 rounded-xl bg-[#162B21] hover:bg-[#1F3D2F] text-[#E5E7EB] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>

                      <div className="text-xs font-mono text-[#34D399] animate-pulse">
                        🦊 Confirm in MetaMask...
                      </div>
                    </div>
                  )}

                  {executionStatus === 'failed' && (
                    <div className="space-y-3 pt-2">
                      <div className="p-3.5 bg-rose-950/80 border border-rose-800/80 rounded-xl text-rose-200 text-xs space-y-1">
                        <div className="font-bold">Transaction Failed or Cancelled</div>
                        <div className="text-[11px] opacity-90">{errorMessage}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveStep(2)}
                          className="px-5 py-2.5 rounded-xl bg-[#162B21] text-[#E5E7EB] text-xs font-semibold"
                        >
                          Back to Review
                        </button>
                        <button
                          type="button"
                          onClick={handleExecutePayout}
                          className="px-6 py-2.5 rounded-xl bg-[#34D399] text-[#0C1813] text-xs font-bold"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: RESULTS AND PAYSLIPS (PIXEL PERFECT WITH IMAGE 5) */}
          {executionStatus === 'success' && (
            <div className="space-y-8 animate-fadeIn pt-4">
              {/* TOP OBSIDIAN HERO CARD */}
              <div className="relative rounded-3xl bg-[#0C1813] border border-[#1C362A] p-8 sm:p-10 shadow-2xl space-y-6 overflow-hidden">
                <div className="absolute -inset-1 bg-[#34D399]/15 rounded-3xl blur-2xl pointer-events-none"></div>

                <div className="relative space-y-4">
                  {/* Tag */}
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#34D399]">
                    <span className="text-sm">✓</span>
                    <span>Batch finalized</span>
                  </div>

                  {/* Batch Title */}
                  <h2 className="font-serif text-3xl sm:text-4xl font-normal text-white tracking-tight">
                    {batchTitle || 'October Salary and Grants Payout'}
                  </h2>

                  {/* Tx Hash Monospace Subtitle */}
                  <p className="font-mono text-xs text-[#9CA3AF] break-all">
                    Tx {txHashResult || '0xc17ec824c880162bc89e7a9ec7359bea6ae201b65084b2deb039544559f23552'}
                  </p>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <a
                      href={`${activeNet.explorerUrl}/tx/${
                        txHashResult || '0xc17ec824c880162bc89e7a9ec7359bea6ae201b65084b2deb039544559f23552'
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-2.5 rounded-full bg-[#34D399] hover:bg-[#28B884] text-[#0C1813] font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>View on Arc Explorer</span>
                      <span>↗</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleDownloadAllPayslips}
                      className="px-6 py-2.5 rounded-full bg-[#1A3025] hover:bg-[#244234] text-[#E5E7EB] font-semibold text-xs transition-all border border-[#2B4B3B] cursor-pointer"
                    >
                      Download all payslips
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExecutionStatus('idle');
                        setActiveStep(1);
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#1A3025] hover:bg-[#244234] text-[#E5E7EB] font-semibold text-xs transition-all border border-[#2B4B3B]"
                    >
                      + Create new run
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-COLUMN SECTION: CONFIRMED PAYEES TABLE (LEFT 8) & PAYSLIP PREVIEW CARD (RIGHT 4) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT TABLE COLUMN (8 cols) */}
                <div className="lg:col-span-8">
                  <div className="bg-[#FAF8F3] rounded-2xl border border-[#E8E2D2] shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#EEE8DA] border-b border-[#E8E2D2] text-[#5C6658] uppercase text-[11px] font-semibold tracking-wider">
                        <tr>
                          <th className="py-3.5 px-6 font-semibold">PAYEE</th>
                          <th className="py-3.5 px-6 font-semibold">AMOUNT</th>
                          <th className="py-3.5 px-6 font-semibold">MEMO</th>
                          <th className="py-3.5 px-6 font-semibold">STATUS</th>
                          <th className="py-3.5 px-6 font-semibold text-right">PAYSLIP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E2D2]">
                        {validRows.map((row) => {
                          const isSelected =
                            selectedRowForPreview?.id === row.id ||
                            (!selectedRowForPreview && row.id === validRows[0]?.id);
                          return (
                            <tr
                              key={row.id}
                              onClick={() => setSelectedRowForPreview(row)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-[#F2ECE0]' : 'hover:bg-[#F5F1E6]/50'
                              }`}
                            >
                              <td className="py-4 px-6 font-medium text-[#1A2218]">
                                {row.name}
                              </td>
                              <td className="py-4 px-6 font-mono text-xs font-semibold text-[#1A2218]">
                                {Number(row.amount).toFixed(2)} {token}
                              </td>
                              <td className="py-4 px-6 font-mono text-xs text-[#1A2218]">
                                {row.memo}
                              </td>
                              <td className="py-4 px-6">
                                <span className="inline-block px-3 py-1 rounded-full bg-[#DCE8D8] text-[#2E502E] text-[11px] font-semibold">
                                  Transfer confirmed
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRowForPreview(row);
                                      handleDownloadPayslip(row);
                                    }}
                                    className="text-[#2E502E] font-semibold font-mono text-xs hover:underline cursor-pointer"
                                  >
                                    PDF
                                  </button>
                                  <span className="text-gray-400 font-mono text-xs">•</span>
                                  <Link
                                    href={`/payslip?name=${encodeURIComponent(row.name)}&amount=${
                                      row.amount
                                    }&token=${token}&memo=${encodeURIComponent(
                                      row.memo
                                    )}&address=${row.address}&batch=${encodeURIComponent(
                                      batchTitle
                                    )}&tx=${txHashResult || '0xc17ec824c880162bc89e7a9ec7359bea6ae201b65084b2deb039544559f23552'}`}
                                    target="_blank"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[#2E502E] font-semibold font-mono text-xs hover:underline cursor-pointer"
                                  >
                                    Share ↗
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT PAYSLIP PREVIEW CARD (4 cols) */}
                <div className="lg:col-span-4">
                  {(() => {
                    const activeRow = selectedRowForPreview || validRows[0] || {
                      name: 'Ada Lovelace',
                      amount: '0.10',
                      memo: 'jan Salary - Ada',
                    };
                    const displayTx =
                      txHashResult || '0xc17ec824c880162bc89e7a9ec7359bea6ae201b65084b2deb039544559f23552';
                    const payerAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x0fBB...486d';

                    return (
                      <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-4 sticky top-28">
                        <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#6B7E64]">
                          PAYSLIP PREVIEW
                        </div>

                        <h3 className="font-serif text-2xl font-bold text-[#1A2218]">
                          {activeRow.name}
                        </h3>

                        <div className="space-y-3 text-sm divide-y divide-[#E8E2D2]/70 pt-1">
                          <div className="flex justify-between pt-1">
                            <span className="text-[#5C6658]">Amount</span>
                            <span className="font-bold text-[#1A2218]">
                              {Number(activeRow.amount).toFixed(2)} {token}
                            </span>
                          </div>

                          <div className="flex justify-between pt-3">
                            <span className="text-[#5C6658]">Reference</span>
                            <span className="font-mono text-xs text-[#1A2218]">
                              {activeRow.memo}
                            </span>
                          </div>

                          <div className="flex justify-between pt-3">
                            <span className="text-[#5C6658]">Paid by</span>
                            <span className="font-mono text-xs text-[#1A2218]">
                              {payerAddress}
                            </span>
                          </div>

                          <div className="flex justify-between pt-3">
                            <span className="text-[#5C6658]">Date</span>
                            <span className="font-mono text-xs text-[#1A2218]">
                              10/5/2026
                            </span>
                          </div>

                          <div className="flex justify-between pt-3">
                            <span className="text-[#5C6658]">Tx</span>
                            <span className="font-mono text-xs text-[#1A2218]">
                              {displayTx.slice(0, 6)}...{displayTx.slice(-4)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadPayslip(activeRow as PayrollRow)}
                            className="w-full py-3 rounded-xl bg-[#2C422C] hover:bg-[#1E301E] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span>Download Official Payslip PDF</span>
                            <span>📄</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* SAMPLE PAYSLIP MODAL */}
      {showSamplePayslipModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF8F3] rounded-3xl p-8 max-w-lg w-full border border-[#E8E2D2] space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowSamplePayslipModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 text-lg"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#DCE5D5] flex items-center justify-center text-[#2C422C]">
                <span className="font-serif font-bold">P</span>
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A2218]">
                  PayRun Sample Payslip Receipt
                </h3>
                <p className="text-xs text-[#5C6658]">Arc Network Verified On-Chain</p>
              </div>
            </div>

            <div className="bg-[#F7F5EC] p-5 rounded-2xl border border-[#E2DCD0] space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Recipient Name:</span>
                <span className="font-bold text-[#1A2218]">Ada Lovelace</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Memo Reference:</span>
                <span className="font-mono text-[#2C422C]">"September salary - Ada"</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Amount Paid:</span>
                <span className="font-bold text-sm text-[#2C422C]">1,200.00 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C6658]">Transaction Hash:</span>
                <span className="font-mono text-[10px] text-blue-700">0xF494...E554</span>
              </div>
            </div>

            <button
              onClick={() => setShowSamplePayslipModal(false)}
              className="w-full py-3 rounded-xl bg-[#2C422C] text-white font-medium text-sm"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#E6E0CE] bg-[#EEE8DA] py-8 px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C6658]">
          <div>
            PayRun • 2026
          </div>

          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-[#1A2218]">
              Docs
            </Link>
            <a href={activeNet.explorerUrl} target="_blank" rel="noreferrer" className="hover:text-[#1A2218]">
              Arc Explorer
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-[#1A2218]">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
