export function ReservationsOverview() {
  return (
    <section
      className="workflow-card"
      id="reservations"
      aria-labelledby="reservations-title"
    >
      <div className="card-heading">
        <span className="step-number" aria-hidden="true">
          02
        </span>
        <span className="planned-label">Planned</span>
      </div>
      <h2 id="reservations-title">Keep track of your plans</h2>
      <p>
        Reserve one item at a time and follow it from confirmation to return.
      </p>
      <ul>
        <li>Book a future slot within 30 days</li>
        <li>View upcoming bookings and history</li>
        <li>Cancel eligible reservations</li>
      </ul>
      <p className="card-note">Next: add sign-in and the first booking flow.</p>
    </section>
  );
}
