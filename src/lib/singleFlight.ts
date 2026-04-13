export function createSingleFlightRunner() {
  const inFlight = new Set<string>();

  const isRunning = (key: string) => inFlight.has(key);

  const run = async <T>(key: string, task: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.has(key)) {
      return undefined;
    }

    inFlight.add(key);
    try {
      return await task();
    } finally {
      inFlight.delete(key);
    }
  };

  return { run, isRunning };
}
