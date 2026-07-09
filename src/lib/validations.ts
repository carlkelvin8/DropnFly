import { z } from "zod";

export const bookingSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  locationId: z.string().min(1, "Location is required"),
  checkIn: z.string().min(1, "Check-in is required"),
  checkOut: z.string().min(1, "Check-out is required"),
  numberOfBags: z.coerce.number().min(1, "At least 1 bag required"),
  status: z.string().optional(),
});

export const publicBookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  countryOfOrigin: z.string().optional(),
  cityOfOrigin: z.string().optional(),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropOffLocation: z.string().min(1, "Drop-off location is required"),
  numberOfBags: z.coerce.number().min(1, "At least 1 bag"),
  luggageDetails: z.string().optional(),
  preferredDate: z.string().min(1, "Date is required"),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
});

export const customerRegisterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const customerLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const promoSchema = z.object({
  code: z.string().min(1, "Code is required").transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce.number().min(1, "Value must be positive"),
  maxUsage: z.coerce.number().min(1).default(100),
  minAmount: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().positive().optional(),
  expiresAt: z.string().optional(),
});

export const paymentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(["GCASH", "MAYA", "CARD", "CASH"]),
});

export const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  pricePerDay: z.coerce.number().min(0, "Price must be positive"),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

export const employeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().optional(),
});

export const settingsSchema = z.record(z.string(), z.string());
