export class TraktConfigurationMutex {
  private tail: Promise<void> = Promise.resolve();

  public run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    return previous.then(operation).finally(release);
  }
}

export const traktConfigurationMutex = new TraktConfigurationMutex();
