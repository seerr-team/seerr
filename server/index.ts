import csurf from '@dr.pogodin/csurf';
import PlexAPI from '@server/api/plexapi';
import dataSource, { getRepository, isPgsql } from '@server/datasource';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import { Session } from '@server/entity/Session';
import { User } from '@server/entity/User';
import { startJobs } from '@server/job/schedule';
import notificationManager from '@server/lib/notifications';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import clearCookies from '@server/middleware/clearcookies';
import routes from '@server/routes';
import avatarproxy from '@server/routes/avatarproxy';
import imageproxy from '@server/routes/imageproxy';
import { appDataPermissions } from '@server/utils/appDataVolume';
import { getAppVersion } from '@server/utils/appVersion';
import createCustomProxyAgent from '@server/utils/customProxyAgent';
import { initializeDnsCache } from '@server/utils/dnsCache';
import restartFlag from '@server/utils/restartFlag';
import { getClientIp } from '@supercharge/request-ip';
import axios from 'axios';
import { TypeormStore } from 'connect-typeorm/out';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import type { Store } from 'express-session';
import session from 'express-session';
import http from 'http';
import https from 'https';
import next from 'next';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const API_SPEC_PATH = path.join(__dirname, '../jellyseerr-api.yml');

logger.info(`Starting Jellyseerr version ${getAppVersion()}`);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

if (!appDataPermissions()) {
  logger.error(
    'Something went wrong while checking config folder! Please ensure the config folder is set up properly.\nhttps://docs.jellyseerr.dev/getting-started'
  );
}

app
  .prepare()
  .then(async () => {
    const dbConnection = await dataSource.initialize();

    // Run migrations in production
    if (process.env.NODE_ENV === 'production') {
      if (isPgsql) {
        await dbConnection.runMigrations();
      } else {
        await dbConnection.query('PRAGMA foreign_keys=OFF');
        await dbConnection.runMigrations();
        await dbConnection.query('PRAGMA foreign_keys=ON');
      }
    }

    // Load Settings
    const settings = await getSettings().load();
    restartFlag.initializeSettings(settings);

    if (settings.network.forceIpv4First) {
      axios.defaults.httpAgent = new http.Agent({ family: 4 });
      axios.defaults.httpsAgent = new https.Agent({ family: 4 });
    }

    // Add DNS caching
    if (settings.network.dnsCache) {
      initializeDnsCache({
        forceMinTtl: settings.network.dnsCache.forceMinTtl,
        forceMaxTtl: settings.network.dnsCache.forceMaxTtl,
      });
    }

    // Register HTTP proxy
    if (settings.network.proxy.enabled) {
      await createCustomProxyAgent(settings.network.proxy);
    }

    // Migrate library types
    if (
      settings.plex.libraries.length > 1 &&
      !settings.plex.libraries[0].type
    ) {
      const userRepository = getRepository(User);
      const admin = await userRepository.findOne({
        select: { id: true, plexToken: true },
        where: { id: 1 },
      });

      if (admin) {
        logger.info('Migrating Plex libraries to include media type', {
          label: 'Settings',
        });

        const plexapi = new PlexAPI({ plexToken: admin.plexToken });
        await plexapi.syncLibraries();
      }
    }

    // Register Notification Agents
    notificationManager.registerAllAgents();

    const userRepository = getRepository(User);
    const totalUsers = await userRepository.count();
    if (totalUsers > 0) {
      startJobs();
    } else {
      logger.info(
        `Skipping starting the scheduled jobs as we have no Plex/Jellyfin/Emby servers setup yet`,
        {
          label: 'Server',
        }
      );
    }

    // Bootstrap Discovery Sliders
    await DiscoverSlider.bootstrapSliders();

    const server = express();
    if (settings.network.trustProxy) {
      server.enable('trust proxy');
    }
    server.use(cookieParser());
    server.use(express.json());
    server.use(express.urlencoded({ extended: true }));
    server.use((req, _res, next) => {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(req, 'ip');
        if (descriptor?.writable === true) {
          (req as any).ip = getClientIp(req) ?? '';
        }
      } catch (e) {
        logger.error('Failed to attach the ip to the request', {
          label: 'Middleware',
          message: e.message,
        });
      } finally {
        next();
      }
    });
    if (settings.network.csrfProtection) {
      server.use(
        csurf({
          cookie: {
            httpOnly: true,
            sameSite: true,
            secure: !dev,
          },
        })
      );
      server.use((req, res, next) => {
        res.cookie('XSRF-TOKEN', req.csrfToken(), {
          sameSite: true,
          secure: !dev,
        });
        next();
      });
    }

    // Set up sessions
    const sessionRespository = getRepository(Session);
    server.use(
      '/api',
      session({
        secret: settings.clientId,
        resave: false,
        saveUninitialized: false,
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 30,
          httpOnly: true,
          sameSite: settings.network.csrfProtection ? 'strict' : 'lax',
          secure: 'auto',
        },
        store: new TypeormStore({
          cleanupLimit: 2,
          ttl: 60 * 60 * 24 * 30,
        }).connect(sessionRespository) as Store,
      })
    );
    const apiDocs = YAML.load(API_SPEC_PATH);
    server.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiDocs));
    server.use(
      OpenApiValidator.middleware({
        apiSpec: API_SPEC_PATH,
        validateRequests: true,
      })
    );
    /**
     * This is a workaround to convert dates to strings before they are validated by
     * OpenAPI validator. Otherwise, they are treated as objects instead of strings
     * and response validation will fail
     */
    server.use((_req, res, next) => {
      const original = res.json;
      res.json = function jsonp(json) {
        return original.call(this, JSON.parse(JSON.stringify(json)));
      };
      next();
    });
    server.use('/api/v1', routes);

    // Do not set cookies so CDNs can cache them
    server.use('/imageproxy', clearCookies, imageproxy);
    server.use('/avatarproxy', clearCookies, avatarproxy);

    server.get('*', (req, res) => handle(req, res));
    server.use(
      (
        err: { status: number; message: string; errors: string[] },
        _req: Request,
        res: Response,
        // We must provide a next function for the function signature here even though its not used
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _next: NextFunction
      ) => {
        // format error
        res.status(err.status || 500).json({
          message: err.message,
          errors: err.errors,
        });
      }
    );

    const port = Number(process.env.PORT) || 5055;
    const host = process.env.HOST;
    if (host) {
      server.listen(port, host, () => {
        logger.info(`Server ready on ${host} port ${port}`, {
          label: 'Server',
        });
      });
    } else {
      server.listen(port, () => {
        logger.info(`Server ready on port ${port}`, {
          label: 'Server',
        });
      });
    }
  })
  .catch((err) => {
    logger.error(err.stack);
    process.exit(1);
  });
