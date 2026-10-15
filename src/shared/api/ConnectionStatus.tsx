import { useState } from 'react';
import { apiRequest } from './client';

type Connection = 'idle' | 'checking' | 'online' | 'offline';

const messages: Record<Connection, string> = {
  idle: 'Connection not checked',
  checking: 'Checking the API…',
  online: 'API is online',
  offline: 'API unavailable. Start the back-end project and try again.',
};

export function ConnectionStatus() {
  const [connection, setConnection] = useState<Connection>('idle');

  async function checkConnection() {
    setConnection('checking');
    try {
      await apiRequest('/health', { signal: AbortSignal.timeout(5000) });
      setConnection('online');
    } catch {
      setConnection('offline');
    }
  }

  return (
    <aside className="connection-panel" aria-label="API connection">
      <div>
        <p className="eyebrow">Development connection</p>
        <p className="connection-message" role="status">
          <span
            className={`status-dot status-dot--${connection}`}
            aria-hidden="true"
          />
          {messages[connection]}
        </p>
        <p className="supporting-text">
          Liveness only. Booking and database readiness are separate milestones.
        </p>
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={connection === 'checking'}
        onClick={() => void checkConnection()}
      >
        {connection === 'checking' ? 'Checking…' : 'Check connection'}
      </button>
    </aside>
  );
}
