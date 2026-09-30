import { cron } from "inngest";

// Every minute, 15:00–07:59 UTC (US game hours), Feb–Nov.
export const everyMinuteOfBaseballHours = cron("TZ=UTC * 15-23,0-7 * 2-11 *");
