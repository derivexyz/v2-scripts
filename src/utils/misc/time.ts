export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function timeSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function prettifySeconds(seconds: number): string {
  const units: any = {
    "year": 24*60*60*365,
    "month": 24*60*60*30,
    "day": 24*60*60,
    "hr": 60*60,
    "min": 60,
    "sec": 1
  }

  let result = '';

  for(let name in units) {
    let div = units[name];
    if (seconds >= div) {
      let amount = Math.floor(seconds / div);
      result += amount + ' ' + name + (amount > 1 ? 's' : '') + ' ';
      seconds %= div;
    }
  }

  return result.trim();
}