/* eslint-disable @typescript-eslint/no-unused-vars */
import type { User } from '@server/entity/User';
import type { NextFunction, Request, Response } from 'express';
import 'express-session';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
      locale?: string;
      forwardAuth?: {
        emailHeader: string;
        userHeader: string;
      };
    }
  }

  export type Middleware = <ParamsDictionary, any, any>(
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void | NextFunction> | void | NextFunction;
}
