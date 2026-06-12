import { handlers } from "@/lib/auth";

async function wrappedHandler(
  req: Request,
  handler: (req: Request) => Promise<Response>
): Promise<Response> {
  try {
    return await handler(req);
  } catch (e) {
    console.error("Auth handler error:", e);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export const GET = (req: Request) => wrappedHandler(req, handlers.GET as any);
export const POST = (req: Request) => wrappedHandler(req, handlers.POST as any);
