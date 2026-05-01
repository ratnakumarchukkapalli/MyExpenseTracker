export default function Loading() {
  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", background: "var(--color-surface-900, #0E0B14)" }}>
      {/* Sidebar skeleton */}
      <aside className="sidebar" style={{ flexShrink: 0 }}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">MET</div>
          <div className="sidebar-brand-text">
            <span style={{ opacity: 0.4 }}>My Expense</span>
            <span style={{ opacity: 0.4 }}>Tracker</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 12px", flex: 1 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <header className="topbar">
          <div className="skeleton" style={{ width: 160, height: 24, borderRadius: 6 }} />
          <div style={{ flex: 1 }} />
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%", marginLeft: 8 }} />
        </header>

        {/* Dashboard grid skeleton */}
        <main className="content">
          {/* KPI cards row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
            ))}
          </div>
          {/* Chart + ring row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
            <div className="skeleton" style={{ height: 240, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 240, borderRadius: 12 }} />
          </div>
          {/* Expense table */}
          <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
        </main>
      </div>
    </div>
  );
}
