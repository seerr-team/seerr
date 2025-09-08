import type { AxiosError, AxiosResponse } from 'axios';
import axios from 'axios';

interface JellyfinAuthenticationResult {
  Id: string;
  AccessToken: string;
  ServerId: string;
}

class JellyAPI {
  public login(
    Hostname?: string,
    Username?: string,
    Password?: string
  ): Promise<JellyfinAuthenticationResult> {
    return new Promise(
      (
        resolve: (result: JellyfinAuthenticationResult) => void,
        reject: (e: Error) => void
      ) => {
        axios
          .post(
            Hostname + '/Users/AuthenticateByName',
            {
              Username: Username,
              Pw: Password,
            },
            {
              headers: {
                'X-Emby-Authorization':
                  'MediaBrowser Client="Jellyfin Web", Device="Firefox", DeviceId="TW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NDsgcnY6ODUuMCkgR2Vja28vMjAxMDAxMDEgRmlyZWZveC84NS4wfDE2MTI5MjcyMDM5NzM1", Version="10.8.0"',
              },
            }
          )
          .then((resp: AxiosResponse) => {
            const response: JellyfinAuthenticationResult = {
              Id: resp.data.User.Id,
              AccessToken: resp.data.AccessToken,
              ServerId: resp.data.ServerId,
            };
            resolve(response);
          })
          .catch((e: AxiosError) => {
            reject(e);
          });
      }
    );
  }
}

export default JellyAPI;
