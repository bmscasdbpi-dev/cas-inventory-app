"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/db/supabase"; 
import { addItem, updateItem, deleteItem } from "@/actions/itemActions";
import { getAllItems, useEquipment, getAllLogs } from "@/actions/logActions"; 
import { QRCodeSVG } from "qrcode.react";

// --- HELPERS & SUB-COMPONENTS ---

/**
 * EditableCell Component
 * Logic: Single click to focus/select, Double click to trigger input mode.
 * Handles blur, Enter key, and Escape key for saving/canceling.
 */
const EditableCell = ({ value, field, itemId, onUpdate, children, type = "text", options = [], editTrigger = "doubleClick" }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value || "");

  useEffect(() => {
    setCurrentValue(value || "");
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (currentValue !== value) {
      onUpdate(itemId, field, currentValue);
    }
  };

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTrigger === "click") {
      setIsEditing(true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTrigger === "doubleClick") {
      setIsEditing(true);
    }
  };

  if (isEditing) {
    if (type === "select") {
      return (
        <select
          autoFocus
          value={currentValue}
          onChange={(e) => {
            setCurrentValue(e.target.value);
            setIsEditing(false);
            if (e.target.value !== value) {
              onUpdate(itemId, field, e.target.value);
            }
          }}
          onBlur={handleBlur}
          className="w-full bg-white border-2 border-[#005FB7] rounded px-1 py-1 text-xs font-bold outline-none shadow-sm text-black uppercase cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        autoFocus
        type="text"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleBlur();
          if (e.key === 'Escape') {
            setCurrentValue(value);
            setIsEditing(false);
          }
        }}
        className="w-full bg-white border-2 border-[#005FB7] rounded px-2 py-1 text-sm outline-none shadow-sm text-black cursor-text"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div 
      onClick={handleTrigger}
      onDoubleClick={handleDoubleClick}
      className="cursor-pointer hover:ring-1 hover:ring-[#005FB7]/30 rounded transition-all min-h-[24px] flex items-center w-full"
      title={editTrigger === "doubleClick" ? "Double click to edit" : "Click to edit"}
    >
      {children}
    </div>
  );
};

export default function UnifiedDashboard() {
  // --- STATES ---
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]); // Added logs state
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  
  // UI States
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [sortOrder, setSortOrder] = useState("oldest");
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [tempGdriveLink, setTempGdriveLink] = useState("");
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qrValue, setQrValue] = useState("");
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const categories = [
    "All", "Cameras & Accessories", "Lights & Accessories", "Sound & Accessories",
    "Computers & Peripherals", "Office Appliance", "Others"
  ];

  // ESC Key Listener for ALL Modals
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else if (showSaveConfirm) setShowSaveConfirm(false);
        else if (showLogoutConfirm) setShowLogoutConfirm(false); 
        else if (isQRModalOpen) setIsQRModalOpen(false); 
        else if (isModalOpen) setIsModalOpen(false); 
        else if (isViewModalOpen) setIsViewModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showDeleteConfirm, showSaveConfirm, showLogoutConfirm, isQRModalOpen, isModalOpen, isViewModalOpen]);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      
      // Fetch items and logs in parallel
      const [itemsRes, logsRes] = await Promise.all([
        getAllItems(),
        getAllLogs()
      ]);

      if (itemsRes.success) setItemsList(itemsRes.data || []);
      if (logsRes) setLogs(logsRes); // Assuming getAllLogs returns the array directly based on logActions structure
      
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  // --- HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initiateSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPendingFormData(new FormData(e.currentTarget));
    setShowSaveConfirm(true);
  };

  const confirmSave = async () => {
    if (!pendingFormData) return;
    setIsSaving(true);
    const data = Object.fromEntries(pendingFormData);
    const res = selectedItem ? await updateItem(selectedItem.id, data) : await addItem(data);
    
    if (res.success) {
      setShowSaveConfirm(false);
      setIsModalOpen(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      const updated = await getAllItems();
      if (updated.success) setItemsList(updated.data || []);
      setIsSaving(false);
    } else {
      setIsSaving(false);
      alert("Failed to save changes. Please try again.");
    }
  };

  const handleInlineUpdate = async (itemId: number, field: string, newValue: any) => {
    if (newValue === undefined) return;

    const itemToUpdate = itemsList.find(item => item.id === itemId);
    if (!itemToUpdate) return;

    setIsSaving(true);

    let updatedFields: any = { [field]: newValue };
    
    if (field === "deviceStatus") {
      updatedFields.availabilityStatus = newValue === "Working" ? "Available" : "Unavailable";
    }

    setItemsList(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, ...updatedFields } : item
    ));

    const formDataToSubmit = {
      ...itemToUpdate,
      ...updatedFields,
      gdrive_link: itemToUpdate.gdriveLink 
    };

    try {
      const res = await updateItem(itemId, formDataToSubmit);
      if (res.success) {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      } else {
        throw new Error("Server update failed");
      }
    } catch (error) {
      console.error(`Failed to update ${field} for item ${itemId}`, error);
      setItemsList(prevItems => prevItems.map(item => 
        item.id === itemId ? { 
          ...item, 
          [field]: itemToUpdate[field], 
          availabilityStatus: itemToUpdate.availabilityStatus 
        } : item
      ));
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

// Inside export default function UnifiedDashboard() { ...

const downloadQRCode = () => {
  const svg = document.getElementById("qr-code-svg") as SVGGraphicsElement | null;
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  // Define high-resolution constants
  const targetSize = 1080;
  const margin = 100; // Size of the white border in pixels
  const qrSize = targetSize - (margin * 2); // The actual QR code size inside the margins

  img.onload = () => {
    // 1. Force Canvas to 1080x1080
    canvas.width = targetSize;
    canvas.height = targetSize;

    if (ctx) {
      // 2. Fill entire background with White
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, targetSize, targetSize);

      // 3. Draw the QR code centered within the margins
      // We draw it at (margin, margin) with width/height of qrSize
      ctx.drawImage(img, margin, margin, qrSize, qrSize);
    }

    // 4. Trigger Download
    const pngFile = canvas.toDataURL("image/png", 1.0); // 1.0 is max quality
    const downloadLink = document.createElement("a");
    downloadLink.download = `QR-${selectedItem?.itemCode || 'code'}.png`;
    downloadLink.href = pngFile;
    downloadLink.click();
  };

  // Convert SVG to Base64
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
};

  // Cell Navigation Logic
  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      if (e.key === 'Escape') (e.target as HTMLElement).blur();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.stopPropagation();
        return;
      }
      return;
    }

    const totalCols = 8; 
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        document.getElementById(`cell-${rowIndex}-${(colIndex + 1) % totalCols}`)?.focus();
        break;
      case "ArrowLeft":
        e.preventDefault();
        document.getElementById(`cell-${rowIndex}-${(colIndex - 1 + totalCols) % totalCols}`)?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        document.getElementById(`cell-${(rowIndex + 1) % filteredItems.length}-${colIndex}`)?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        document.getElementById(`cell-${(rowIndex - 1 + filteredItems.length) % filteredItems.length}-${colIndex}`)?.focus();
        break;
      case "Enter":
        e.preventDefault();
        const doubleClickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
        e.currentTarget.dispatchEvent(doubleClickEvent);
        break;
    }
  };

  const cellFocusClass = "focus:outline-none focus:ring-2 focus:ring-[#005FB7] focus:bg-[#EAF1FF] rounded p-1 -m-1 transition-all outline-none border border-transparent cursor-pointer";

  const handleDelete = async () => {
    if (selectedItem) {
      const res = await deleteItem(selectedItem.id);
      if (res.success) window.location.reload();
    }
  };

  const filteredItems = itemsList
    .filter((item) => {
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (item.itemName?.toLowerCase() || "").includes(searchLower) ||
        (item.itemCode?.toLowerCase() || "").includes(searchLower) ||
        (item.itemType?.toLowerCase() || "").includes(searchLower) ||
        (item.serialNumber?.toLowerCase() || "").includes(searchLower);

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.id).getTime();
      const dateB = new Date(b.created_at || b.id).getTime();
      return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
    });

  const isSidebarExpanded = !sidebarMinimized || isHoveringSidebar;

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBFF]">
      <div className="w-12 h-12 border-4 border-[#E2E2E6] border-t-[#005FB7] rounded-full animate-spin mb-4"></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FDFBFF] text-[#1A1C1E] font-sans overflow-x-hidden">
  
  {/* SIDEBAR */}
      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 bg-[#F7F9FF] border-r border-[#E0E2EC] transition-all duration-300 ease-in-out lg:translate-x-0 shadow-xl lg:shadow-none
          ${sidebarMinimized ? "lg:w-20 w-72" : "w-72"} 
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <button 
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              className="p-2 hover:bg-[#EDF0F7] rounded-lg cursor-pointer transition-colors hidden lg:block"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            {/* Show title if NOT minimized OR if on mobile */}
            {(!sidebarMinimized || mobileMenuOpen) && (
              <h2 className="font-bold text-[#005FB7] tracking-tight whitespace-nowrap lg:block hidden">Inventory Dashboard</h2>
            )}
            {/* Mobile-only title (always shows when menu is open) */}
            <h2 className="font-bold text-[#005FB7] tracking-tight whitespace-nowrap lg:hidden">COMMAND CENTER</h2>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {[
              { label: "Inventory", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", active: true, action: () => setMobileMenuOpen(false) },
              { label: "Log Book", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6", action: () => router.push("/dashboard/logbook") },
              { label: "Verify", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3", action: () => router.push("/") }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className={`relative w-full flex items-center gap-4 p-3.5 rounded-xl transition-all cursor-pointer group
                  ${item.active ? "bg-[#D6E3FF] text-[#001B3E]" : "text-[#44474E] hover:bg-[#EDF0F7]"}
                  ${sidebarMinimized ? "lg:justify-center justify-start" : "justify-start"}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                
                {/* Standard Label: Hidden on desktop when minimized, always shown on mobile */}
                <span className={`font-semibold text-sm whitespace-nowrap ${sidebarMinimized ? "lg:hidden block" : "block"}`}>
                  {item.label}
                </span>
                
                {/* Hover Tooltip: Only renders and shows on desktop (lg) when minimized */}
                {sidebarMinimized && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#001B3E] text-white text-xs font-bold rounded-md opacity-0 invisible lg:group-hover:opacity-100 lg:group-hover:visible transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl pointer-events-none hidden lg:block">
                    {item.label}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#001B3E] rotate-45" />
                  </div>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 mt-auto">
            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              className={`relative w-full flex items-center gap-4 p-3.5 rounded-xl text-[#BA1A1A] hover:bg-[#FFDAD6] transition-all cursor-pointer font-bold group ${sidebarMinimized ? "lg:justify-center justify-start" : "justify-start"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              
              <span className={`text-sm ${sidebarMinimized ? "lg:hidden block" : "block"}`}>Sign Out</span>
              
              {/* Logout Tooltip: Desktop only */}
              {sidebarMinimized && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#BA1A1A] text-white text-xs font-bold rounded-md opacity-0 invisible lg:group-hover:opacity-100 lg:group-hover:visible transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl pointer-events-none hidden lg:block">
                  Sign Out
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#BA1A1A] rotate-45" />
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>
	  
	  
{/* MAIN CONTENT */}
<main className={`relative flex-1 transition-all duration-300 min-w-0 ${sidebarMinimized ? "lg:ml-20" : "lg:ml-72"}`}>
  
  {/* NOTIFICATION BANNER PILL */}
  {showSuccessToast && (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-[#1A1C1E] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-md">
        <div className="bg-[#C4EED0] p-1 rounded-full">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#002107" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span className="text-[11px] font-bold tracking-widest whitespace-nowrap">Dashboard Changes Saved</span>
      </div>
    </div>
  )}

  {/* HEADER */}
  <header className="sticky top-0 z-40 bg-[#FDFBFF]/90 backdrop-blur-xl border-b border-[#E0E2EC] h-20 flex items-center px-4 md:px-8">
    <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 mr-3 text-[#44474E] cursor-pointer hover:bg-[#F1F3F8] rounded-full transition-colors">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div className="flex-1 flex justify-center">
      <div className="relative w-full max-w-xl group">
        <input 
          type="text" 
          placeholder="Search inventory..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#F1F3F8] border-none text-sm rounded-full py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-[#005FB7] focus:bg-white transition-all outline-none font-medium cursor-text" 
        />
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-[#44474E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
    </div>
  </header>

  <div className="p-4 md:p-8">
    {/* CATEGORIES & ACTIONS */}
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-[#E0E2EC]">
      <div className="flex gap-8 overflow-x-auto no-scrollbar scroll-smooth">
        {categories.map((cat) => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)}
            className={`pb-4 text-small font-bold transition-all cursor-pointer relative ${
              activeCategory === cat ? "text-[#005FB7]" : "text-[#44474E] hover:text-[#005FB7]/70"
            }`}
          >
            {cat}
            {activeCategory === cat && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#005FB7] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 pb-4">
        <div className="flex items-center gap-2 bg-[#F1F3F8] px-4 py-2 rounded-xl border border-transparent hover:border-[#E0E2EC] transition-all">
          <span className="text-[10px] font-black text-[#74777F] uppercase tracking-tighter">Sort:</span>
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="bg-transparent text-[11px] font-bold text-[#005FB7] outline-none cursor-pointer uppercase tracking-tight"
          >
            <option value="oldest">Oldest First</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
        <button 
          onClick={() => {setSelectedItem(null); setIsModalOpen(true);}} 
          className="bg-[#005FB7] text-white px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg hover:bg-[#004ba0] transition-all cursor-pointer whitespace-nowrap active:scale-95"
        >
          + Add Item
        </button>
      </div>
    </div>
    
    {/* DATA CONTAINER */}
    <div className="bg-white rounded-[32px] md:rounded-[40px] border border-[#E0E2EC] overflow-hidden shadow-sm">
      <div className="hidden lg:grid grid-cols-[0.8fr_2.5fr_1fr_1.2fr_1fr_1.2fr_1.2fr_1fr_1.5fr] gap-3 bg-[#F7F9FF] px-8 py-5 text-xs font-bold text-[#74777F] uppercase tracking-normal border-b border-[#E0E2EC]">
        <div>Item Code</div>
        <div>Item Name</div>
        <div>Item Type</div>
        <div>Serial No.</div>
        <div>Location</div>
        <div>Status</div>
        <div className="text-center">Availability</div>
        <div>Old Code</div>
        <div className="text-right">Actions</div>
      </div>

      <div className="divide-y divide-[#E0E2EC]">
        {filteredItems.map((item, rowIndex) => (
          <div key={item.id} className="hover:bg-[#F8FAFF] transition-colors group">
            {/* DESKTOP ROW VIEW */}
            <div className="hidden lg:grid grid-cols-[0.8fr_2.5fr_1fr_1.2fr_1fr_1.2fr_1.2fr_1fr_1.5fr] gap-3 items-center px-8 py-6">
              
              {/* 1. Item Code */}
              <div 
                id={`cell-${rowIndex}-0`} 
                tabIndex={0} 
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLElement).blur();
                  if (document.activeElement?.tagName === 'INPUT') return;
                  handleCellKeyDown(e, rowIndex, 0);
                }} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <EditableCell value={item.itemCode} field="itemCode" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                  <div className="font-bold text-xs text-[#005FB7] bg-[#D6E3FF] px-2 py-1 rounded w-fit select-none">
                    {item.itemCode}
                  </div>
                </EditableCell>
              </div>

              {/* 2. Item Name */}
              <div 
                id={`cell-${rowIndex}-1`} 
                tabIndex={0} 
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLElement).blur();
                  if (document.activeElement?.tagName === 'INPUT') return;
                  handleCellKeyDown(e, rowIndex, 1);
                }} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <EditableCell value={item.itemName} field="itemName" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                  <p className="font-bold text-sm text-[#1A1C1E] whitespace-normal break-words leading-tight select-none">
                    {item.itemName}
                  </p>
                </EditableCell>
              </div>

              {/* 3. Item Type */}
              <div 
                id={`cell-${rowIndex}-3`} 
                tabIndex={0} 
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLElement).blur();
                  if (document.activeElement?.tagName === 'INPUT') return;
                  handleCellKeyDown(e, rowIndex, 3);
                }} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <EditableCell value={item.itemType} field="itemType" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                  <div className="text-sm text-[#44474E] select-none">{item.itemType || "—"}</div>
                </EditableCell>
              </div>

              {/* 4. Serial No. */}
              <div 
                id={`cell-${rowIndex}-4`} 
                tabIndex={0} 
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLElement).blur();
                  if (document.activeElement?.tagName === 'INPUT') return;
                  handleCellKeyDown(e, rowIndex, 4);
                }} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <EditableCell value={item.serialNumber} field="serialNumber" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                  <div className="font-bold text-xs text-[#44474E] break-all whitespace-normal select-none">{item.serialNumber || "N/A"}</div>
                </EditableCell>
              </div>

              {/* 5. Location */}
              <div 
                id={`cell-${rowIndex}-5`} 
                tabIndex={0} 
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLElement).blur();
                  if (document.activeElement?.tagName === 'INPUT') return;
                  handleCellKeyDown(e, rowIndex, 5);
                }} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <EditableCell value={item.locationStored} field="locationStored" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                  <div className="text-sm text-[#44474E] select-none">{item.locationStored || "—"}</div>
                </EditableCell>
              </div>

              {/* 6. Device Status */}
              <div 
                id={`cell-${rowIndex}-6`} 
                tabIndex={0} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <select 
                  value={item.deviceStatus || "Working"}
                  onChange={(e) => handleInlineUpdate(item.id, "deviceStatus", e.target.value)}
                  className={`text-xs font-bold uppercase outline-none cursor-pointer bg-transparent hover:bg-white hover:ring-1 hover:ring-[#E0E2EC] p-1 rounded transition-all w-full ${item.deviceStatus === 'Working' ? 'text-green-600' : 'text-orange-600'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {["Working", "For Repair", "Not Working", "Lost / Missing"].map(opt => (
                    <option key={opt} value={opt} className="text-[#1A1C1E]">{opt}</option>
                  ))}
                </select>
              </div>

              {/* 7. Availability */}
              <div className="text-center w-full block">
                <span className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase ${
                  item.availabilityStatus === 'Available' ? 'bg-[#C4EED0] text-[#002107]' : 'bg-[#E2E2E6] text-[#1A1C1E]'
                }`}>
                  {item.availabilityStatus}
                </span>
              </div>

              {/* 8. Old Item Code */}
              <div 
                id={`cell-${rowIndex}-7`} 
                tabIndex={0} 
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLElement).blur();
                  if (document.activeElement?.tagName === 'INPUT') return;
                  handleCellKeyDown(e, rowIndex, 7);
                }} 
                className="outline-none focus:ring-2 focus:ring-[#005FB7] focus:ring-inset rounded-lg transition-all cursor-pointer p-1 w-full block"
              >
                <EditableCell value={item.oldItemCode} field="oldItemCode" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                  <div className="font-mono text-xs text-[#74777F] select-none">{item.oldItemCode || "—"}</div>
                </EditableCell>
              </div>
              
              <div className="flex items-center justify-end gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => {setSelectedItem(item); setIsViewModalOpen(true);}} className="text-xs font-bold uppercase text-[#005FB7] hover:underline cursor-pointer mr-1">View Record</button>
                <div className="w-[1px] h-3 bg-[#E0E2EC] mx-1"></div>
                <button onClick={() => { const url = `${window.location.origin}/?c=${item.itemCode}`; setQrValue(url); setSelectedItem(item); setIsQRModalOpen(true); }} className="p-1.5 text-[#005FB7] hover:bg-white rounded-lg cursor-pointer transition-all border border-transparent hover:border-[#E0E2EC]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/></svg>
                </button>
                <button onClick={() => {setSelectedItem(item); setIsModalOpen(true);}} className="p-1.5 text-[#005FB7] hover:bg-white rounded-lg cursor-pointer transition-all border border-transparent hover:border-[#E0E2EC]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="lg:hidden p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1 w-full">
                  <EditableCell value={item.itemCode} field="itemCode" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                    <span className="font-mono text-xs font-bold text-[#005FB7] bg-[#D6E3FF] px-2 py-0.5 rounded uppercase cursor-pointer w-fit block">{item.itemCode}</span>
                  </EditableCell>
                  <EditableCell value={item.itemName} field="itemName" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                    <h3 className="font-bold text-[#1A1C1E] text-base leading-normal whitespace-normal break-words cursor-pointer block w-full">{item.itemName}</h3>
                  </EditableCell>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase shrink-0 ${item.availabilityStatus === 'Available' ? 'bg-[#C4EED0] text-[#002107]' : 'bg-[#E2E2E6] text-[#1A1C1E]'}`}>{item.availabilityStatus}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#F1F3F8]">
                <div className="w-full">
                  <p className="text-xs font-bold text-[#74777F] uppercase mb-1">Type / Serial</p>
                  <EditableCell value={item.itemType} field="itemType" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                    <p className="text-sm font-bold text-[#44474E] cursor-pointer block w-full">{item.itemType || "—"}</p>
                  </EditableCell>
                  <EditableCell value={item.serialNumber} field="serialNumber" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                    <p className="text-xs font-bold text-[#74777F] cursor-pointer break-all block w-full mt-1">{item.serialNumber || "No Serial"}</p>
                  </EditableCell>
                </div>
                <div className="w-full">
                  <p className="text-xs font-bold text-[#74777F] uppercase mb-1">Status</p>
                  <select value={item.deviceStatus || "Working"} onChange={(e) => handleInlineUpdate(item.id, "deviceStatus", e.target.value)} className={`text-sm font-bold uppercase outline-none cursor-pointer bg-transparent w-full ${item.deviceStatus === 'Working' ? 'text-green-600' : 'text-orange-600'}`}>
                    {["Working", "For Repair", "Not Working", "Lost / Missing"].map(opt => (
                      <option key={opt} value={opt} className="text-[#1A1C1E]">{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full">
                  <p className="text-xs font-bold text-[#74777F] uppercase mb-1">Location</p>
                  <EditableCell value={item.locationStored} field="locationStored" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                    <p className="text-sm font-bold text-[#44474E] cursor-pointer block w-full">{item.locationStored || "—"}</p>
                  </EditableCell>
                </div>
                <div className="w-full">
                  <p className="text-xs font-bold text-[#74777F] uppercase mb-1">Old Code</p>
                  <EditableCell value={item.oldItemCode} field="oldItemCode" itemId={item.id} onUpdate={handleInlineUpdate} editTrigger="doubleClick">
                    <p className="text-sm font-bold text-[#44474E] cursor-pointer block w-full">{item.oldItemCode || "—"}</p>
                  </EditableCell>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => {setSelectedItem(item); setIsViewModalOpen(true);}} className="w-full bg-[#F1F3F8] py-3 rounded-xl text-xs font-bold uppercase text-[#005FB7] cursor-pointer">View Remarks & Logs</button>
                <div className="flex gap-2">
                  <button onClick={() => { const url = `${window.location.origin}/?c=${item.itemCode}`; setQrValue(url); setSelectedItem(item); setIsQRModalOpen(true); }} className="flex-1 flex items-center justify-center gap-2 bg-white border border-[#E0E2EC] py-3 rounded-xl text-xs font-bold uppercase text-[#005FB7] cursor-pointer shadow-sm active:bg-[#F7F9FF]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/></svg>
                    View QR Code
                  </button>
                  <button onClick={() => {setSelectedItem(item); setIsModalOpen(true);}} className="flex-1 bg-[#005FB7] text-white py-3 rounded-xl text-xs font-bold uppercase cursor-pointer shadow-md">Edit</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
</main>

      {/* CONFIRMATION MODALS */}
      {showLogoutConfirm && <ConfirmModal title="Sign Out" msg="Are you sure you want to end your session?" onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} type="danger" />}
{showDeleteConfirm && (
  <ConfirmModal
    title="Delete Item"
    msg="Are you sure? This action cannot be undone."
    onConfirm={handleDelete}
    onCancel={() => setShowDeleteConfirm(false)}
    type="danger"
    isSaving={isSaving} 
  />
)}

{showSaveConfirm && (
  <ConfirmModal 
    title="Save Changes" 
    msg="Verify all details before committing to the database." 
    onConfirm={confirmSave} 
    onCancel={() => setShowSaveConfirm(false)} 
    type="primary" 
    isSaving={isSaving} 
  />
)}


{/* VIEW PREVIEW MODAL (Item Specification) */}
{isViewModalOpen && selectedItem && (
  <div 
    className="fixed inset-0 bg-[#1A1C1E]/60 flex items-center justify-center z-[100] md:p-4 backdrop-blur-md"
    onClick={() => setIsViewModalOpen(false)} 
  >
    <div 
      className="bg-[#FDFBFF] flex flex-col h-full w-full md:h-auto md:max-h-[90vh] md:max-w-lg lg:max-w-4xl md:rounded-[40px] shadow-2xl border border-[#E0E2EC] transition-all overflow-hidden"
      onClick={(e) => e.stopPropagation()} 
    >
      {/* HEADER */}
      <div className="flex justify-between items-center p-6 md:p-8 border-b border-[#F1F3F8] md:border-none bg-white">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-[#005FB7] rounded-full"></div>
          <h2 className="font-bold text-[#005FB7]">Item Specification</h2>
        </div>
        <button 
          onClick={() => setIsViewModalOpen(false)} 
          className="p-3 bg-[#F1F3F8] md:bg-transparent md:p-2 rounded-full transition-colors cursor-pointer text-[#44474E] active:scale-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 md:pt-0 md:p-8 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Data Details */}
          <div className="space-y-6">
            <div className="bg-[#F1F3F8] p-6 rounded-[24px]">
              <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Item Name</p>
              <p className="text-lg font-bold text-[#1A1C1E] leading-tight mb-4">{selectedItem.itemName}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Item Code</p>
                  <p className="text-sm font-bold text-[#005FB7]">{selectedItem.itemCode}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Old Code</p>
                  <p className="text-sm font-bold text-[#44474E]">{selectedItem.oldItemCode || "—"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-2">
              <div>
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Type</p>
                <p className="text-sm font-bold text-[#44474E]">{selectedItem.itemType || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Serial</p>
                <p className="text-sm font-bold text-[#44474E]">{selectedItem.serialNumber || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Location</p>
                <p className="text-sm font-bold text-[#44474E]">{selectedItem.locationStored || "—"}</p>
              </div>

              <div className="col-span-1">
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Condition</p>
                <p className={`text-sm font-bold uppercase ${selectedItem.deviceStatus === 'Working' ? 'text-green-600' : 'text-orange-600'}`}>
                  {selectedItem.deviceStatus || "Working"}
                </p>
              </div>
              
              <div>
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-1">Availability</p>
                <p className={`text-sm font-bold uppercase ${selectedItem.availabilityStatus === 'Available' ? 'text-green-600' : 'text-blue-600'}`}>
                  {selectedItem.availabilityStatus || "Available"}
                </p>
              </div>
            </div>

            {/* USAGE RECORDS SECTION */}
            <div className="space-y-4 px-2 pt-4 border-t border-[#E0E2EC]">
              <p className="text-[10px] font-bold text-[#74777F] uppercase mb-2">Usage Records</p>
              <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F1F3F8] text-[#74777F] font-bold uppercase text-[9px]">
                    <tr>
                      <th className="px-4 py-3">Purpose Title</th>
                      <th className="px-4 py-3 text-center">Requested</th>
                      <th className="px-4 py-3 text-center">Returned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F8]">
                    {(() => {
                      // Safety: Ensure we are working with an array
                      const logsArray = Array.isArray(logs) ? logs : (logs as any)?.data || [];
                      const itemLogs = logsArray.filter((log: any) => log.itemId === selectedItem.id);

                      if (itemLogs.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-[#74777F] italic">
                              No usage history found.
                            </td>
                          </tr>
                        );
                      }

                      return itemLogs.map((log: any, idx: number) => (
                        <tr 
                          key={idx} 
                          onClick={() => router.push(`/logbook?q=${encodeURIComponent(log.purposeTitle)}`)}
                          className="hover:bg-[#F7F9FF] cursor-pointer transition-colors group"
                        >
                          <td className="px-4 py-3 font-bold text-[#1A1C1E] group-hover:text-[#005FB7]">
                            {log.purposeTitle}
                          </td>
                          <td className="px-4 py-3 text-center text-[#44474E]">
                            {log.dateRequested?.split('T')[0] || "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-[#44474E]">
                            {log.dateReturned?.split('T')[0] || "Pending"}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4 px-2 pt-2 border-t border-[#E0E2EC]">
              <div>
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-2">Maintenance History</p>
                <div className="bg-white border border-[#E0E2EC] p-4 rounded-2xl shadow-sm min-h-[100px] w-full">
                  <p className="text-sm text-[#44474E] whitespace-pre-wrap break-words leading-relaxed">
                    {selectedItem.maintenanceRecords || "No maintenance records available."}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#74777F] uppercase mb-2">Remarks</p>
                <div className="bg-white border border-[#E0E2EC] p-4 rounded-2xl shadow-sm min-h-[60px] w-full">
                  <p className="text-sm text-[#44474E] whitespace-pre-wrap break-words leading-relaxed">
                    {selectedItem.remarks || "No additional remarks."}
                  </p>
                </div>
              </div>
            </div>

            {/* DESKTOP BUTTONS */}
            <div className="hidden lg:flex gap-3 pt-4 px-2">
              <button 
                onClick={() => { 
                  setIsViewModalOpen(false); 
                  setTempGdriveLink(selectedItem.gdriveLink || "");
                  setIsModalOpen(true); 
                }}
                className="flex-1 bg-[#F1F3F8] text-[#1A1C1E] py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#E0E2EC] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Item
              </button>
              <button 
                onClick={() => { 
                  const url = `${window.location.origin}/?c=${selectedItem.itemCode}`;
                  setQrValue(url); 
                  setSelectedItem(selectedItem); 
                  setIsQRModalOpen(true); 
                }}
                className="flex-1 bg-[#F1F3F8] text-[#005FB7] py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#D6E3FF] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                View QR
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: GDrive Preview */}
          <div className="lg:border-l lg:border-[#E0E2EC] lg:pl-8 pb-10 md:pb-0">
            {(() => {
              const rawLink = selectedItem?.gdriveLink;
              const fileIdMatch = rawLink?.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
              const fileId = fileIdMatch ? fileIdMatch[1] : null;

              if (fileId) {
                return (
                  <div className="lg:sticky lg:top-0">
                    <p className="text-[10px] font-bold text-[#74777F] uppercase mb-3 tracking-widest">Document Preview</p>
                    <div className="relative w-full overflow-hidden rounded-2xl border border-[#E0E2EC] bg-[#F1F3F8] shadow-inner" style={{ paddingBottom: '129.41%', height: 0 }}>
                       <iframe 
                         src={`https://drive.google.com/file/d/${fileId}/preview`} 
                         className="absolute top-0 left-0 w-full h-full border-0" 
                         allow="autoplay"
                       ></iframe>
                    </div>
                    <a href={rawLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 bg-[#005FB7] text-white px-4 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#004ba0] transition-all cursor-pointer w-full justify-center shadow-md active:scale-95">
                      Open Source File
                    </a>
                  </div>
                );
              }
              return (
                <div className="aspect-[8.5/11] flex flex-col items-center justify-center text-[#74777F] bg-[#F7F9FF] rounded-3xl border-2 border-dashed border-[#E0E2EC] p-8">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-20"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center">No Document Preview</p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* MOBILE FOOTER BUTTONS */}
      <div className="p-4 md:p-6 border-t border-[#F1F3F8] bg-white lg:hidden grid grid-cols-2 gap-3">
        <button 
          onClick={() => { 
            setIsViewModalOpen(false); 
            setTempGdriveLink(selectedItem.gdriveLink || "");
            setIsModalOpen(true); 
          }}
          className="bg-[#F1F3F8] text-[#1A1C1E] py-4 rounded-2xl font-bold text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button 
          onClick={() => { 
            const url = `${window.location.origin}/?c=${selectedItem.itemCode}`;
            setQrValue(url); 
            setSelectedItem(selectedItem); 
            setIsQRModalOpen(true); 
          }}
          className="bg-[#F1F3F8] text-[#005FB7] py-4 rounded-2xl font-bold text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          View QR
        </button>
        <button 
          onClick={() => setIsViewModalOpen(false)} 
          className="col-span-2 bg-[#1A1C1E] text-white py-4 rounded-full font-bold text-[10px] uppercase tracking-wider cursor-pointer active:bg-black transition-all"
        >
          Close Preview
        </button>
      </div>
    </div>
  </div>
)}


{/* FORM MODAL (REGISTER/EDIT) */}
{isModalOpen && (
  <div className="fixed inset-0 bg-[#1A1C1E]/60 flex items-center justify-center z-[100] backdrop-blur-md p-0 md:p-4">
    <form 
      key={selectedItem?.id || 'new'} 
      onSubmit={initiateSave} 
      className="bg-[#FDFBFF] w-full h-full md:h-auto md:max-h-[95vh] md:max-w-5xl lg:max-w-6xl md:rounded-[40px] shadow-2xl flex flex-col overflow-y-auto md:overflow-hidden"
    >
      {/* HEADER */}
      <div className="p-6 md:p-8 border-b border-[#E0E2EC] flex justify-between items-center bg-white sticky top-0 z-20 md:static">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1C1E]">{selectedItem ? "Update Item" : "Add Item"}</h2>
        </div>
        <button 
          type="button" 
          disabled={isSaving}
          onClick={() => {
            setIsModalOpen(false);
            setTempGdriveLink(""); // Clears temp link so it doesn't bleed into fresh adds
          }} 
          className="p-3 hover:bg-[#F1F3F8] rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ✕
        </button>
      </div>
      
      {/* CONTENT AREA */}
      <div className={`flex-1 p-6 md:p-10 md:overflow-y-auto bg-white/50 transition-all duration-300 ${isSaving ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* LEFT COLUMN: FORM FIELDS */}
            <div className="lg:col-span-7 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Item Code (New)</label>
                  <input name="itemCode" defaultValue={selectedItem?.itemCode || ""} className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none font-bold" required />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Old Item Code</label>
                  <input name="oldItemCode" defaultValue={selectedItem?.oldItemCode || ""} placeholder="N/A" className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none font-regular" />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Item Name / Description</label>
                  <input name="itemName" defaultValue={selectedItem?.itemName || ""} className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none focus:ring-2 focus:ring-[#005FB7] font-semibold" required />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Item Type</label>
                  <input name="itemType" defaultValue={selectedItem?.itemType || ""} className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Serial Number</label>
                  <input name="serialNumber" defaultValue={selectedItem?.serialNumber || ""} className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none font-bold" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Storage Location</label>
                  <input 
                    name="locationStored" 
                    defaultValue={selectedItem?.locationStored || ""} 
                    placeholder="e.g. Server Room, Cabinet A, Shelf 2" 
                    className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none focus:ring-2 focus:ring-[#005FB7]" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">
                    Condition Status
                  </label>
                  <div className="relative group">
                    <select 
                      name="deviceStatus" 
                      defaultValue={selectedItem?.deviceStatus || "Working"} 
                      className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none cursor-pointer font-bold appearance-none transition-all focus:ring-2 focus:ring-[#005FB7] pr-12"
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        const form = e.target.form as HTMLFormElement;
                        if (form) {
                          const availabilityInput = form.elements.namedItem('availabilityStatus') as HTMLInputElement;
                          if (availabilityInput) {
                            availabilityInput.value = newStatus === "Working" ? "Available" : "Unavailable";
                          }
                        }
                      }}
                    >
                      <option value="Working">Working</option>
                      <option value="For Repair">For Repair</option>
                      <option value="Not Working">Not Working</option>
                      <option value="Lost">Lost / Missing</option>
                    </select>

                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#74777F] group-focus-within:text-[#005FB7] transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Availability</label>
                  <input 
                    name="availabilityStatus" 
                    defaultValue={selectedItem?.availabilityStatus || "Available"} 
                    readOnly
                    className="w-full bg-[#E2E2E6] p-5 rounded-2xl outline-none font-bold text-[#1A1C1E] cursor-not-allowed"
                    placeholder="Auto-calculated"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Category</label>
                  <div className="relative group">
                    <select 
                      name="category" 
                      defaultValue={selectedItem?.category || ""} 
                      className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none cursor-pointer font-bold appearance-none transition-all focus:ring-2 focus:ring-[#005FB7] pr-12" 
                      required
                    >
                      <option value="" disabled>Select Category</option>
                      {categories.filter(c => c !== "All").map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#74777F] group-focus-within:text-[#005FB7] transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Remarks</label>
                  <textarea name="remarks" defaultValue={selectedItem?.remarks || ""} className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none h-32 resize-none" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#74777F] uppercase tracking-widest px-1">Maintenance Records</label>
                  <textarea name="maintenanceRecords" defaultValue={selectedItem?.maintenanceRecords || ""} className="w-full bg-[#F1F3F8] p-5 rounded-2xl outline-none h-32 resize-none" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#005FB7] uppercase tracking-widest px-1">GDrive Documentation Link</label>
                  <input 
                    name="gdrive_link" 
                    id="gdrive_input"
                    defaultValue={selectedItem?.gdriveLink || ""} 
                    placeholder="https://drive.google.com/file/d/..." 
                    className="w-full bg-[#D6E3FF]/30 p-5 rounded-2xl outline-none border border-[#D6E3FF] text-[#001B3E] font-medium"
                    onChange={(e) => setTempGdriveLink(e.target.value)} 
                  />  
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LIVE PREVIEW */}
            <div className="lg:col-span-5 lg:border-l lg:border-[#E0E2EC] lg:pl-10">
              <div className="lg:sticky lg:top-0">
                <p className="text-[10px] font-black text-[#74777F] uppercase mb-4 tracking-[0.2em]">Document Preview</p>
                {(() => {
                  // Fallback string derivation depending on edit or add state
                  const linkToPreview = selectedItem ? (tempGdriveLink || selectedItem?.gdriveLink) : tempGdriveLink;
                  const fileIdMatch = linkToPreview?.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
                  const fileId = fileIdMatch ? fileIdMatch[1] : null;

                  if (fileId) {
                    return (
                      <div className="space-y-4">
                        <div className="relative w-full overflow-hidden rounded-[32px] border border-[#E0E2EC] bg-[#F1F3F8] shadow-2xl" style={{ paddingBottom: '130%', height: 0 }}>
                          <iframe 
                            src={`https://drive.google.com/file/d/${fileId}/preview`} 
                            className="absolute top-0 left-0 w-full h-full border-0" 
                            allow="autoplay"
                          ></iframe>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="aspect-[3/4] flex flex-col items-center justify-center text-[#74777F] bg-[#F1F3F8] rounded-[32px] border-2 border-dashed border-[#E0E2EC] p-10 text-center">
                      <div className="w-16 h-16 bg-[#E0E2EC] rounded-full flex items-center justify-center mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest leading-loose">No valid Google Drive link</p>
                      <p className="text-[10px] mt-2 opacity-60">Paste a link to see the preview here</p>
                    </div>
                  );
                })()}
              </div>
            </div>
         </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-6 md:p-8 border-t border-[#E0E2EC] bg-white md:sticky md:bottom-0 z-20">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full">
          {selectedItem && (
            <button 
              type="button" 
              disabled={isSaving}
              onClick={() => setShowDeleteConfirm(true)} 
              className="w-full md:w-auto order-2 md:order-1 px-8 py-4 text-[#BA1A1A] font-black text-xs uppercase tracking-widest hover:bg-[#FFDAD6] rounded-full transition-colors cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Item
            </button>
          )}

          <button 
            type="button" 
            disabled={isSaving}
            onClick={() => {
              setIsModalOpen(false);
              setTempGdriveLink(""); // Clears temp link on discard
            }} 
            className="w-full md:w-auto order-3 md:order-2 md:ml-auto px-8 py-4 text-[#44474E] font-bold text-xs uppercase tracking-widest cursor-pointer text-center hover:bg-[#F1F3F8] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full md:w-auto order-1 md:order-3 bg-[#005FB7] text-white px-12 py-5 rounded-full font-bold shadow-xl hover:bg-[#004ba0] transition-all text-xs uppercase tracking-widest cursor-pointer active:scale-95 disabled:bg-[#74777F] disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              selectedItem ? "Save Changes" : "Add Item"
            )}
          </button>
        </div>
      </div>
    </form>
  </div>
)}

      {/* QR MODAL */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-[#1A1C1E]/80 flex items-center justify-center p-4 z-[100] backdrop-blur-xl">
          <div className="bg-white p-10 rounded-[48px] text-center shadow-2xl max-w-sm w-full border border-[#E0E2EC]">
            <h3 className="font-bold text-xl mb-1 text-[#1A1C1E]">{selectedItem?.itemName}</h3>
            <p className="text-xs text-[#005FB7] mb-10 uppercase tracking-widest font-black font-mono">{selectedItem?.itemCode}</p>
            <div className="bg-white p-6 inline-block rounded-[32px] mb-10 shadow-inner border border-[#F1F3F8]">
              <QRCodeSVG id="qr-code-svg" value={qrValue} size={200} level="H" />
            </div>
            <div className="space-y-3">
              <button onClick={downloadQRCode} className="w-full bg-[#005FB7] text-white py-5 rounded-full font-bold text-xs uppercase tracking-widest cursor-pointer shadow-lg hover:bg-[#004ba0] transition-all">Download QR Code</button>
              <button onClick={() => setIsQRModalOpen(false)} className="w-full text-[#44474E] py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-[#1A1C1E]/60 z-40 lg:hidden backdrop-blur-sm" />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---
function ConfirmModal({ title, msg, onConfirm, onCancel, type, isSaving }: any) {
  return (	
    <div className="fixed inset-0 bg-[#1A1C1E]/80 flex items-center justify-center p-4 z-[110] backdrop-blur-md">
      <div className={`bg-white p-10 rounded-[40px] max-w-md w-full shadow-2xl border border-[#E0E2EC] transition-all ${isSaving ? 'opacity-80 scale-95' : 'scale-100'}`}>
        <h3 className={`text-2xl font-bold mb-4 ${type === 'danger' ? 'text-[#BA1A1A]' : 'text-[#005FB7]'}`}>
          {title}
        </h3>
        <p className="text-[#44474E] text-sm leading-relaxed mb-10 font-medium">
          {msg}
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            disabled={isSaving}
            className="flex-1 py-4 text-[#44474E] font-bold text-xs uppercase tracking-widest cursor-pointer hover:bg-[#F1F3F8] rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          
          <button 
            onClick={onConfirm} 
            disabled={isSaving}
            className={`flex-1 py-4 rounded-full text-white font-bold text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
              isSaving 
                ? 'bg-[#74777F] cursor-not-allowed' 
                : type === 'danger' 
                  ? 'bg-[#BA1A1A] hover:bg-[#93000A] cursor-pointer' 
                  : 'bg-[#005FB7] hover:bg-[#004ba0] cursor-pointer'
            }`}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}