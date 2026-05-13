import { http, HttpResponse } from "msw";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const infinitePayCheckoutSuccessHandler = http.post(
  "https://api.infinitepay.io/invoices/public/checkout/links",
  async () => HttpResponse.json({ url: "https://pay.infinitepay.io/test" }),
);

export function googleAppsScriptHandler(url: string, response: JsonValue) {
  return http.get(url, async () => HttpResponse.json(response));
}
