import type { Context } from "elysia";
import { getDB } from "../lib/connect";
import {
  getJwtPayload,
  normalizeRestaurantId,
  requireRestaurantScope,
  requireRole,
} from "../middleware/restaurantScope";

const db = getDB();

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export const RestaurantController = {
  register: async (
    context: Context & {
      body: { name: string; slug?: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const payload = await getJwtPayload(context);
    if (!payload?.username) {
      set.status = 401;
      return { message: "Unauthorized: Please login" };
    }

    if (!body.name) {
      set.status = 400;
      return { message: "Restaurant name is required" };
    }

    const slug = toSlug(body.slug || body.name);
    if (!slug) {
      set.status = 400;
      return { message: "Restaurant slug is required" };
    }

    try {
      const userResult = await db.query("SELECT id FROM users WHERE username=$1", [
        payload.username,
      ]);
      if (userResult.rowCount === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      await db.query("BEGIN");
      const restaurant = await db.query(
        `INSERT INTO restaurants (name, slug, owner_id, status, plan)
         VALUES ($1, $2, $3, 'pending', 'free')
         RETURNING *`,
        [body.name, slug, userResult.rows[0].id],
      );
      await db.query(
        "UPDATE users SET restaurant_id=$1, role='owner' WHERE id=$2",
        [restaurant.rows[0].id, userResult.rows[0].id],
      );
      await db.query("COMMIT");

      set.status = 201;
      return { restaurant: restaurant.rows[0] };
    } catch (error) {
      await db.query("ROLLBACK");
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  me: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRestaurantScope(context);
    if (!scope.ok) return scope.response;

    const result = await db.query("SELECT * FROM restaurants WHERE id=$1", [
      scope.restaurantId,
    ]);
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    return { restaurant: result.rows[0] };
  },

  updateMe: async (
    context: Context & {
      body: { name?: string; slug?: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["owner", "admin", "superadmin"]);
    if (!scope.ok) return scope.response;

    const name = body.name?.trim();
    const slug = body.slug ? toSlug(body.slug) : undefined;
    if (!name && !slug) {
      set.status = 400;
      return { message: "No changes provided" };
    }

    const result = await db.query(
      `UPDATE restaurants
          SET name = COALESCE($1, name),
              slug = COALESCE($2, slug),
              updated_at = NOW()
        WHERE id=$3
        RETURNING *`,
      [name || null, slug || null, scope.restaurantId],
    );

    return { restaurant: result.rows[0] };
  },

  list: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const result = await db.query("SELECT * FROM restaurants ORDER BY created_at DESC");
    return { restaurants: result.rows };
  },

  setStatus: async (
    context: Context & {
      params: { id: string; status: string };
      jwt?: any;
    },
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const status = params.status;
    if (!["active", "suspended", "inactive", "deleted"].includes(status)) {
      set.status = 400;
      return { message: "Invalid restaurant status" };
    }

    const result = await db.query(
      "UPDATE restaurants SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, normalizeRestaurantId(params.id)],
    );
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    return { restaurant: result.rows[0] };
  },
};
