export function AdminOverview() {
  return (
    <section
      className="workflow-card"
      id="administration"
      aria-labelledby="admin-title"
    >
      <div className="card-heading">
        <span className="step-number" aria-hidden="true">
          03
        </span>
        <span className="planned-label">Planned</span>
      </div>
      <h2 id="admin-title">Manage the handover</h2>
      <p>
        Give administrators the tools to maintain the catalog and record
        custody.
      </p>
      <ul>
        <li>Review team reservations</li>
        <li>Record checkout and return</li>
        <li>Maintain active equipment</li>
      </ul>
      <p className="card-note">
        Next: enforce roles before adding admin actions.
      </p>
    </section>
  );
}
