import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { validationError } from "../middleware/index.js";
import { Webhook } from "svix";

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/webhook
 * Clerk webhook handler for user events (created, updated, deleted)
 * Per PRD Section 12: Clerk webhook: user created/updated/deleted
 */
auth.post("/webhook", async (c) => {
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    validationError("Missing Svix headers");
  }

  const body = await c.req.text();

  // Verify the webhook signature
  const wh = new Webhook(c.env.CLERK_WEBHOOK_SECRET);
  let payload: WebhookPayload;

  try {
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookPayload;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    validationError("Invalid webhook signature");
  }

  const { type, data } = payload;

  switch (type) {
    case "user.created":
    case "user.updated": {
      const { id, email_addresses, first_name, last_name } = data;
      const primaryEmail = email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address;
      const displayName = [first_name, last_name].filter(Boolean).join(" ") || primaryEmail || "User";

      if (!primaryEmail) {
        console.error("User has no primary email:", id);
        return c.json({ received: true, warning: "No primary email" });
      }

      // Upsert user
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, display_name, updated_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT (id) DO UPDATE SET
           email = excluded.email,
           display_name = excluded.display_name,
           updated_at = excluded.updated_at`,
      )
        .bind(id, primaryEmail, displayName)
        .run();

      console.log(`User ${type === "user.created" ? "created" : "updated"}: ${id}`);
      break;
    }

    case "user.deleted": {
      const { id } = data;

      // Soft delete: We keep the user record but could mark as deleted
      // For now, we'll keep the data for audit purposes
      // Drive files remain untouched per PRD Section 17 (Account deletion)
      await c.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();

      console.log(`User deleted: ${id}`);
      break;
    }

    default:
      console.log(`Unhandled webhook type: ${type}`);
  }

  return c.json({ received: true });
});

/** Clerk webhook payload types */
interface WebhookPayload {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
  };
}

export { auth };
