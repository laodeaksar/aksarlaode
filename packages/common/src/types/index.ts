// CONSISTENCY-FIX TYPE-01: added OWNER + FINANCE so admin RBAC covers all roles.
export type UserRole = "CUSTOMER" | "ADMIN" | "OWNER" | "FINANCE";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
};

// CONSISTENCY-FIX TYPE-01: added ProductStatus + status field so admin services
// don't need to redefine this type locally.
export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description?: string;
  price: number;
  stock: number;
  status?: ProductStatus;
  imageUrls?: string[];
  categoryId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type NewProduct = {
  name: string;
  slug: string;
  sku: string;
  description?: string;
  price: number;
  stock: number;
  imageUrls?: string[];
  categoryId?: string;
};

export type Payment = {
  id: string;
  orderId: string;
  userId: string;
  snapToken: string;
  snapUrl: string;
  amount: number;
  status: string;
  createdAt?: string;
};

export type CreateOrderSchema = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: {
    recipientName: string;
    phone: string;
    street: string;
    city: string;
    province: string;
    postalCode: string;
    notes?: string;
  };
};

export type OrderDetail = {
  orderId: string;
  userId: string;
  status: string;
  totalAmount: number;
  grandTotal: number;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  shippingAddress: Record<string, string>;
  statusHistory: Array<{ status: string; note?: string; timestamp: string }>;
  createdAt: string;
};
