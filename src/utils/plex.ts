import axios from 'axios';
import Bowser from 'bowser';

interface PlexHeaders extends Record<string, string> {
  Accept: string;
  'X-Plex-Product': string;
  'X-Plex-Version': string;
  'X-Plex-Client-Identifier': string;
  'X-Plex-Model': string;
  'X-Plex-Platform': string;
  'X-Plex-Platform-Version': string;
  'X-Plex-Device': string;
  'X-Plex-Device-Name': string;
  'X-Plex-Device-Screen-Resolution': string;
  'X-Plex-Language': string;
}

export interface PlexPin {
  id: number;
  code: string;
}

class PlexOAuth {
  private plexHeaders?: PlexHeaders;

  private pin?: PlexPin;
  private popup?: Window;

  private authToken?: string;

  public initializeHeaders(plexClientIdentifier: string): void {
    if (typeof window === 'undefined') {
      throw new Error(
        'Window is not defined. Are you calling this in the browser?'
      );
    }

    if (!plexClientIdentifier) {
      throw new Error(
        'Plex client identifier missing. Reload the page and try again.'
      );
    }

    const browser = Bowser.getParser(window.navigator.userAgent);
    this.plexHeaders = {
      Accept: 'application/json',
      'X-Plex-Product': 'Seerr',
      'X-Plex-Version': 'Plex OAuth',
      'X-Plex-Client-Identifier': plexClientIdentifier,
      'X-Plex-Model': 'Plex OAuth',
      'X-Plex-Platform': browser.getBrowserName(),
      'X-Plex-Platform-Version': browser.getBrowserVersion() || 'Unknown',
      'X-Plex-Device': browser.getOSName(),
      'X-Plex-Device-Name': `${browser.getBrowserName()} (Seerr)`,
      'X-Plex-Device-Screen-Resolution':
        window.screen.width + 'x' + window.screen.height,
      'X-Plex-Language': 'en',
    };
  }

  public async getPin(): Promise<PlexPin> {
    if (!this.plexHeaders) {
      throw new Error(
        'You must initialize the plex headers clientside to login'
      );
    }
    const response = await axios.post(
      'https://plex.tv/api/v2/pins?strong=true',
      undefined,
      { headers: this.plexHeaders }
    );

    this.pin = { id: response.data.id, code: response.data.code };

    return this.pin;
  }

  public preparePopup(): void {
    this.openPopup({ title: 'Plex Auth', w: 600, h: 700 });
  }

  public async login(plexClientIdentifier: string): Promise<string> {
    try {
      this.initializeHeaders(plexClientIdentifier);
      await this.getPin();
    } catch (e) {
      this.closePopup();
      throw e;
    }

    if (!this.plexHeaders || !this.pin) {
      throw new Error('Unable to call login if class is not initialized.');
    }

    const params = {
      clientID: this.plexHeaders['X-Plex-Client-Identifier'],
      'context[device][product]': this.plexHeaders['X-Plex-Product'],
      'context[device][version]': this.plexHeaders['X-Plex-Version'],
      'context[device][platform]': this.plexHeaders['X-Plex-Platform'],
      'context[device][platformVersion]':
        this.plexHeaders['X-Plex-Platform-Version'],
      'context[device][device]': this.plexHeaders['X-Plex-Device'],
      'context[device][deviceName]': this.plexHeaders['X-Plex-Device-Name'],
      'context[device][model]': this.plexHeaders['X-Plex-Model'],
      'context[device][screenResolution]':
        this.plexHeaders['X-Plex-Device-Screen-Resolution'],
      'context[device][layout]': 'desktop',
      code: this.pin.code,
    };

    if (!this.popup || this.popup.closed) {
      throw new Error(
        'Unable to open the Plex login window. Please allow popups for this site and try again.'
      );
    }

    this.popup.location.href = `https://app.plex.tv/auth/#!?${this.encodeData(
      params
    )}`;

    return this.pinPoll();
  }

  private async pinPoll(): Promise<string> {
    // popup.closed is unreliable under COOP same-origin-allow-popups once the
    // popup navigates to app.plex.tv; bound polling by expiresAt with a 15m
    // hard fallback.
    const deadline = Date.now() + 15 * 60 * 1000;
    const executePoll = async (
      resolve: (authToken: string) => void,
      reject: (e: Error) => void
    ) => {
      try {
        if (!this.pin) {
          throw new Error('Unable to poll when pin is not initialized.');
        }

        const response = await axios.get(
          `https://plex.tv/api/v2/pins/${this.pin.id}`,
          { headers: this.plexHeaders }
        );

        if (response.data?.authToken) {
          this.authToken = response.data.authToken as string;
          this.closePopup();
          resolve(this.authToken);
        } else {
          const expiresAt = response.data?.expiresAt
            ? Date.parse(response.data.expiresAt)
            : deadline;
          if (Date.now() >= Math.min(expiresAt, deadline)) {
            this.closePopup();
            reject(new Error('Plex PIN expired before login completed.'));
            return;
          }
          setTimeout(executePoll, 1000, resolve, reject);
        }
      } catch (e) {
        this.closePopup();
        reject(e);
      }
    };

    return new Promise(executePoll);
  }

  private closePopup(): void {
    this.popup?.close();
    this.popup = undefined;
  }

  private openPopup({
    title,
    w,
    h,
  }: {
    title: string;
    w: number;
    h: number;
  }): Window | void {
    if (typeof window === 'undefined') {
      throw new Error(
        'Window is undefined. Are you running this in the browser?'
      );
    }
    // Fixes dual-screen position                         Most browsers      Firefox
    const dualScreenLeft =
      window.screenLeft != undefined ? window.screenLeft : window.screenX;
    const dualScreenTop =
      window.screenTop != undefined ? window.screenTop : window.screenY;
    const width = window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth
        ? document.documentElement.clientWidth
        : screen.width;
    const height = window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight
        ? document.documentElement.clientHeight
        : screen.height;
    const left = width / 2 - w / 2 + dualScreenLeft;
    const top = height / 2 - h / 2 + dualScreenTop;

    //Set url to login/plex/loading so browser doesn't block popup
    const newWindow = window.open(
      '/login/plex/loading',
      title,
      'scrollbars=yes, width=' +
        w +
        ', height=' +
        h +
        ', top=' +
        top +
        ', left=' +
        left
    );
    if (newWindow) {
      newWindow.focus();
      this.popup = newWindow;
      return this.popup;
    }
  }

  private encodeData(data: Record<string, string>): string {
    return Object.keys(data)
      .map(function (key) {
        return [key, data[key]].map(encodeURIComponent).join('=');
      })
      .join('&');
  }
}

export default PlexOAuth;
