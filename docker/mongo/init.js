db = db.getSiblingDB("ecommerce")

// Collections with validators
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["orderId", "userId", "status", "items", "grandTotal"],
      properties: {
        orderId:    { bsonType: "string" },
        userId:     { bsonType: "string" },
        status:     { bsonType: "string", enum: [
          "PENDING_PAYMENT","PAID","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"
        ]},
        grandTotal: { bsonType: "number", minimum: 0 },
      },
    }
  }
})

// Indexes
db.orders.createIndex({ orderId: 1  }, { unique: true })
db.orders.createIndex({ userId: 1, createdAt: -1 })
db.orders.createIndex({ status: 1,  createdAt: -1 })

print("MongoDB initialized ✓")
