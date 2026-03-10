"use server"

import { db } from "../db/index"; 
import { items } from "../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addItem(formData: any) {
  try {
    await db.insert(items).values({
      itemCode: formData.itemCode,
      oldItemCode: formData.oldItemCode,
      itemName: formData.itemName,
      itemType: formData.itemType,
      category: formData.category,
      serialNumber: formData.serialNumber,
      locationStored: formData.locationStored,
      availabilityStatus: formData.availabilityStatus || "Available",
      
      // DAGDAG ITO PARA SA CONDITION AT GDRIVE
      deviceStatus: formData.deviceStatus || "Working",
      gdriveLink: formData.gdrive_link, // 'docsLink' ang name ng input sa page.tsx mo

      remarks: formData.remarks,
      maintenanceRecords: formData.maintenanceRecords,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Add Item Error:", error);
    return { success: false };
  }
}

export async function updateItem(id: number, formData: any) {
  try {
    await db.update(items)
      .set({
        itemCode: formData.itemCode,
        oldItemCode: formData.oldItemCode,
        itemName: formData.itemName,
        itemType: formData.itemType,
        category: formData.category,
        serialNumber: formData.serialNumber,
        locationStored: formData.locationStored,
        availabilityStatus: formData.availabilityStatus,
        
        // ETO ANG KRITIKAL NA CODES PARA MAG-UPDATE:
        deviceStatus: formData.deviceStatus, 
        gdriveLink: formData.gdrive_link, // Tiyaking 'docsLink' ang gamit sa form

        remarks: formData.remarks,
        maintenanceRecords: formData.maintenanceRecords,
      })
      .where(eq(items.id, id));

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Update Error:", error);
    return { success: false };
  }
}

export async function deleteItem(id: number) {
  try {
    await db.delete(items).where(eq(items.id, id));
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Delete Error:", error);
    return { success: false };
  }
}

export async function getItemByCode(code: string) {
  try {
    // Hinahanap ang item kung saan ang itemCode ay kapareho ng input
    const result = await db
      .select()
      .from(items)
      .where(eq(items.itemCode, code.toUpperCase()))
      .limit(1);

    // Kung may nahanap, ibalik ang unang item. Kung wala, null.
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Database Search Error:", error);
    return null;
  }
}