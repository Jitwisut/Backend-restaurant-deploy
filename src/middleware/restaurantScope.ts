import type { Context } from "elysia";

export type RestaurantRole = "owner" | "admin" | "staff" | "user" | "kitchen" | "superadmin";

export type RestaurantJwtPayload = {
  username?: string;
  email?: string;
  role?: RestaurantRole;
  restaurant_id?: number | string;
  restaurantId?: number | string;
  iat?: number;
  exp?: number;
};

const DEFAULT_RESTAURANT_ID = Number(Bun.env.DEFAULT_RESTAURANT_ID || 1);

export function normalizeRestaurantId(value: unknown) {
  const restaurantId = Number(value ?? DEFAULT_RESTAURANT_ID);
  return Number.isFinite(restaurantId) && restaurantId > 0
    ? restaurantId
    : DEFAULT_RESTAURANT_ID;
}

export async function getJwtPayload(context: Context & { jwt?: any }) {
  const authHeader = context.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token || !context.jwt) return null;

  const payload = await context.jwt.verify(token);
  return payload ? (payload as RestaurantJwtPayload) : null;
}

export async function getRestaurantScope(context: Context & { jwt?: any }) {
  const payload = await getJwtPayload(context);
  return {
    payload,
    restaurantId: normalizeRestaurantId(
      payload?.restaurant_id ?? payload?.restaurantId,
    ),
  };
}

export async function requireRestaurantScope(context: Context & { jwt?: any }) {
  const scope = await getRestaurantScope(context);

  if (!scope.payload) {
    context.set.status = 401;
    return {
      ok: false as const,
      response: { message: "Unauthorized: Please login" },
    };
  }

  return { ok: true as const, ...scope };
}

export async function requireRole(
  context: Context & { jwt?: any },
  allowedRoles: RestaurantRole[],
) {
  const scope = await requireRestaurantScope(context);
  if (!scope.ok) return scope;

  if (!scope.payload.role || !allowedRoles.includes(scope.payload.role)) {
    context.set.status = 403;
    return {
      ok: false as const,
      response: { message: "Forbidden: You do not have permission" },
    };
  }

  return scope;
}
