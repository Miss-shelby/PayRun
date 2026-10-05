'use client';

import { useEffect, useState } from 'react';

export function Preloader({ onComplete }: { onComplete?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show preloader for 1.8 seconds for a sleek initial experience
    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 1500);

    const timer2 = setTimeout(() => {
      setLoading(false);
      if (onComplete) onComplete();
    }, 1900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  if (!loading) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#F7F4EB] flex flex-col items-center justify-center transition-opacity duration-500 selection:bg-none ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center space-y-5">
        {/* Serene Pulsing Olive Sprout Brand Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-[#E5ECD9] border border-[#BACDA9] flex items-center justify-center text-[#3D5A35] shadow-md animate-pulse">
            <span className="font-serif font-bold text-2xl">P</span>
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-[#3D5A35]/20 border-t-[#3D5A35] animate-spin"></div>
        </div>

        {/* Brand Name */}
        <div className="text-center space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#253621]">
            Pay<span className="text-[#3D5A35]">Run</span>
          </h1>
          <p className="text-xs text-[#75886F] font-mono tracking-wider uppercase">
            Arc Network Payroll Engine
          </p>
        </div>

        {/* Minimal Progress Line */}
        <div className="w-36 h-1 bg-[#E2DAC4] rounded-full overflow-hidden mt-4">
          <div className="h-full bg-[#3D5A35] rounded-full animate-[progress_1.8s_ease-in-out_infinite]"></div>
        </div>
      </div>
    </div>
  );
}
