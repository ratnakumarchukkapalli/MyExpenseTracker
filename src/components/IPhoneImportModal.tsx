'use client';

import React from 'react';
import { Smartphone, X } from 'lucide-react';

type Props = {
  onClose: () => void;
};

function IPhoneImportModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-gray-900">iPhone import is not yet web-enabled</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-600">
          The original desktop flow depended on local file and iCloud integration. This modal exists so the imported component surface is complete
          in the webapp while the actual browser-safe upload and import flow gets designed separately.
        </p>
      </div>
    </div>
  );
}

export default IPhoneImportModal;
