import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

let _runId: string | undefined = undefined;
export const setRunId = (runId: string) => {
  _runId = runId;
};

type RetryOptions = {
  delays?: number[];
  isRetriableError?: (...args: any[]) => boolean;
};

export const makeRequest = <T = any, D = any>(
  config: AxiosRequestConfig<D>,
  retryOptions?: RetryOptions
) => {
  return retryWithBackoff(
    (retryIndex: number) =>
      axios({
        baseURL: "http://localhost:1234/",
        headers: {
          "x-cypress-request-attempt": retryIndex,
          "x-cypress-run-id": _runId,
          ...config.headers,
        },
        ...config,
      }),
    retryOptions
  ) as Promise<AxiosResponse<T, D>>;
};

const DELAYS = [30 * 1000, 60 * 1000, 2 * 60 * 1000]; // 30s, 1min, 2min

const isRetriableError = (err: { response?: { status?: number } }) => {
  return (
    err?.response?.status &&
    500 <= err.response.status &&
    err.response.status < 600
  );
};

const retryWithBackoff = (fn: Function, retryOptions?: RetryOptions) => {
  let attempt: any;

  const options = {
    delays: DELAYS,
    isRetriableError: isRetriableError,
    ...retryOptions,
  };

  return (attempt = (retryIndex: number) => {
    return promiseTry(() => fn(retryIndex)).catch((err) => {
      if (!options.isRetriableError(err)) throw err;

      if (retryIndex > options.delays.length) {
        throw err;
      }

      const delay = options.delays[retryIndex];

      console.warn("API failed retrying", {
        delay,
        tries: options.delays.length - retryIndex,
        response: err,
      });

      retryIndex++;

      return promiseDelay(delay).then(() => {
        console.debug(`Retry #${retryIndex} after ${delay}ms`);

        return attempt(retryIndex);
      });
    });
  })(0);
};

const promiseTry = (fn: Function) => {
  return new Promise((resolve) => resolve(fn()));
};

const promiseDelay = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));
