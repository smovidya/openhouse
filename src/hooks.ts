import type { Transport } from "@sveltejs/kit/hooks";
import { Err, Ok, err, ok } from "neverthrow";

export const transport = {
  NeverthrowOk: {
    encode: (value: unknown) => value instanceof Ok && [value.value],
    decode: ([value]: [unknown]) => ok(value),
  },
  NeverthrowErr: {
    encode: (value: unknown) => value instanceof Err && [value.error],
    decode: ([error]: [unknown]) => err(error),
  },
} satisfies Transport;
