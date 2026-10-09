import { randomUUID } from 'expo-crypto';

/**
 * Places session token: one token covers a run of autocomplete requests and
 * the details call that ends it, then a new one starts (NFR-9, APP-API-05).
 */
export class PlacesSession {
  private token: string | undefined;

  constructor(private readonly generate: () => string = randomUUID) {}

  /** The current token, created on first use. */
  current(): string {
    return (this.token ??= this.generate());
  }

  /** Ends the session; the next request starts a new one. */
  rotate(): void {
    this.token = undefined;
  }
}
