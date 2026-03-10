import { sqliteTable, text, integer, numeric } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemCode: text("item_code").unique().notNull(),
  oldItemCode: text("old_item_code"),
  itemName: text("item_name").notNull(),
  itemType: text("item_type"), 
  category: text("category"), 
  serialNumber: text("serial_number"),
  locationStored: text("location_stored"),
  availabilityStatus: text("availability_status").default("Available"),
  deviceStatus: text("deviceStatus").default("Working"),
  remarks: text("remarks"),
  maintenanceRecords: text("maintenance_records"),
  gdriveLink: text("gdrive_link"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const borrowingSessions = sqliteTable("borrowing_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestorName: text("requestor_name").notNull(),
  companyName: text("company_name"),
  departmentName: text("department_name"),
  purposeTitle: text("purpose_title").notNull(),
  purposeDate: text("purpose_date"),
  pickupDate: numeric("pickup_date"),
  expectedReturnDate: numeric("expected_return_date"),
  dateRequested: numeric("date_requested").default(sql`CURRENT_TIMESTAMP`),
});

// Siguraduhin din ang usageLogs (borrower_records)
export const usageLogs = sqliteTable("borrower_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => borrowingSessions.id), 
  itemId: integer("item_id").references(() => items.id),
  dateReturned: numeric("date_returned"),
  requestStatus: text("request_status").default("Preparing"),
});