export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function timeSeconds() {
  return Math.floor(Date.now() / 1000);
}
