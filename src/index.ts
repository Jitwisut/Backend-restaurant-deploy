import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { Auths } from "./router/Auth";
import { Adminrouter } from "./router/Adminrouter";
import { Tablerouter } from "./router/Tablerouter";
import { middlewareadmin } from "./router/middlewarerouter";
import { menurouter } from "./router/menurouter";
import { web } from "./router/websocket";
import { profilerouter } from "./router/Profilerouter";
import { elysiaHelmet } from "elysiajs-helmet";
const port = Number(process.env.PORT) || 8000;
const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(elysiaHelmet({}))
  .use(
    jwt({
      name: "jwt",
      secret: "kormadi",
    })
  )
  .use(
    cors({
      /* ★ ดึง Origin ที่ลูกค้าส่งมาแล้วสะท้อนกลับเลย */
      origin: ({ request }: any) => request.headers.get("origin") ?? "",

      /* ★ เปิด cookie / auth header ได้ */
      credentials: true,

      /* ★ ไม่ต้องเดา header / method ให้มันได้หมด */
      methods: ["*"],
      allowedHeaders: ["*"],
    })
  )

  .options("/*", () => new Response(null, { status: 204 }))
  .use(profilerouter)
  .use(middlewareadmin)
  .use(Tablerouter)
  .use(Adminrouter)
  .use(Auths)
  .use(menurouter)
  .use(web)
  .listen({
    port: port,
    //    hostname: "0.0.0.0"
  });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
