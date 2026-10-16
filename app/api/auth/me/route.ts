import { currentUser, serverError } from "../../../../lib/server";
import { userWithConsents } from "../../../../lib/consents";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    return Response.json({ user: user ? await userWithConsents(user) : null }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return serverError(error);
  }
}
