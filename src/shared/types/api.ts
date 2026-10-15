// Replace/extend public contracts from the API's OpenAPI output as features land.
// Server DTO classes and database models must never be imported into this app.
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
}
