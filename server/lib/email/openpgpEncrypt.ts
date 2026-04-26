import logger from '@server/logger';
import { randomBytes } from 'crypto';
import * as openpgp from 'openpgp';
import type { TransformCallback } from 'stream';
import { Transform } from 'stream';

interface EncryptorOptions {
  signingKey?: string;
  password?: string;
  encryptionKeys: string[];
}

class PGPEncryptor extends Transform {
  private _messageChunks: Uint8Array[] = [];
  private _messageLength = 0;
  private _signingKey?: string;
  private _password?: string;

  private _encryptionKeys: string[];

  constructor(options: EncryptorOptions) {
    super();
    this._signingKey = options.signingKey;
    this._password = options.password;
    this._encryptionKeys = options.encryptionKeys;
  }

  // just save the whole message
  _transform = (
    chunk: Uint8Array,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void => {
    this._messageChunks.push(chunk);
    this._messageLength += chunk.length;
    callback();
  };

  // Actually do stuff
  _flush = async (callback: TransformCallback): Promise<void> => {
    const message = Buffer.concat(this._messageChunks, this._messageLength);

    try {
      // Reconstruct message as buffer
      const validPublicKeys = await Promise.all(
        this._encryptionKeys.map((armoredKey) =>
          openpgp.readKey({ armoredKey })
        )
      );
      let privateKey: openpgp.PrivateKey | undefined;

      // Just return the message if there is no one to encrypt for
      if (!validPublicKeys.length) {
        this.push(message);
        return callback();
      }

      // Only sign the message if private key and password exist
      if (this._signingKey && this._password) {
        privateKey = await openpgp.decryptKey({
          privateKey: await openpgp.readPrivateKey({
            armoredKey: this._signingKey,
          }),
          passphrase: this._password,
        });
      }

      const emailPartDelimiter = '\r\n\r\n';
      const messageParts = message.toString().split(emailPartDelimiter);

      /**
       * In this loop original headers are split up into two parts,
       * one for the email that is sent
       * and one for the encrypted content
       */
      const header = messageParts.shift() as string;
      const emailHeaders: string[][] = [];
      const contentHeaders: string[][] = [];
      const linesInHeader = header.split('\r\n');
      let previousHeader: string[] = [];
      for (let i = 0; i < linesInHeader.length; i++) {
        const line = linesInHeader[i];

        if (/^\s/.test(line) || i === 0) {
          previousHeader.push(line);
        } else {
          if (
            /^(content-type|content-transfer-encoding):/i.test(
              previousHeader[0]
            )
          ) {
            contentHeaders.push(previousHeader);
          } else {
            emailHeaders.push(previousHeader);
          }
          previousHeader = [line];
        }
      }

      if (previousHeader.length > 0) {
        if (
          /^(content-type|content-transfer-encoding):/i.test(previousHeader[0])
        ) {
          contentHeaders.push(previousHeader);
        } else {
          emailHeaders.push(previousHeader);
        }
      }

      // Generate a new boundary for the email content
      const boundary = 'nm_' + randomBytes(14).toString('hex');
      /**
       * Concatenate everything into single strings
       * and add pgp headers to the email headers
       */
      const emailHeadersRaw =
        emailHeaders.map((line) => line.join('\r\n')).join('\r\n') +
        '\r\n' +
        'Content-Type: multipart/encrypted; protocol="application/pgp-encrypted";' +
        '\r\n' +
        ' boundary="' +
        boundary +
        '"' +
        '\r\n' +
        'Content-Description: OpenPGP encrypted message' +
        '\r\n' +
        'Content-Transfer-Encoding: 7bit';
      const contentHeadersRaw = contentHeaders
        .map((line) => line.join('\r\n'))
        .join('\r\n');

      const encryptedMessage = await openpgp.encrypt({
        message: await openpgp.createMessage({
          text:
            contentHeadersRaw +
            emailPartDelimiter +
            messageParts.join(emailPartDelimiter),
        }),
        encryptionKeys: validPublicKeys,
        signingKeys: privateKey,
      });

      const body =
        '--' +
        boundary +
        '\r\n' +
        'Content-Type: application/pgp-encrypted\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        '\r\n' +
        'Version: 1\r\n' +
        '\r\n' +
        '--' +
        boundary +
        '\r\n' +
        'Content-Type: application/octet-stream; name=encrypted.asc\r\n' +
        'Content-Disposition: inline; filename=encrypted.asc\r\n' +
        'Content-Transfer-Encoding: 7bit\r\n' +
        '\r\n' +
        encryptedMessage +
        '\r\n--' +
        boundary +
        '--\r\n';

      this.push(Buffer.from(emailHeadersRaw + emailPartDelimiter + body));
      callback();
    } catch (e) {
      logger.error(
        'Something went wrong while encrypting email message with OpenPGP. Sending email without encryption',
        {
          label: 'Notifications',
          errorMessage: e.message,
        }
      );

      this.push(message);
      callback();
    }
  };
}

export const openpgpEncrypt = (options: EncryptorOptions) => {
  // Disabling this line because I don't want to fix it but I am tired
  // of seeing the lint warning
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (mail: any, callback: () => unknown): void {
    if (!options.encryptionKeys.length) {
      setImmediate(callback);
    }
    mail.message.transform(
      () =>
        new PGPEncryptor({
          signingKey: options.signingKey,
          password: options.password,
          encryptionKeys: options.encryptionKeys,
        })
    );
    setImmediate(callback);
  };
};
