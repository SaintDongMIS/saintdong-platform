/**
 * COMMEET sync 單次執行摘要 log（供通知信 txt 附件）
 */
export class CommeetSyncRunLogCollector {
  private readonly lines: string[] = [];
  private readonly startedAt = new Date();

  append(message: string, context?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const ctx =
      context && Object.keys(context).length > 0
        ? ` | ${JSON.stringify(context)}`
        : '';
    this.lines.push(`[${ts}] ${message}${ctx}`);
  }

  getAttachmentFilename(): string {
    const stamp = this.startedAt
      .toISOString()
      .slice(0, 19)
      .replace(/T/g, '_')
      .replace(/:/g, '-');
    return `COMMEET_SYNC-${stamp}.txt`;
  }

  toAttachmentContent(): string {
    const header = [
      'COMMEET 同步執行摘要',
      `開始時間: ${this.startedAt.toISOString()}`,
      `結束時間: ${new Date().toISOString()}`,
      '---',
      '',
    ].join('\n');
    return header + this.lines.join('\n') + '\n';
  }
}
