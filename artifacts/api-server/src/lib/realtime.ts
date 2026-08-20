import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Message, Notification } from "@workspace/api-zod";
import { resolveSession } from "./auth";
import { logger } from "./logger";

/** Everything the mobile app can be told about without polling. */
export type RealtimeEvent =
  | { type: "message.created"; conversationId: string; message: Message }
  | { type: "message.read"; conversationId: string; readerId: string }
  | { type: "conversation.updated"; conversationId: string }
  | { type: "notification.created"; notification: Notification }
  | { type: "appointment.updated"; appointmentId: string };

/** userId → open sockets. A person may be signed in on several devices. */
const connections = new Map<string, Set<WebSocket>>();

const HEARTBEAT_INTERVAL_MS = 30_000;

function register(userId: string, socket: WebSocket): void {
  const sockets = connections.get(userId) ?? new Set<WebSocket>();
  sockets.add(socket);
  connections.set(userId, sockets);
}

function unregister(userId: string, socket: WebSocket): void {
  const sockets = connections.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) connections.delete(userId);
}

/** Push an event to every device the user has open. No-op when offline. */
export function publishToUser(userId: string, event: RealtimeEvent): void {
  const sockets = connections.get(userId);
  if (!sockets?.size) return;

  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

/**
 * Chat and notifications ride a WebSocket at `/api/ws`. React Native cannot set
 * headers on a WebSocket handshake, so the session token arrives as a query
 * parameter and is verified here before the upgrade is accepted.
 */
export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/ws") {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    resolveSession(token)
      .then((auth) => {
        if (!auth) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          const userId = auth.user.id;
          register(userId, ws);
          ws.send(JSON.stringify({ type: "ready" }));

          ws.on("pong", () => {
            (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
          });
          ws.on("close", () => unregister(userId, ws));
          ws.on("error", (err) => {
            logger.warn({ err, userId }, "Realtime socket error");
            unregister(userId, ws);
          });
        });
      })
      .catch((err: unknown) => {
        logger.error({ err }, "Realtime upgrade failed");
        socket.destroy();
      });
  });

  // Drop sockets that stopped answering so the registry cannot leak.
  const heartbeat = setInterval(() => {
    for (const sockets of connections.values()) {
      for (const socket of sockets) {
        const tracked = socket as WebSocket & { isAlive?: boolean };
        if (tracked.isAlive === false) {
          socket.terminate();
          continue;
        }
        tracked.isAlive = false;
        socket.ping();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  heartbeat.unref();
}
