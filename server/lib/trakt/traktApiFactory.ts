import TraktAPI from '@server/api/trakt';
import { getSettings, type TraktSettings } from '@server/lib/settings';
import { isTraktConfigured } from '@server/lib/trakt/config';

class TraktApiFactory {
  public create(settings: TraktSettings, accessToken?: string): TraktAPI {
    return new TraktAPI(
      settings.clientId.trim(),
      settings.clientSecret,
      accessToken
    );
  }

  public apiFor(accessToken?: string): TraktAPI {
    const settings = getSettings().trakt;
    if (!isTraktConfigured(settings)) {
      throw new Error('Trakt application is not configured');
    }
    return this.create(settings, accessToken);
  }
}

export const traktApiFactory = new TraktApiFactory();
