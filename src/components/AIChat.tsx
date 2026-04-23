'use client';

import React from 'react';
import { MessageSquareText, ShieldAlert } from 'lucide-react';

function AIChat() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="pane rounded-[28px] p-6">
        <div className="flex items-center gap-3">
          <MessageSquareText className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-2xl font-semibold">AI chat surface is reserved</h2>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
          The old Electron app talked to local model tooling directly. In the webapp, this panel is intentionally left as a safe
          placeholder until the authenticated route design is finalized so we do not regress the security work already tracked in beads.
        </p>
      </section>

      <section className="pane rounded-[28px] p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-[var(--neg)]" />
          <h3 className="text-lg font-semibold">Next migration step</h3>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
          Wire this view to authenticated Next.js API routes instead of desktop IPC or local-only services. That keeps the web shell
          complete without shipping an unsafe direct browser-to-model integration.
        </p>
      </section>
    </div>
  );
}

export default AIChat;
