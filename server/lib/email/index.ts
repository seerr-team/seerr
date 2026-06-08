import type { NotificationAgentEmail } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import Email from 'email-templates';
import nodemailer from 'nodemailer';
import { URL } from 'url';
import { openpgpEncrypt } from './openpgpEncrypt';

class PreparedEmail extends Email {
  private constructor(
    settings: NotificationAgentEmail,
    pgpKey?: string,
    accessToken?: string
  ) {
    const { applicationUrl } = getSettings().main;

    const transport = nodemailer.createTransport({
      name: applicationUrl ? new URL(applicationUrl).hostname : undefined,
      host: settings.options.smtpHost,
      port: settings.options.smtpPort,
      secure: settings.options.secure,
      ignoreTLS: settings.options.ignoreTls,
      requireTLS: settings.options.requireTls,
      tls: settings.options.allowSelfSigned
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
      auth: (() => {
        if (settings.options.authType === 'oauth2') {
          if (accessToken) {
            return {
              type: 'OAuth2' as const,
              user: settings.options.authUser,
              accessToken,
            };
          }
        } else if (settings.options.authType === 'basic') {
          if (settings.options.authUser && settings.options.authPass) {
            return {
              user: settings.options.authUser,
              pass: settings.options.authPass,
            };
          }
        }
        return undefined;
      })(),
    });

    if (pgpKey) {
      transport.use(
        'stream',
        openpgpEncrypt({
          signingKey: settings.options.pgpPrivateKey,
          password: settings.options.pgpPassword,
          encryptionKeys: [pgpKey],
        })
      );
    }

    super({
      message: {
        from: {
          name: settings.options.senderName,
          address: settings.options.emailFrom,
        },
      },
      send: true,
      transport: transport,
      preview: false,
    });
  }

  // Nodemailer's OAuth2 token refresh omits `scope`, which Microsoft requires, so we exchange the refresh token ourselves.
  public static async create(
    settings: NotificationAgentEmail,
    pgpKey?: string
  ): Promise<PreparedEmail> {
    const { options } = settings;
    let accessToken: string | undefined;

    if (
      options.authType === 'oauth2' &&
      options.oAuth2ClientId &&
      options.oAuth2RefreshToken &&
      options.oAuth2TokenUrl
    ) {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: options.oAuth2ClientId,
        refresh_token: options.oAuth2RefreshToken,
      });

      // Public clients (e.g. personal Microsoft accounts using the device
      // code flow) must NOT send a client_secret — Azure AD rejects the
      // request with AADSTS90023 if they do.
      if (options.oAuth2ClientSecret) {
        params.set('client_secret', options.oAuth2ClientSecret);
      }

      if (options.oAuth2Scope) {
        params.set('scope', options.oAuth2Scope);
      }

      const response = await fetch(options.oAuth2TokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `Failed to retrieve OAuth2 access token: ${responseText}`
        );
      }

      const tokenData = (await response.json()) as { access_token: string };
      accessToken = tokenData.access_token;
    }

    return new PreparedEmail(settings, pgpKey, accessToken);
  }
}

export default PreparedEmail;
