import { Auth, setEnvDefaults } from "@auth/core";
import { config } from "@/lib/auth-config";

setEnvDefaults(process.env, config, true);

export const GET = async (req: Request) => {
  try {
    return await Auth(req, config);
  } catch (e) {
    console.error("Auth handler error:", e);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};

export const POST = GET;