import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import { getChatHistory, sendChatMessage } from "../chatController";

export function chatRoutes(router: Router) {
  /** GET /api/v1/chats/history?userId=...&noteId=... */
  router.get("/chats/history", requireAuth, getChatHistory);

  /** POST /api/v1/chats */
  router.post("/chats", requireAuth, sendChatMessage);

  return router;
}
