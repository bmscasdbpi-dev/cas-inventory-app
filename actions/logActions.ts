"use server"

import { db } from "../db/index"; 
import { usageLogs, items, borrowingSessions } from "../db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * 1. Kunin ang lahat ng items
 */
export async function getAllItems() {
  try {
    const data = await db.select().from(items).orderBy(desc(items.id));
    return { success: true, data };
  } catch (error) {
    console.error("Fetch Items Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * 2. Pag-log ng paggamit (Equipment Issuance)
 */
export async function useEquipment(formData: {
  borrowedBy: string;
  companyName: string;
  departmentName: string;
  eventName: string;
  purposeDate: string;
  claimDate: string;
  returnExpectedDate: string;
  itemIds: number[];
}) {
  try {
    return await db.transaction(async (tx) => {
      const [session] = await tx.insert(borrowingSessions).values({
        requestorName: formData.borrowedBy,
        companyName: formData.companyName,
        departmentName: formData.departmentName,
        purposeTitle: formData.eventName,
        purposeDate: formData.purposeDate,
        pickupDate: formData.claimDate,
        expectedReturnDate: formData.returnExpectedDate,
      }).returning({ id: borrowingSessions.id });

      if (!session) throw new Error("Failed to create borrowing session.");

      for (const id of formData.itemIds) {
        await tx.insert(usageLogs).values({
          sessionId: session.id,
          itemId: id,
          requestStatus: "Preparing",
        });

        await tx.update(items)
          .set({ availabilityStatus: "Unavailable" })
          .where(eq(items.id, id));
      }

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/logbook");
      return { success: true };
    });
  } catch (e) {
    console.error("Use Equipment Error:", e);
    return { success: false, error: "Hindi ma-save ang record." };
  }
}

/**
 * 3. Pag-return ng kagamitan (Batch)
 */
export async function returnEquipmentBatch(logIds: number[], itemIds: number[], manualReturnDate: string) {
  try {
    return await db.transaction(async (tx) => {
      if (logIds.length > 0) {
        await tx.update(usageLogs)
          .set({ 
            dateReturned: manualReturnDate, 
            requestStatus: "Returned" 
          })
          .where(inArray(usageLogs.id, logIds));
      }

      if (itemIds.length > 0) {
        await tx.update(items)
          .set({ availabilityStatus: "Available" })
          .where(inArray(items.id, itemIds));
      }

      revalidatePath("/dashboard/logbook");
      revalidatePath("/dashboard");
      return { success: true };
    });
  } catch (e) {
    console.error("Batch Return Error:", e);
    return { success: false };
  }
}

/**
 * 4. Kunin ang lahat ng logs (Joins 3 tables)
 */
export async function getAllLogs() {
  try {
    const data = await db
      .select({
        id: usageLogs.id,
        sessionId: usageLogs.sessionId,
        itemId: usageLogs.itemId,
        requestorName: borrowingSessions.requestorName,
        companyName: borrowingSessions.companyName,
        departmentName: borrowingSessions.departmentName,
        purposeTitle: borrowingSessions.purposeTitle,
        itemCode: items.itemCode,
        itemName: items.itemName,
        serialNumber: items.serialNumber, 
        dateRequested: borrowingSessions.dateRequested,
        pickupDate: borrowingSessions.pickupDate,
        expectedReturnDate: borrowingSessions.expectedReturnDate,
        dateReturned: usageLogs.dateReturned,
        requestStatus: usageLogs.requestStatus,
      })
      .from(usageLogs)
      .leftJoin(borrowingSessions, eq(usageLogs.sessionId, borrowingSessions.id))
      .leftJoin(items, eq(usageLogs.itemId, items.id))
      .orderBy(desc(usageLogs.id));

    return { success: true, data };
  } catch (error) {
    console.error("Fetch Logs Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * 5. Update Session Details
 */
export async function updateSessionBatch(sessionId: number, updates: {
  requestorName: string;
  companyName: string;
  departmentName: string;
  purposeTitle: string;
}) {
  try {
    await db.update(borrowingSessions)
      .set(updates)
      .where(eq(borrowingSessions.id, sessionId));

    revalidatePath("/dashboard/logbook");
    return { success: true };
  } catch (error) {
    console.error("Update Session Error:", error);
    return { success: false };
  }
}

/**
 * 6. Update Status (Batch)
 */
export async function updateBatchStatus(logIds: number[], newStatus: string) {
  try {
    await db.update(usageLogs)
      .set({ requestStatus: newStatus })
      .where(inArray(usageLogs.id, logIds));

    revalidatePath("/dashboard/logbook");
    return { success: true };
  } catch (error) {
    console.error("Status Update Error:", error);
    return { success: false };
  }
}

/**
 * 7. Update Single Log Entry
 */
export async function updateSingleLogEntry(logId: number, itemId: number, updates: any) {
  try {
    return await db.transaction(async (tx) => {
      await tx.update(usageLogs)
        .set(updates)
        .where(eq(usageLogs.id, logId));

      if (updates.requestStatus) {
        const newAvailability = updates.requestStatus === "Returned" ? "Available" : "Unavailable";
        await tx.update(items)
          .set({ availabilityStatus: newAvailability })
          .where(eq(items.id, itemId));
      }

      revalidatePath("/dashboard/logbook");
      revalidatePath("/dashboard");
      return { success: true };
    });
  } catch (error) {
    console.error("Single Entry Update Error:", error);
    return { success: false };
  }
}

/**
 * 8. Update Item Details
 */
export async function updateItemDetails(itemId: number, updates: { itemName?: string, serialNumber?: string }) {
  try {
    await db.update(items)
      .set(updates)
      .where(eq(items.id, itemId));

    revalidatePath("/dashboard/logbook");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Item Detail Update Error:", error);
    return { success: false };
  }
}

/**
 * 9. Update Log Batch (FIX FOR THE "onBlur" ERROR)
 */
export async function updateLogBatch(logIds: number[], updates: any) {
  try {
    await db.update(usageLogs)
      .set(updates)
      .where(inArray(usageLogs.id, logIds));

    revalidatePath("/dashboard/logbook");
    return { success: true };
  } catch (error) {
    console.error("Log Batch Update Error:", error);
    return { success: false };
  }
}