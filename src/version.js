const KEY = 'hot-gates-graphics';

function read() {
  const value = Number(localStorage.getItem(KEY));
  return value >= 1 && value <= 4 ? value : 4;
}

let current = read();
const listeners = new Set();

export function getGraphicsVersion() {
  return current;
}

export function setGraphicsVersion(version) {
  const next = Number(version);
  if (next !== 1 && next !== 2 && next !== 3 && next !== 4) return current;
  if (next === current) return current;
  current = next;
  localStorage.setItem(KEY, String(next));
  listeners.forEach((listener) => listener(next));
  return current;
}

export function onGraphicsVersion(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
