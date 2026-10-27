// One JSON object per line, read as the lines arrive (2026-10-27: the table
// render sends each picture the moment it is made, so the front view shows
// after about a minute instead of all three after three).

/** Calls onLine with each parsed line of the stream, in order; blank lines are skipped. */
export async function readNdjson(body: ReadableStream<Uint8Array>, onLine: (line: unknown) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  const flush = (text: string) => { if (text.trim()) onLine(JSON.parse(text)); };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += decoder.decode(value, { stream: true });
    const lines = rest.split("\n");
    rest = lines.pop() ?? "";
    lines.forEach(flush);
  }
  flush(rest + decoder.decode());
}

export const ndjsonLine = (o: unknown) => new TextEncoder().encode(`${JSON.stringify(o)}\n`);
