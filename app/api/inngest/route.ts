import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Functions run inside Next, so revalidateTag works.
export const { GET, POST, PUT } = serve({ client: inngest, functions });

export const maxDuration = 300;
