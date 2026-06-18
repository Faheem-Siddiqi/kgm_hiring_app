type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function getAssessmentFullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument;

  return (
    document.fullscreenElement ??
    fullscreenDocument.webkitFullscreenElement ??
    null
  );
}

export async function enterAssessmentFullscreen() {
  const root = document.documentElement as FullscreenElement;

  if (getAssessmentFullscreenElement()) {
    return true;
  }

  const requestFullscreen =
    root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);

  if (!requestFullscreen) {
    return false;
  }

  try {
    await requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitAssessmentFullscreen() {
  const fullscreenDocument = document as FullscreenDocument;

  if (!getAssessmentFullscreenElement()) {
    return;
  }

  const exitFullscreen =
    document.exitFullscreen?.bind(document) ??
    fullscreenDocument.webkitExitFullscreen?.bind(fullscreenDocument);

  try {
    await exitFullscreen?.();
  } catch {
    // Navigation away should still proceed if the browser refuses to exit.
  }
}
