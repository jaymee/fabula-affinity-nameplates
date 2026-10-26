export function displayObjectVisible(object) {
  if (!object || object.destroyed || !object.parent) return false;
  for (let current = object; current; current = current.parent) {
    if (current.visible === false || current.renderable === false || current.alpha === 0 || current.destroyed) return false;
  }
  return true;
}

export function tokenVisible(token, user = globalThis.game?.user) {
  return !!token && !token.destroyed && token.isVisible !== false &&
    !(token.document?.hidden && !user?.isGM) && displayObjectVisible(token);
}
