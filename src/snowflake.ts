// Snowflake IDs: 42 bits of milliseconds since JOLT_EPOCH, 10 bits of worker id, 12 bits of sequence.
// They sort by creation time, which is what message pagination relies on.

export const JOLT_EPOCH = 1767225600000n; // 2026-01-01T00:00:00Z

const WORKER_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_WORKER = (1n << WORKER_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

export type Snowflake = string;

export function createSnowflakeGenerator(workerId = 0) {
  const worker = BigInt(workerId);
  if (worker < 0n || worker > MAX_WORKER) throw new RangeError(`workerId must be 0-${MAX_WORKER}`);

  let lastTime = -1n;
  let sequence = 0n;

  return function nextSnowflake(now: number = Date.now()): Snowflake {
    let time = BigInt(now);
    if (time <= lastTime) {
      time = lastTime;
      sequence = (sequence + 1n) & MAX_SEQUENCE;
      if (sequence === 0n) time = lastTime + 1n;
    } else {
      sequence = 0n;
    }
    lastTime = time;
    return (
      ((time - JOLT_EPOCH) << (WORKER_BITS + SEQUENCE_BITS)) |
      (worker << SEQUENCE_BITS) |
      sequence
    ).toString();
  };
}

export function snowflakeTime(id: Snowflake): number {
  return Number((BigInt(id) >> (WORKER_BITS + SEQUENCE_BITS)) + JOLT_EPOCH);
}

export function snowflakeFromTime(ms: number): Snowflake {
  return ((BigInt(ms) - JOLT_EPOCH) << (WORKER_BITS + SEQUENCE_BITS)).toString();
}

export function compareSnowflakes(a: Snowflake, b: Snowflake): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isSnowflake(value: string): boolean {
  return /^\d{1,20}$/.test(value);
}
