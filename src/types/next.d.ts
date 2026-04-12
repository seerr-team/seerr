/* eslint-disable @typescript-eslint/no-unused-vars */
import type { User } from '@server/entity/User';
import 'http';

declare module 'http' {
  export interface IncomingMessage {
    user?: User;
    locale?: string;
    forwardAuth?: {
      emailHeader: string;
      userHeader: string;
    };
  }
}
