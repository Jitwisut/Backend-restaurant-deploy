import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { elysiaHelmet } from "elysiajs-helmet";

/* routers ของคุณ */
import { Auths } from "./router/Auth";
import { Adminrouter } from "./router/Adminrouter";
import { Tablerouter } from "./router/Tablerouter";
import { middlewareadmin } from "./router/middlewarerouter";
import { menurouter } from "./router/menurouter";
import { web } from "./router/websocket";
import { profilerouter } from "./router/Profilerouter";

const port = Number(process.env.PORT) || 8000;

const app = new Elysia()

  /* ① CORS ต้องมาก่อนทุกอย่าง  */
  .use(
    cors({
      origin: ({ request }: any) => request.headers.get("origin") ?? "",
      credentials: true,
      methods: ["*"],
      allowedHeaders: ["*"],
    })
  )

  /* ③ ปลั๊กอินอื่น ๆ ต่อจากนี้ */
  .use(elysiaHelmet({}))
  .use(
    jwt({
      name: "jwt",
      secret: "kormadi",
    })
  )

  /* ④ เส้นทางจริง */
  .get("/", () => "Hello Elysia")
  .use(profilerouter)
  .use(middlewareadmin)
  .use(Tablerouter)
  .use(Adminrouter)
  .use(Auths)
  .use(menurouter)
  .use(web)

  .listen({ port, hostname: "0.0.0.0" });

console.log(`🦊  Elysia is running at 0.0.0.0:${port}`);
