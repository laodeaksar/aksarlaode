import mongoose from "mongoose"
import { env }  from "@repo/env"

let isConnected = false

export async function connectMongo() {
  if (isConnected) return

  await mongoose.connect(env.MONGODB_URL, {
    dbName:         "orders",
    maxPoolSize:    10,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS:          45_000,
  })

  isConnected = true
  console.info("MongoDB connected")

  mongoose.connection.on("disconnected", () => {
    isConnected = false
    console.warn("MongoDB disconnected")
  })
}

export { mongoose }
