export function scheduleIdleTask(callback, timeout = 1200) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(callback, 120);
  return () => window.clearTimeout(id);
}
