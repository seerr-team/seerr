import ExternalAPI from './externalapi';

interface PushoverSoundsResponse {
  sounds: {
    [name: string]: string;
  };
  status: number;
  request: string;
}

export interface PushoverSound {
  name: string;
  description: string;
}

export const mapSounds = (sounds: {
  [name: string]: string;
}): PushoverSound[] =>
  Object.entries(sounds).map(
    ([name, description]) =>
      ({
        name,
        description,
      } as PushoverSound)
  );

class PushoverAPI extends ExternalAPI {
  constructor() {
    super(
      'https://api.pushover.net/1',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
  }

  public async getSounds(appToken: string): Promise<PushoverSound[]> {
    try {
      const data = await this.get<PushoverSoundsResponse>('/sounds.json', {
        params: {
          token: appToken,
        },
      });

      return mapSounds(data.sounds);
    } catch (e) {
      throw new Error(`[Pushover] Failed to retrieve sounds: ${e.message}`);
    }
  }
}

export default PushoverAPI;
