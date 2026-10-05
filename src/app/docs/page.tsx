'use client';

import Link from 'next/link';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { Preloader } from '@/components/Preloader';

export default function DocsPage() {
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
            <Link href="/payees" className="hover:text-[#1A2218] transition-colors">
              Run History
            </Link>
            <Link href="/payees" className="hover:text-[#1A2218] transition-colors">
              Payees
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10 space-y-8">
        {/* ALWAYS PRESENT BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs text-[#6B7E64] font-medium">
          <Link href="/" className="hover:underline">
            PayRun Home
          </Link>
          <span>/</span>
          <span>Documentation & FAQ</span>
        </div>

        {/* 2-COLUMN LAYOUT: SIDEBAR INDEX (LEFT 3) & CONTENT (RIGHT 9) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
          {/* LEFT SIDEBAR INDEX (3 cols) */}
          <div className="md:col-span-3 space-y-4 sticky top-28 hidden md:block">
            <div className="text-xs font-semibold text-[#1A2218] uppercase tracking-wider">
              Docs
            </div>
            <nav className="space-y-2.5 text-xs text-[#5C6658]">
              <div>
                <a href="#how-it-works" className="hover:text-[#1A2218] transition-colors">
                  How it works
                </a>
              </div>
              <div>
                <a href="#csv-format" className="hover:text-[#1A2218] transition-colors">
                  CSV format
                </a>
              </div>
              <div>
                <a href="#wallet-requirements" className="hover:text-[#1A2218] transition-colors">
                  Wallet requirements
                </a>
              </div>
              <div>
                <a href="#faq" className="hover:text-[#1A2218] transition-colors">
                  FAQ
                </a>
              </div>
            </nav>
          </div>

          {/* MAIN DOCUMENTATION CONTENT (9 cols) */}
          <div className="md:col-span-9 space-y-10">
            {/* Title Section */}
            <div className="space-y-2">
              <h1 className="font-serif text-5xl font-normal text-[#1A2218] tracking-tight">
                Docs and FAQ
              </h1>
              <p className="text-sm text-[#5C6658]">
                How PayRun batches payments on Arc and what to prepare before a run.
              </p>
            </div>

            {/* Section 1: CSV format */}
            <div id="csv-format" className="space-y-4 pt-2">
              <h2 className="font-serif text-3xl font-normal text-[#1A2218]">
                CSV format
              </h2>

              <div className="rounded-2xl bg-[#0C1813] border border-[#1C362A] p-5 font-mono text-xs space-y-1.5 shadow-md">
                <div className="text-[#34D399] opacity-90">
                  name,address,amount,currency,memo
                </div>
                <div className="text-white">
                  Ada Lovelace,0xF494...E554,0.1,USDC,Sept salary - Ada
                </div>
              </div>

              <p className="text-xs text-[#5C6658] leading-relaxed">
                Addresses must be checksummed and not the zero address. Amounts must be above zero and the total within your balance.
              </p>
            </div>

            {/* Section 2: Frequently asked */}
            <div id="faq" className="space-y-4 pt-4">
              <h2 className="font-serif text-3xl font-normal text-[#1A2218]">
                Frequently asked
              </h2>

              <div className="space-y-4">
                {/* FAQ 1 */}
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-2">
                  <h3 className="font-semibold text-base text-[#1A2218]">
                    Why must I use a normal wallet?
                  </h3>
                  <p className="text-xs text-[#5C6658] leading-relaxed">
                    Multicall3From must be called directly from an EOA, so smart wallets and contracts are not supported. MetaMask works.
                  </p>
                </div>

                {/* FAQ 2 */}
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-2">
                  <h3 className="font-semibold text-base text-[#1A2218]">
                    Do recipients need to approve anything?
                  </h3>
                  <p className="text-xs text-[#5C6658] leading-relaxed">
                    No. Your wallet stays the sender, so no approvals are needed.
                  </p>
                </div>

                {/* FAQ 3 */}
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-2">
                  <h3 className="font-semibold text-base text-[#1A2218]">
                    What if one transfer fails?
                  </h3>
                  <p className="text-xs text-[#5C6658] leading-relaxed">
                    The batch uses allowFailure=false, so the whole run reverts and nobody is partly paid.
                  </p>
                </div>

                {/* FAQ 4 */}
                <div className="bg-[#FAF8F3] p-6 rounded-2xl border border-[#E8E2D2] shadow-sm space-y-2">
                  <h3 className="font-semibold text-base text-[#1A2218]">
                    Can I pay in euros?
                  </h3>
                  <p className="text-xs text-[#5C6658] leading-relaxed">
                    Yes. Set the currency column to EURC.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#E6E0CE] bg-[#EEE8DA] py-8 px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C6658]">
          <div>PayRun • Arc Network Microgrants Hackathon Project</div>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-[#1A2218]">
              Docs
            </Link>
            <a href="https://explorer.testnet.arc.network" target="_blank" rel="noreferrer" className="hover:text-[#1A2218]">
              Arc Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
