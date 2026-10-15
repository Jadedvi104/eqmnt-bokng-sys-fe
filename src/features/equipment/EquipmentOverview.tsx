export function EquipmentOverview() {
  return (
    <section
      className="workflow-card"
      id="equipment"
      aria-labelledby="equipment-title"
    >
      <div className="card-heading">
        <span className="step-number" aria-hidden="true">
          01
        </span>
        <span className="planned-label">Planned</span>
      </div>
      <h2 id="equipment-title">Find your equipment</h2>
      <p>
        One catalog for every shared item, with a clear view of when it is free.
      </p>
      <ul>
        <li>Search by name and category</li>
        <li>Review available one-hour slots</li>
        <li>Confirm in your selected time zone</li>
      </ul>
      <p className="card-note">
        Next: connect the catalog and availability API.
      </p>
    </section>
  );
}
