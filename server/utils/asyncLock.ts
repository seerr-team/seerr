import { EventEmitter } from 'events';

// whenever you need to run async code on tv show or movie that does "get existing" / "check if need to create new" / "save"
// then you need to put all of that code in "await asyncLock.dispatch" callback based on media id
// this will guarantee that only one part of code will run at the same for this media id to avoid code
// trying to create two or more entries for same movie/tvshow (which would result in sqlite unique constraint failrue)

class AsyncLock {
  private locked: { [key: string]: boolean } = {};
  private ee = new EventEmitter();

  constructor() {
    this.ee.setMaxListeners(0);
  }

  private acquire = async (key: string) => {
    return new Promise((resolve) => {
      if (!this.locked[key]) {
        this.locked[key] = true;
        return resolve(undefined);
      }

      const nextAcquire = () => {
        if (!this.locked[key]) {
          this.locked[key] = true;
          this.ee.removeListener(key, nextAcquire);
          return resolve(undefined);
        }
      };

      this.ee.on(key, nextAcquire);
    });
  };

  private release = (key: string): void => {
    delete this.locked[key];
    setImmediate(() => this.ee.emit(key));
  };

  public dispatch = async <T>(
    key: string | number,
    callback: () => Promise<T>
  ): Promise<T> => {
    const skey = String(key);
    await this.acquire(skey);
    try {
      return await callback();
    } finally {
      this.release(skey);
    }
  };
}

export default AsyncLock;
