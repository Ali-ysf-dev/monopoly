import { handleRequest } from "../server/web.js";

export function POST(request) {
  return handleRequest(request, "act");
}
