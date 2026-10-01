import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/payment-demo/$bookingId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const parsed = z.string().uuid().safeParse(params.bookingId);
        if (!parsed.success) {
          return Response.redirect(new URL("/payment-demo/invalid", request.url), 303);
        }
        const { recordDemoDepositPayment } = await import("@/lib/nook/payment-demo.server");
        await recordDemoDepositPayment(parsed.data);
        // Mobile mail apps and Safari may reuse a cached redirect, skipping the payment step.
        return new Response(null, {
          status: 303,
          headers: {
            Location: new URL(`/payment-demo/${parsed.data}`, request.url).toString(),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
