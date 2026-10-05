'use client';

import { ConnectKitButton } from 'connectkit';

export function ConnectWalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address }) => {
        return (
          <button
            onClick={show}
            type="button"
            className="px-5 py-2 rounded-lg font-medium text-sm transition-all bg-[#3D5A35] hover:bg-[#314A2A] text-[#F8F6F0] flex items-center gap-2 border border-[#314A2A] shadow-sm cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-emerald-200"
              }`}
            ></span>
            <span>
              {isConnected
                ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                : isConnecting
                ? "Connecting..."
                : "Connect Wallet"}
            </span>
          </button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}
