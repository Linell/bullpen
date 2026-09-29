import { cron } from "inngest";

export const everyMinuteOfBaseballHours = cron("TZ=UTC * 15-23,0-7 * 2-11 *");
