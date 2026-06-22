export type ClientDiagnostic = {
  id: string;
  title: string;
  message: string;
  source: "API" | "Browser" | "Network" | "Promise" | "React" | "Server";
  timestamp: string;
  url: string;
  code?: string;
  stack?: string;
  context?: unknown;
  causes?: unknown[];
};

export function formatDiagnostic(diagnostic: ClientDiagnostic) {
  const lines = [
    `${diagnostic.source.toUpperCase()} ERROR: ${diagnostic.title}`,
    `Message: ${diagnostic.message}`,
    `Error ID: ${diagnostic.id}`,
    `Time: ${diagnostic.timestamp}`,
    `Page: ${diagnostic.url}`,
  ];

  if (diagnostic.code) lines.push(`Code: ${diagnostic.code}`);
  if (diagnostic.context !== undefined) {
    lines.push(`Context:\n${JSON.stringify(diagnostic.context, null, 2)}`);
  }
  if (diagnostic.causes?.length) {
    lines.push(`Cause chain:\n${JSON.stringify(diagnostic.causes, null, 2)}`);
  }
  if (diagnostic.stack) lines.push(`Stack trace:\n${diagnostic.stack}`);

  return lines.join("\n\n");
}

export function emitDiagnostic(diagnostic: ClientDiagnostic) {
  console.error(formatDiagnostic(diagnostic));
}
