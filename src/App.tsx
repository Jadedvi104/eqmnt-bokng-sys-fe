import { AdminOverview } from './features/admin/AdminOverview';
import { EquipmentOverview } from './features/equipment/EquipmentOverview';
import { ReservationsOverview } from './features/reservations/ReservationsOverview';
import { ConnectionStatus } from './shared/api/ConnectionStatus';

export function App() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="page-shell">
        <header className="site-header">
          <a className="brand" href="#main" aria-label="Equipment Booking home">
            <span className="brand-mark" aria-hidden="true">
              eb.
            </span>
            <span>Equipment Booking</span>
          </a>
          <nav aria-label="Planned workflows">
            <a href="#equipment">Equipment</a>
            <a href="#reservations">Reservations</a>
            <a href="#administration">Administration</a>
          </nav>
        </header>

        <main id="main" tabIndex={-1}>
          <section className="hero" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">Shared equipment · One team</p>
              <h1 id="page-title">
                Good equipment.
                <br />
                Better coordination.
              </h1>
              <p className="hero-description">
                Find what you need, reserve a time, and keep every handover
                clear. Your team’s booking workspace starts here.
              </p>
            </div>
            <aside className="foundation-note" aria-label="Project status">
              <span className="foundation-badge">Foundation ready</span>
              <h2>The next step is the first real booking.</h2>
              <p>
                The front-end project is initialized. Sign-in, equipment data,
                reservations, and administrator actions are still to be built.
              </p>
            </aside>
          </section>

          <div className="section-intro">
            <h2>Three workflows. One shared workspace.</h2>
            <p>This is the starting point for the experience ahead.</p>
          </div>
          <div className="workflow-grid">
            <EquipmentOverview />
            <ReservationsOverview />
            <AdminOverview />
          </div>

          <ConnectionStatus />
        </main>

        <footer className="site-footer">
          <span>Equipment Booking · Project foundation</span>
          <span>
            Browser time zone: <strong>{timeZone}</strong>
          </span>
        </footer>
      </div>
    </>
  );
}
