import { Elysia, t } from "elysia";
import { RestaurantController } from "../Controller/RestaurantController";

export const RestaurantRouter = (app: Elysia) => {
  return app.group("/restaurant", (app) => {
    app
      .post("/register", RestaurantController.register, {
        body: t.Object({
          name: t.String(),
          slug: t.Optional(t.String()),
        }),
      })
      .get("/me", RestaurantController.me)
      .put("/me", RestaurantController.updateMe, {
        body: t.Object({
          name: t.Optional(t.String()),
          slug: t.Optional(t.String()),
        }),
      })
      .get("/all", RestaurantController.list)
      .post("/:id/status/:status", RestaurantController.setStatus);

    return app;
  });
};
