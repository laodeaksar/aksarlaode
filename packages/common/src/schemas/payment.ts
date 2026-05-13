import { z } from "zod/v4"

export const InitiatePaymentSchema = z.object({
  orderId:       z.string().uuid(),
  amount:        z.number().positive().int(),
  customerName:  z.string().min(1),
  customerEmail: z.email(),
  items: z.array(z.object({
    id:       z.string(),
    name:     z.string(),
    price:    z.number().positive().int(),
    quantity: z.number().positive().int(),
  })).min(1),
})

export const RegisterSchema = z.object({
  email:    z.email(),
  name:     z.string().min(2).max(100),
  password: z.string().min(8).max(72),
})

export const LoginSchema = z.object({
  email:    z.email(),
  password: z.string().min(1),
})

export const ProductFiltersSchema = z.object({
  search:     z.string().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice:   z.number().optional(),
  maxPrice:   z.number().optional(),
  inStock:    z.boolean().optional(),
  sortBy:     z.enum(["price_asc","price_desc","newest","popular"]).optional(),
  page:       z.number().int().positive().optional(),
  limit:      z.number().int().positive().max(100).optional(),
})
