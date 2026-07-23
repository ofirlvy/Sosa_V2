/**
 * Concurrency limiter. Returns a `run(task)` that queues thunks so at most `max`
 * run at once. Used to throttle media compression/upload/decoding so dropping
 * many files doesn't stampede the main thread and stall the previews.
 *
 * Lives in its own module (rather than fileService) so that videoPoster can use
 * it without creating an import cycle — fileService imports videoPoster.
 */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const pump = () => {
    while (active < max && queue.length) { active++; queue.shift()!(); }
  };
  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task().then(resolve, reject).finally(() => { active--; pump(); });
      });
      pump();
    });
  };
}
