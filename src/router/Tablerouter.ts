import { Elysia } from "elysia";
import { Tablecontroller } from "../Controller/Tablescontroller";
import { rateLimit } from "elysia-rate-limit";
export const Tablerouter = (app: Elysia) => {
  return app.group("/tables", (app) => {
    const gettableLimit = new Elysia()
      .use(
        rateLimit({
          scoping: "scoped",
          duration: 60000, //60s
          max: 6,
          errorResponse: new Response(
            "มีการเรียกใช้งานมากเกินไป กรุณารอสักครู่",
            {
              status: 429,
              headers: new Headers({
                "Content-Type": "text/plain; charset=utf-8",
                "Retry-After": "60",
                "Custom-Header": "custom",
              }),
            }
          ),
        })
      )
      .get("/gettable", Tablecontroller.gettable);
    app
      .use(gettableLimit)
      .post("/opentable", Tablecontroller.opentable)
      .post("/closetable", Tablecontroller.closetable)
      .get("/checktable/:session", Tablecontroller.checktabel);
    return app;
  });
};
