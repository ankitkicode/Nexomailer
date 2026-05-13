import type { Address, Attachment } from '@nexomailer/shared';
import { generateBoundary, formatAddress, MIME_TYPES } from '@nexomailer/shared';

/**
 * MIME message builder.
 * Constructs RFC 2045-compliant email messages with multipart support.
 */
export class MIMEBuilder {
  private from: Address | null = null;
  private to: Address[] = [];
  private cc: Address[] = [];
  private replyTo: Address | null = null;
  private subject = '';
  private html: string | null = null;
  private text: string | null = null;
  private attachments: Attachment[] = [];
  private customHeaders: Record<string, string> = {};
  private messageId: string | null = null;

  setFrom(from: Address): this {
    this.from = from;
    return this;
  }

  setTo(to: Address[]): this {
    this.to = to;
    return this;
  }

  setCc(cc: Address[]): this {
    this.cc = cc;
    return this;
  }

  setReplyTo(replyTo: Address): this {
    this.replyTo = replyTo;
    return this;
  }

  setSubject(subject: string): this {
    this.subject = subject;
    return this;
  }

  setHtml(html: string): this {
    this.html = html;
    return this;
  }

  setText(text: string): this {
    this.text = text;
    return this;
  }

  addAttachment(attachment: Attachment): this {
    this.attachments.push(attachment);
    return this;
  }

  setHeader(key: string, value: string): this {
    this.customHeaders[key] = value;
    return this;
  }

  setMessageId(id: string): this {
    this.messageId = id;
    return this;
  }

  /** Build the complete MIME message as a string */
  build(): string {
    const lines: string[] = [];

    // Headers
    if (this.from) lines.push(`From: ${formatAddress(this.from)}`);
    if (this.to.length > 0) lines.push(`To: ${this.to.map(formatAddress).join(', ')}`);
    if (this.cc.length > 0) lines.push(`Cc: ${this.cc.map(formatAddress).join(', ')}`);
    if (this.replyTo) lines.push(`Reply-To: ${formatAddress(this.replyTo)}`);
    lines.push(`Subject: ${this.encodeSubject(this.subject)}`);
    if (this.messageId) lines.push(`Message-ID: <${this.messageId}>`);
    lines.push(`Date: ${new Date().toUTCString()}`);
    lines.push('MIME-Version: 1.0');
    lines.push('X-Mailer: NexoMailer/0.1.0');

    // Custom headers
    for (const [key, value] of Object.entries(this.customHeaders)) {
      lines.push(`${key}: ${value}`);
    }

    const hasAttachments = this.attachments.length > 0;
    const hasHtml = this.html !== null;
    const hasText = this.text !== null;
    const hasBoth = hasHtml && hasText;

    if (hasAttachments) {
      const mixedBoundary = generateBoundary();
      lines.push(`Content-Type: ${MIME_TYPES.MIXED}; boundary="${mixedBoundary}"`);
      lines.push('');

      // Body part
      lines.push(`--${mixedBoundary}`);
      if (hasBoth) {
        const altBoundary = generateBoundary();
        lines.push(`Content-Type: ${MIME_TYPES.ALTERNATIVE}; boundary="${altBoundary}"`);
        lines.push('');
        lines.push(`--${altBoundary}`);
        lines.push(...this.textPart(this.text!));
        lines.push(`--${altBoundary}`);
        lines.push(...this.htmlPart(this.html!));
        lines.push(`--${altBoundary}--`);
      } else if (hasHtml) {
        lines.push(...this.htmlPart(this.html!));
      } else if (hasText) {
        lines.push(...this.textPart(this.text!));
      }

      // Attachments
      for (const att of this.attachments) {
        lines.push(`--${mixedBoundary}`);
        lines.push(...this.attachmentPart(att));
      }
      lines.push(`--${mixedBoundary}--`);
    } else if (hasBoth) {
      const altBoundary = generateBoundary();
      lines.push(`Content-Type: ${MIME_TYPES.ALTERNATIVE}; boundary="${altBoundary}"`);
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push(...this.textPart(this.text!));
      lines.push(`--${altBoundary}`);
      lines.push(...this.htmlPart(this.html!));
      lines.push(`--${altBoundary}--`);
    } else if (hasHtml) {
      lines.push(`Content-Type: ${MIME_TYPES.HTML}; charset=utf-8`);
      lines.push('Content-Transfer-Encoding: quoted-printable');
      lines.push('');
      lines.push(this.html!);
    } else if (hasText) {
      lines.push(`Content-Type: ${MIME_TYPES.PLAIN}; charset=utf-8`);
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(this.text!);
    }

    return lines.join('\r\n');
  }

  private textPart(text: string): string[] {
    return [
      `Content-Type: ${MIME_TYPES.PLAIN}; charset=utf-8`,
      'Content-Transfer-Encoding: 7bit',
      '',
      text,
    ];
  }

  private htmlPart(html: string): string[] {
    return [
      `Content-Type: ${MIME_TYPES.HTML}; charset=utf-8`,
      'Content-Transfer-Encoding: quoted-printable',
      '',
      html,
    ];
  }

  private attachmentPart(att: Attachment): string[] {
    const contentType = att.contentType ?? MIME_TYPES.OCTET_STREAM;
    const content = typeof att.content === 'string'
      ? att.content
      : att.content.toString('base64');
    const disposition = att.cid ? 'inline' : 'attachment';

    const parts = [
      `Content-Type: ${contentType}; name="${att.filename}"`,
      `Content-Disposition: ${disposition}; filename="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
    ];

    if (att.cid) parts.push(`Content-ID: <${att.cid}>`);
    parts.push('', content);
    return parts;
  }

  private encodeSubject(subject: string): string {
    // RFC 2047 encoding for non-ASCII subjects
    if (/^[\x20-\x7E]*$/.test(subject)) return subject;
    return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  }
}
