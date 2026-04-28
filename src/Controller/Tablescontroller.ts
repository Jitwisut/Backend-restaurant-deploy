import { Context } from "elysia";
import QRCode from "qrcode";
import { getDB } from "../lib/connect";
import { randomUUID } from "crypto";
import { requireRole } from "../middleware/restaurantScope";

const baseurl = Bun.env.ORIGIN_URL;
const db = getDB();

export const Tablecontroller = {
  gettable: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "kitchen",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const result =
      scope.payload.role === "superadmin"
        ? await db.query("SELECT * FROM tables")
        : await db.query("SELECT * FROM tables WHERE restaurant_id=$1", [
            scope.restaurantId,
          ]);
    set.status = 200;

    return { tables: result.rows };
  },

  opentable: async (context: any) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "staff", "superadmin"]);
    if (!scope.ok) return scope.response;

    await db.query("BEGIN");
    const rawNumber = body.number;
    const tableNumber = parseInt(rawNumber ?? "", 10);
    const hash = randomUUID();

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      await db.query("ROLLBACK");
      set.status = 400;
      return { message: "Invalid table number" };
    }

    const qrPath = `/order/${hash}`;
    const fullURL = `${baseurl}${qrPath}`;

    try {
      const qrBase64 = await QRCode.toDataURL(fullURL);
      await db.query(
        "INSERT INTO sessions (session_id,table_number,opened_at,restaurant_id) VALUES ($1,$2,NOW(),$3)",
        [hash, tableNumber, scope.restaurantId],
      );
      const result = await db.query(
        `UPDATE tables
            SET status = 'open',
                opened_at = NOW(),
                customer_session = $1,
                qr_code_url = $2
          WHERE table_number = $3
            AND restaurant_id = $4
            AND status = 'available'
          RETURNING table_number, status, opened_at, customer_session, qr_code_url`,
        [hash, qrBase64, tableNumber, scope.restaurantId],
      );

      if (result.rowCount === 0) {
        await db.query("ROLLBACK");
        set.status = 409;
        return { message: "Table is already open or not found" };
      }

      await db.query("COMMIT");
      return {
        message: "Open table success",
        table_number: tableNumber,
        session_hash: hash,
        qr_code_url: qrBase64,
        fullurl: fullURL,
      };
    } catch (err) {
      await db.query("ROLLBACK");
      console.error("opentable error:", err);
      set.status = 500;
      return { message: "Internal server error" };
    }
  },

  closetable: async (context: {
    set: Context["set"];
    body: { number: string };
    server: Context["server"];
    jwt?: any;
    headers: Context["headers"];
  }) => {
    const { set, body, server } = context;
    const scope = await requireRole(context as any, [
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const tableNumber = parseInt(body.number ?? "", 10);
    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      set.status = 400;
      return { message: "Invalid table number" };
    }

    try {
      const currentTable = await db.query(
        `SELECT customer_session
           FROM tables
          WHERE table_number=$1
            AND restaurant_id=$2
            AND status <> 'available'`,
        [tableNumber, scope.restaurantId],
      );
      if (currentTable.rowCount === 0) {
        set.status = 404;
        return { message: "Table not found" };
      }

      const closedSessionId = currentTable.rows[0].customer_session;
      const stmt = await db.query(
        `UPDATE tables
            SET status = 'available',
                opened_at = NULL,
                qr_code_url = NULL,
                customer_session = NULL
          WHERE table_number = $1
            AND restaurant_id = $2
            AND status <> 'available'`,
        [tableNumber, scope.restaurantId],
      );

      await db.query(
        "UPDATE sessions SET closed_at=NOW() WHERE session_id=$1 AND restaurant_id=$2",
        [closedSessionId, scope.restaurantId],
      );

      if (stmt.rowCount === 0) {
        set.status = 404;
        return { message: "Table not found or already available" };
      }

      if (closedSessionId) {
        server?.publish(
          closedSessionId,
          JSON.stringify({
            type: "table_closed",
            message: "Table has been close",
          }),
        );
      }

      await db.query(
        "UPDATE orders SET status='completed' WHERE table_number=$1 AND restaurant_id=$2",
        [tableNumber, scope.restaurantId],
      );

      return { message: "Close table success", table_number: tableNumber };
    } catch (err) {
      console.error("closetable error:", (err as Error).message);
      set.status = 500;
      return { message: "Internal server error" };
    }
  },

  checktabel: async ({
    set,
    params,
  }: {
    set: Context["set"];
    params: Context["params"];
  }) => {
    const hashcode = params.session;
    if (!hashcode) {
      set.status = 400;
      return { message: "Session not found" };
    }

    const result = await db.query(
      "SELECT * FROM tables WHERE customer_session = $1",
      [hashcode],
    );

    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Table not found" };
    }

    set.status = 200;
    return { message: "Table found", table: result.rows[0] };
  },

  ordersuccess: async (
    context: Context & {
      body: { table_number: Number };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "staff", "superadmin"]);
    if (!scope.ok) return scope.response;

    const tablenumber = body.table_number;
    if (!tablenumber) {
      set.status = 404;
      return { message: "No table number" };
    }

    await db.query(
      "UPDATE orders SET status='completed' WHERE table_number=$1 AND restaurant_id=$2",
      [tablenumber, scope.restaurantId],
    );
    return { message: "success" };
  },

  addtable: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    try {
      await db.query("BEGIN");
      const result = await db.query(
        `INSERT INTO tables (table_number, status, restaurant_id)
         VALUES (
           (SELECT COALESCE(MAX(table_number::integer), 0) + 1
              FROM tables
             WHERE restaurant_id=$1),
           'available',
           $1
         )
         RETURNING table_number`,
        [scope.restaurantId],
      );
      await db.query("COMMIT");
      const newtablenumber = parseInt(result.rows[0].table_number);
      return {
        success: true,
        message: `Add table ${newtablenumber} success`,
        new_table: newtablenumber,
      };
    } catch (err: any) {
      console.error(err.message);
      await db.query("ROLLBACK");
      set.status = 500;
      return { message: "Internal server error" };
    }
  },
};
