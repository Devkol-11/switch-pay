export type Result<T, E = Error> =
  { success: true; value: T } | { success: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ success: true, value });
export const Err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});
