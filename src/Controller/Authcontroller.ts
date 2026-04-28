import bcryptjs from "bcryptjs";
import { getDB } from "../lib/connect";
import { SigninHandler } from "../type/type";
import { normalizeRestaurantId } from "../middleware/restaurantScope";
const db = getDB();

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function ensureDefaultRestaurant() {
  const defaultId = normalizeRestaurantId(Bun.env.DEFAULT_RESTAURANT_ID);

  await db.query(
    `INSERT INTO restaurants (id, name, slug, status, plan)
     VALUES ($1, 'Default Restaurant', 'default', 'active', 'free')
     ON CONFLICT (id) DO NOTHING`,
    [defaultId],
  );

  return defaultId;
}

export const Authcontroller = {
  signin: async ({ body, set, jwt }: SigninHandler) => {
    const { username, password } = body;

    if (!username || !password) {
      set.status = 400;
      return { message: "Error: Please complete all input fields" };
    }

    try {
      const result = await db.query(
        `SELECT u.*, r.status AS restaurant_status
           FROM users u
           LEFT JOIN restaurants r ON r.id = u.restaurant_id
          WHERE u.username = $1`,
        [username],
      );

      if (result.rows.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }
      const user = result.rows[0];
      const restaurantId = normalizeRestaurantId(user.restaurant_id);

      if (
        user.restaurant_status &&
        user.restaurant_status !== "active" &&
        user.restaurant_status !== "pending" &&
        user.role !== "superadmin"
      ) {
        set.status = 403;
        return { message: "Restaurant is not active" };
      }

      if (!user.password) {
        return { message: "Invalid credentials" };
      }
      const isMatch = await bcryptjs.compare(
        String(password),
        String(user.password),
      );
      if (!isMatch) {
        set.status = 400;
        return { message: "Error: Invalid password" };
      }

      const now = Math.floor(Date.now() / 1000);

      const payload = {
        username: user.username,
        email: user.email,
        role: user.role,
        restaurant_id: restaurantId,
        iat: now,
      };

      const payloadRefresh = {
        ...payload,
        exp: now + 7 * 24 * 60 * 60,
      };

      const token = await jwt.sign(payload);
      const refreshToken = await jwt.sign(payloadRefresh);

      let redirectpath;
      if (
        user.restaurant_status === "pending" &&
        (user.role === "admin" || user.role === "owner")
      ) {
        redirectpath = "/restaurant/pending";
      } else if (user.role === "admin" || user.role === "owner" || user.role === "superadmin") {
        redirectpath = "/";
      } else if (user.role === "kitchen") {
        redirectpath = "/kitchen";
      } else if (user.role === "user" || user.role === "staff") {
        redirectpath = "/wellcome";
      }

      return {
        message: "Success: You have logged in",
        token,
        refreshToken,
        redirectpath,
      };
    } catch (error) {
      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },

  signup: async ({
    body,
    set,
  }: {
    body: {
      username: string;
      email: string;
      password: string;
      role: "admin" | "user" | "kitchen" | "owner" | "staff" | "superadmin";
      restaurant_name?: string;
      restaurant_slug?: string;
    };
    set: any;
  }) => {
    const { username, email, password, role } = body;
    //("username", username);
    if (!username || !email || !password || !role) {
      set.status = 400;
      return { message: "Error: Please complete all fields" };
    }

    try {
      const existing = await db.query(
        "SELECT * FROM users WHERE username = $1 OR email = $2",
        [username, email],
      );

      // ถ้ามีข้อมูลแล้ว
      if (existing.rows.length > 0) {
        set.status = 409; // Conflict
        return { message: "Error: Username or Email already exists" };
      }

      const hashedPassword = await bcryptjs.hash(password, 10);
      let restaurantId = await ensureDefaultRestaurant();

      if (role === "admin" || role === "owner") {
        const restaurantName = body.restaurant_name?.trim() || `${username}'s Restaurant`;
        const baseSlug = toSlug(body.restaurant_slug || restaurantName || username) || `restaurant-${Date.now()}`;
        const restaurant = await db.query(
          `INSERT INTO restaurants (name, slug, status, plan)
           VALUES ($1, $2, 'pending', 'free')
           RETURNING id`,
          [restaurantName, baseSlug],
        );
        restaurantId = restaurant.rows[0].id;
      }

      await db.query(
        "INSERT INTO users (username, email, password, role, restaurant_id) VALUES ($1, $2,$3,$4,$5)",
        [username, email, hashedPassword, role, restaurantId],
      );

      set.status = 201;
      return { message: "Success: User registered successfully" };
    } catch (error) {
      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },
  test: async ({ set, body }: { set: any; body: { password: string } }) => {
    const hashedPassword = await bcryptjs.hash(body.password, 10);
    return {
      hash: hashedPassword,
      default: body.password,
    };
  },
};
