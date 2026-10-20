import { handleRequest } from "../server/web.js";

export function GET(request) {
  return handleRequest(request, "session");
}
