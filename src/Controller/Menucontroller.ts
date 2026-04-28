import { Context } from "elysia";
import { getDB } from "../lib/connect";
import { getRestaurantScope } from "../middleware/restaurantScope";
const db = getDB();
export const menucontroller = {
  getmenu: async (context: Context & { jwt?: any }) => {
    const { restaurantId } = await getRestaurantScope(context);
    const query = "SELECT * FROM menu_new WHERE restaurant_id=$1";
    const result = await db.query(query, [restaurantId]);
    const menu = result.rows.map((r: any) => {
      const base64 = r.image_blob
        ? Buffer.from(r.image_blob).toString("base64")
        : null;

      return {
        id: r.id,
        name: r.name,
        price: r.price,
        category: r.category,
        /* ถ้าไม่มีรูปให้ส่ง null เพื่อไม่พัง front-end */
        image: base64
          ? `data:${r.image_mime || "image/jpeg"};base64,${base64}`
          : null,
      };
    });
    return { menu: menu };
  },
};
