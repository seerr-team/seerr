export interface TraktAccessContext {
  connectionId: number;
  accessToken: string;
  tokenVersion: number;
}

export class TraktRefreshCoordinator {
  private readonly inFlight = new Map<number, Promise<TraktAccessContext>>();

  public run(
    connectionId: number,
    refresh: () => Promise<TraktAccessContext>
  ): Promise<TraktAccessContext> {
    const active = this.inFlight.get(connectionId);
    if (active) {
      return active;
    }

    const created: Promise<TraktAccessContext> = refresh().finally(() => {
      if (this.inFlight.get(connectionId) === created) {
        this.inFlight.delete(connectionId);
      }
    });
    this.inFlight.set(connectionId, created);
    return created;
  }
}
