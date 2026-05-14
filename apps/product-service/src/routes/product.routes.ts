import Elysia          from "elysia"
import { listHandler }   from "@/handlers/list"
import { createHandler } from "@/handlers/create"
import { getOneHandler } from "@/handlers/get-one"
import { updateHandler } from "@/handlers/update"
import { deleteHandler } from "@/handlers/delete"

export const productRoutes = new Elysia({ prefix: "/products" })
  .get("/",      listHandler)
  .post("/",     createHandler)
  .get("/:id",   getOneHandler)
  .put("/:id",   updateHandler)
  .delete("/:id", deleteHandler)
