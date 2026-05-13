import * as net from 'node:net';
import * as tls from 'node:tls';
import { EventEmitter } from 'node:events';
import type { SMTPConfig, SMTPResponse, SMTPAuth } from '@nexomailer/shared';
import {
  SMTPConnectionError, SMTPAuthError, SMTPError, SMTPTimeoutError,
  createLogger, base64Encode, SMTP_CODES, DEFAULTS,
} from '@nexomailer/shared';

export interface Envelope {
  from: string;
  to: string[];
}

type SMTPSocket = net.Socket | tls.TLSSocket;

/**
 * Low-level SMTP client built on Node.js net/tls.
 * Handles EHLO, STARTTLS, AUTH, MAIL FROM, RCPT TO, DATA.
 */
export class SMTPClient extends EventEmitter {
  private socket: SMTPSocket | null = null;
  private readonly config: Required<Pick<SMTPConfig, 'host' | 'port'>> & SMTPConfig;
  private readonly logger;
  private connected = false;
  private secure = false;
  private extensions: Map<string, string> = new Map();
  private responseBuffer = '';

  constructor(config: SMTPConfig) {
    super();
    this.config = {
      ...config,
      connectionTimeout: config.connectionTimeout ?? DEFAULTS.SMTP.connectionTimeout,
      socketTimeout: config.socketTimeout ?? DEFAULTS.SMTP.socketTimeout,
    };
    this.logger = createLogger({ level: 'info', prefix: 'smtp' });
  }

  /** Establish connection and perform handshake */
  async connect(): Promise<void> {
    if (this.connected) return;

    this.logger.debug(`Connecting to ${this.config.host}:${this.config.port}`);

    if (this.config.secure || this.config.port === 465) {
      this.socket = tls.connect({
        host: this.config.host,
        port: this.config.port,
        rejectUnauthorized: this.config.tls?.rejectUnauthorized ?? true,
        servername: this.config.tls?.servername ?? this.config.host,
      });
      this.secure = true;
    } else {
      this.socket = net.createConnection({
        host: this.config.host,
        port: this.config.port,
      });
    }

    this.socket.setTimeout(this.config.socketTimeout!);

    await this.waitForResponse(SMTP_CODES.READY, 'connect');

    // EHLO
    const ehloResp = await this.command(`EHLO ${this.config.name ?? 'nexomailer'}`);
    this.parseExtensions(ehloResp.message);

    // STARTTLS if not already secure
    if (!this.secure && this.extensions.has('STARTTLS')) {
      await this.command('STARTTLS');
      await this.upgradeToTLS();
      // Re-EHLO after TLS
      const reEhlo = await this.command(`EHLO ${this.config.name ?? 'nexomailer'}`);
      this.parseExtensions(reEhlo.message);
    }

    // AUTH
    if (this.config.auth) {
      await this.authenticate(this.config.auth);
    }

    this.connected = true;
    this.logger.info(`Connected to ${this.config.host}:${this.config.port}`, {
      secure: this.secure,
      extensions: Array.from(this.extensions.keys()),
    });
  }

  /** Send an email message */
  async send(envelope: Envelope, message: string): Promise<SMTPResponse> {
    if (!this.connected || !this.socket) {
      throw new SMTPConnectionError('Not connected', this.config.host, this.config.port);
    }

    // MAIL FROM
    await this.command(`MAIL FROM:<${envelope.from}>`);

    // RCPT TO (each recipient)
    for (const to of envelope.to) {
      await this.command(`RCPT TO:<${to}>`);
    }

    // DATA
    await this.command('DATA', SMTP_CODES.START_INPUT);

    // Send message body + terminator
    const body = message.replace(/\r?\n\.\r?\n/g, '\r\n..\r\n'); // dot-stuffing
    return this.command(`${body}\r\n.`);
  }

  /** Close connection gracefully */
  async close(): Promise<void> {
    if (!this.socket) return;
    try {
      await this.command('QUIT', SMTP_CODES.CLOSING);
    } catch {
      // ignore errors during close
    } finally {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
      this.logger.debug('Connection closed');
    }
  }

  /** Reset connection state for reuse */
  async reset(): Promise<void> {
    await this.command('RSET');
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ─── Private Methods ────────────────────────────────────

  private async command(cmd: string, expectedCode: number = SMTP_CODES.OK): Promise<SMTPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new SMTPConnectionError('Socket not available', this.config.host, this.config.port));
        return;
      }

      this.logger.debug(`C: ${cmd.startsWith('AUTH') ? 'AUTH ***' : cmd.substring(0, 100)}`);

      const onData = (chunk: Buffer) => {
        this.responseBuffer += chunk.toString();
        const lines = this.responseBuffer.split('\r\n');

        // Check if we have a complete response (last line has space after code)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (line.length >= 4 && line[3] === ' ') {
            this.socket?.removeListener('data', onData);
            this.responseBuffer = '';

            const code = parseInt(line.substring(0, 3), 10);
            const message = lines.filter(l => l.length > 0).map(l => l.substring(4)).join('\n');

            this.logger.debug(`S: ${code} ${message.substring(0, 100)}`);

            const response: SMTPResponse = { code, message };

            if (code === expectedCode || (expectedCode === SMTP_CODES.OK && code >= 200 && code < 300)) {
              resolve(response);
            } else {
              reject(new SMTPError(`Unexpected response: ${code} ${message}`, code, undefined, { command: cmd }));
            }
            return;
          }
        }
      };

      const timeout = setTimeout(() => {
        this.socket?.removeListener('data', onData);
        reject(new SMTPTimeoutError(cmd.split(' ')[0] ?? 'COMMAND', this.config.socketTimeout!));
      }, this.config.socketTimeout!);

      this.socket.on('data', onData);
      this.socket.write(`${cmd}\r\n`, () => {
        // Written
      });

      // Ensure timeout is cleared on response
      const origResolve = resolve;
      const origReject = reject;
      resolve = (v) => { clearTimeout(timeout); origResolve(v); };
      reject = (e) => { clearTimeout(timeout); origReject(e); };
    });
  }

  private waitForResponse(expectedCode: number, operation: string): Promise<SMTPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new SMTPConnectionError('Socket not available', this.config.host, this.config.port));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new SMTPTimeoutError(operation, this.config.connectionTimeout!));
      }, this.config.connectionTimeout!);

      const onData = (chunk: Buffer) => {
        const line = chunk.toString().trim();
        const code = parseInt(line.substring(0, 3), 10);
        if (!isNaN(code)) {
          clearTimeout(timeout);
          this.socket?.removeListener('data', onData);
          this.socket?.removeListener('error', onError);
          if (code === expectedCode) {
            resolve({ code, message: line.substring(4) });
          } else {
            reject(new SMTPError(`Expected ${expectedCode}, got ${code}: ${line}`, code));
          }
        }
      };

      const onError = (err: Error) => {
        clearTimeout(timeout);
        reject(new SMTPConnectionError(err.message, this.config.host, this.config.port));
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
    });
  }

  private async upgradeToTLS(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new SMTPConnectionError('No socket', this.config.host, this.config.port));
        return;
      }

      const tlsSocket = tls.connect({
        socket: this.socket as net.Socket,
        host: this.config.host,
        rejectUnauthorized: this.config.tls?.rejectUnauthorized ?? true,
        servername: this.config.tls?.servername ?? this.config.host,
      }, () => {
        this.socket = tlsSocket;
        this.secure = true;
        resolve();
      });

      tlsSocket.once('error', (err: Error) => {
        reject(new SMTPConnectionError(`TLS upgrade failed: ${err.message}`, this.config.host, this.config.port));
      });
    });
  }

  private async authenticate(auth: SMTPAuth): Promise<void> {
    if ('type' in auth && auth.type === 'oauth2') {
      // XOAUTH2
      const token = base64Encode(`user=${auth.user}\x01auth=Bearer ${auth.accessToken}\x01\x01`);
      await this.command(`AUTH XOAUTH2 ${token}`, SMTP_CODES.AUTH_SUCCESS);
    } else if ('pass' in auth) {
      // Try LOGIN first, then PLAIN
      try {
        const loginResp = await this.command('AUTH LOGIN', SMTP_CODES.AUTH_CONTINUE);
        if (loginResp.code === SMTP_CODES.AUTH_CONTINUE) {
          await this.command(base64Encode(auth.user), SMTP_CODES.AUTH_CONTINUE);
          await this.command(base64Encode(auth.pass), SMTP_CODES.AUTH_SUCCESS);
        }
      } catch {
        // Fallback to PLAIN
        const credentials = base64Encode(`\0${auth.user}\0${auth.pass}`);
        await this.command(`AUTH PLAIN ${credentials}`, SMTP_CODES.AUTH_SUCCESS);
      }
    } else {
      throw new SMTPAuthError('Unsupported auth type');
    }
  }

  private parseExtensions(ehloResponse: string): void {
    this.extensions.clear();
    const lines = ehloResponse.split('\n');
    for (const line of lines) {
      const trimmed = line.trim().toUpperCase();
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) {
        this.extensions.set(trimmed.substring(0, spaceIdx), trimmed.substring(spaceIdx + 1));
      } else if (trimmed.length > 0) {
        this.extensions.set(trimmed, '');
      }
    }
  }
}
