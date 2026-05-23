import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { HumanMessage } from "@langchain/core/messages";
import { chatGraphApp } from "@/app/pipeline/qa-overdoc";

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io has not been initialized");
  }
  return io;
}

export function initSocketIO(httpServer: HttpServer, frontendUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendUrl,
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Authenticate via handshake — token expected in socket.handshake.auth.token
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      console.warn(`[WebSocket] No token provided for socket ${socket.id}, disconnecting.`);
      socket.disconnect();
      return;
    }

    socket.on("chat:message", async (data: { noteId?: string; message: string }) => {
      const { message, noteId } = data;

      if (!message || typeof message !== "string") {
        socket.emit("chat:error", { error: "Invalid message format" });
        return;
      }

      console.log(`[WebSocket] chat:message from ${socket.id} for note ${noteId}: "${message}"`);

      try {
        // Signal start of streaming
        socket.emit("chat:start", { noteId });

        // Invoke the LangGraph chat pipeline
        const result = await chatGraphApp.invoke({
          messages: [new HumanMessage({ content: message })],
          noteId: noteId ?? "",
          userId: "",
        });

        const allMessages = result.messages ?? [];
        const lastAIMessage = allMessages
          .filter((m: { _getType?: () => string }) => m._getType?.() === "ai")
          .pop();
        const answer = typeof lastAIMessage?.content === "string"
          ? lastAIMessage.content
          : "I was unable to generate a response.";

        // Emit the full answer
        socket.emit("chat:response", {
          noteId,
          message: answer,
        });

        socket.emit("chat:done", { noteId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error(`[WebSocket] Pipeline error for socket ${socket.id}:`, error);
        socket.emit("chat:error", { error: errorMessage });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
