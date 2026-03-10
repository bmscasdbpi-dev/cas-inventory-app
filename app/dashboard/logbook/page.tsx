"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../db/supabase"; 
import { 
  getAllLogs, 
  useEquipment, 
  getAllItems, 
  returnEquipmentBatch,
  updateSessionBatch, 
  updateBatchStatus,     
  updateSingleLogEntry, 
  updateItemDetails,
  updateLogBatch // <--- ADD THIS LINE
} from "../../../actions/logActions";

import { Html5QrcodeScanner } from "html5-qrcode";

export default function LogbookPage() {
  // --- STATES ---
  const [logs, setLogs] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // UI States
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); 
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [itemSearchText, setItemSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false); 
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showScanError, setShowScanError] = useState(false);
  

  // Data States
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [checkedItems, setCheckedItems] = useState<number[]>([]); 
  const [manualReturnDate, setManualReturnDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: number | string, field: string } | null>(null);

  // Filters
  const [pickerSearch, setPickerSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const router = useRouter();
  const supabase = createClient();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const categories = ["All", "Cameras & Accessories", "Lights & Accessories", "Sound & Accessories", "Computers & Peripherals", "Office Appliance", "Others"];

  // --- SUGGESTION LOGIC ---
  const SUGGESTION_MAP: Record<string, string[]> = {
    "CA-002-24": ["CA-008-24"], 
    "CA-001-24": ["CA-007-24"], 
  };

  const suggestedItems = allItems.filter(item => {
    if (item.availabilityStatus !== 'Available' || selectedItems.some(s => s.id === item.id)) {
      return false;
    }
    return selectedItems.some(selected => {
      const triggers = SUGGESTION_MAP[selected.itemCode] || [];
      return triggers.includes(item.itemCode);
    });
  });

  // --- BATCH GROUPING LOGIC (UPDATED FOR SESSION_ID) ---
  const groupedLogs = useMemo(() => {
    const groups: { [key: number]: any } = {};

    logs.forEach((log) => {
      // Gumagamit na tayo ng sessionId para sa mas accurate na grouping
      const key = log.sessionId; 

      if (!groups[key]) {
        groups[key] = {
          sessionId: log.sessionId,
          requestorName: log.requestorName,
          companyName: log.companyName,
          departmentName: log.departmentName,
          purposeTitle: log.purposeTitle,
          dateRequested: log.dateRequested ? log.dateRequested.split(/[ T]/)[0] : 'No Date',
          pickupDate: log.pickupDate,
          expectedReturnDate: log.expectedReturnDate,
          status: log.requestStatus,
          items: [],
          allReturned: true
        };
      }
      groups[key].items.push(log);
      if (log.requestStatus !== 'Returned') groups[key].allReturned = false;
    });

    return Object.values(groups).filter((batch: any) => 
      batch.purposeTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.requestorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.departmentName?.toLowerCase().includes(searchQuery.toLowerCase()) 
    );
  }, [logs, searchQuery]);

  // --- PICKER FILTER LOGIC ---
  const filteredPickerItems = useMemo(() => {
    const filtered = allItems.filter(item => {
      const matchesSearch = 
        item.itemName?.toLowerCase().includes(pickerSearch.toLowerCase()) || 
        item.itemCode?.toLowerCase().includes(pickerSearch.toLowerCase());
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
    return filtered.sort((a, b) => a.id - b.id);
  }, [allItems, pickerSearch, activeCategory]);
  
  // --- INITIALIZATION ---
  const fetchData = async () => {
    const [logsRes, itemsRes] = await Promise.all([getAllLogs(), getAllItems()]);
    if (logsRes.success) setLogs(logsRes.data);
    if (itemsRes.success) setAllItems(itemsRes.data);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/login");
      else { await fetchData(); setLoading(false); }
    };
    checkAuth();
  }, [router, supabase]);

  // --- HANDLERS ---
  const isSidebarExpanded = !sidebarMinimized || isHoveringSidebar;

  const handleToggleItem = (item: any) => {
    setSelectedItems(prev => prev.find(i => i.id === item.id) ? prev.filter(i => i.id !== item.id) : [...prev, item]);
  };

  const handleToggleCheck = (id: number) => {
    setCheckedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // --- SAVE RECORD (UPDATED PAYLOAD) ---
  const handleSaveRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedItems.length === 0) return alert("Pumili muna ng gamit.");

    const formData = new FormData(e.currentTarget);
    const claim = formData.get("claimDate") as string;
    const returnDt = formData.get("returnExpectedDate") as string;

    if (new Date(returnDt) < new Date(claim)) {
      return alert("Ang return date ay hindi pwedeng mas maaga sa pickup date.");
    }

    setIsSubmitting(true);

    const payload = {
      borrowedBy: formData.get("borrowedBy") as string,
      companyName: formData.get("companyName") as string,      
      departmentName: formData.get("departmentName") as string, 
      eventName: formData.get("eventName") as string,
      purposeDate: formData.get("purposeDate") as string,
      claimDate: claim,
      returnExpectedDate: returnDt,
      itemIds: selectedItems.map(item => Number(item.id)), // Siguradong number
    };

const result = await useEquipment(payload);

    if (result.success) {
      setIsAddModalOpen(false);
      setSelectedItems([]);
      await fetchData();
    } else {
      const errorMessage = (result as { error?: string }).error || "Failed to save record";
      alert(errorMessage);
    }
    
    setIsSubmitting(false); // Move this inside the function
  }; // <--- ADD THIS BRACE to properly close handleSaveRecord

const handleBatchReturn = async () => {
    // 1. Check basic validation
    if (checkedItems.length === 0 || !manualReturnDate) {
      return alert("Pumili ng items at petsa.");
    }

    // 2. ANG GUARD: Siguraduhin na may laman ang selectedBatch bago i-access ang .items
    if (!selectedBatch?.items) {
      return alert("Walang batch na napili o walang items sa batch na ito.");
    }

    setIsSubmitting(true);
    
    // 3. Ngayong safe na, kunin ang IDs (may :any para sa build error)
    const itemIdsToUpdate = selectedBatch.items
      .filter((i: any) => checkedItems.includes(i.id))
      .map((i: any) => i.itemId);

    const result = await returnEquipmentBatch(checkedItems, itemIdsToUpdate, manualReturnDate);
    
    if (result.success) {
      await fetchData();
      setIsDetailModalOpen(false);
      setCheckedItems([]);
      setManualReturnDate("");
    }
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // QR Scanner logic
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isQRScannerOpen) {
      scanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: 250 }, false);
      scanner.render((text) => {
        const found = allItems.find((i: any) => text.includes(i.itemCode) && i.itemCode !== "");
        if (found && !selectedItems.find(s => s.id === found.id) && found.availabilityStatus === "Available") {
          handleToggleItem(found);
        }
      }, () => {});
    }
    return () => { scanner?.clear().catch(() => {}); };
  }, [isQRScannerOpen, allItems, selectedItems]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBFF]">
      <div className="w-12 h-12 border-4 border-[#E2E2E6] border-t-[#005FB7] rounded-full animate-spin mb-4"></div>
    </div>
  );

  // Dito itutuloy ang Return/UI elements...
  return (
    <div className="flex min-h-screen bg-[#FDFBFF] text-[#1A1C1E] font-sans overflow-x-hidden">
      
     {/* SIDEBAR */}
      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 bg-[#F7F9FF] border-r border-[#E0E2EC] transition-all duration-300 ease-in-out lg:translate-x-0 shadow-xl lg:shadow-none
          ${sidebarMinimized ? "lg:w-20 w-72" : "w-72"} 
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Container: No overflow-hidden to allow tooltips to be visible */}
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
            
            {/* Command Center Title: Only hides on desktop if sidebar is minimized */}
            <h2 className={`font-bold text-[#005FB7] tracking-tight whitespace-nowrap ${sidebarMinimized ? "lg:hidden block" : "block"}`}>
              Logbook
            </h2>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {[
              { label: "Inventory", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", action: () => router.push("/dashboard") },
              { label: "Log Book", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6", active: true, action: () => setMobileMenuOpen(false) },
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
                
                {/* Standard Label: Always shows on mobile, toggles on desktop */}
                <span className={`font-semibold text-sm whitespace-nowrap ${sidebarMinimized ? "lg:hidden block" : "block"}`}>
                  {item.label}
                </span>

                {/* Hover Tooltip: Minimized Desktop only */}
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
              
              {/* Logout Tooltip */}
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

<main className={`flex-1 transition-all duration-300 ${sidebarMinimized ? "lg:ml-20" : "lg:ml-72"}`}>
  {/* HEADER - Standardized text size */}
{/* FIXED HEADER WITH MOBILE BUTTON */}
  <header className="sticky top-0 z-40 bg-[#FDFBFF]/90 backdrop-blur-xl border-b border-[#E0E2EC] h-20 flex items-center px-4 lg:px-8">
    
    {/* Mobile Menu Toggle - Visible only on small screens */}
    <button 
      onClick={() => setMobileMenuOpen(true)} 
      className="lg:hidden p-2.5 mr-3 text-[#44474E] cursor-pointer hover:bg-[#F1F3F8] rounded-full transition-colors"
      title="Open menu"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>

    {/* Search Container - Centered and responsive */}
    <div className="flex-1 flex justify-start lg:justify-center">
      <div className="relative w-full max-w-xl group">
        {/* Search Icon */}
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-[#74777F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input 
          type="text" 
          placeholder="Maghanap sa logbook records..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#F1F3F8] border-none text-sm rounded-full py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-[#005FB7]/20 focus:bg-white transition-all outline-none font-normal text-[#1A1C1E]" 
        />
      </div>
    </div>
  </header>

<div className="p-4 lg:p-8">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1C1E]">Usage Logbook</h1>
        <p className="text-[#74777F] text-sm font-normal">History of equipment usage and event records.</p>
      </div>
      <button 
        onClick={() => setIsAddModalOpen(true)} 
        className="w-full sm:w-auto bg-[#005FB7] text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-sm hover:bg-[#004A8F] transition-all cursor-pointer"
      >
        + Add record
      </button>
    </div>

    {/* Main List Container */}
    <div className="bg-white rounded-[24px] lg:rounded-[28px] border border-[#E0E2EC] overflow-hidden shadow-sm">
      
      {/* Desktop Header - 6 Column Grid */}
      <div className="hidden lg:grid lg:grid-cols-[1.2fr_1.4fr_1fr_0.7fr_1fr_1fr] bg-[#F7F9FF] px-8 py-4 text-xs font-bold text-[#74777F] border-b border-[#E0E2EC] uppercase tracking-wider">
        <span>Name of Requestor</span>
        <span>Purpose</span>
        <span>Date Requested</span>
        <span className="text-center">Items</span>
        <span className="text-center">Date Returned</span>
        <span className="text-center">Global Status</span>
      </div>

      <div className="divide-y divide-[#E0E2EC]">
        {groupedLogs.length === 0 ? (
          <div className="p-20 text-center text-[#74777F] text-sm font-normal">
            Walang nahanap na record.
          </div>
        ) : (
          groupedLogs.map((batch: any, i) => {
            // Logic to determine a display date for "Date Returned" 
            // Shows the date if all items are returned, or 'Multiple'/'Pending'
            const returnedDates = batch.items.map((item: any) => item.dateReturned).filter(Boolean);
            const isAllReturned = returnedDates.length === batch.items.length && batch.items.length > 0;
            const displayReturnDate = isAllReturned 
              ? returnedDates[0] // Simplified: showing the first return date found
              : returnedDates.length > 0 ? "Partial" : "---";

            return (
              <div 
                key={i} 
                onClick={() => { setSelectedBatch(batch); setIsDetailModalOpen(true); }} 
                className="flex flex-col lg:grid lg:grid-cols-[1.2fr_1.4fr_1fr_0.7fr_1fr_1fr] lg:items-center p-6 lg:px-8 lg:py-5 hover:bg-[#F8FAFF] transition-colors cursor-pointer group gap-4 lg:gap-0"
              >
                {/* 1. Name of Requestor */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#D6E3FF] rounded-full flex items-center justify-center text-xs font-bold text-[#001B3E] shrink-0">
                    {batch.requestorName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] lg:hidden font-bold text-[#74777F] mb-0.5 uppercase">Requestor</p>
                    <span className="text-sm font-bold text-[#1A1C1E] truncate block">{batch.requestorName}</span>
                  </div>
                </div>

                {/* 2. Purpose */}
                <div className="min-w-0">
                  <p className="text-[10px] lg:hidden font-bold text-[#74777F] mb-0.5 uppercase">Purpose</p>
                  <p className="text-sm font-medium text-[#44474E] leading-tight group-hover:text-[#005FB7] transition-colors truncate">
                    {batch.purposeTitle}
                  </p>
                </div>

                {/* 3. Date Requested */}
                <div>
                  <p className="text-[10px] lg:hidden font-bold text-[#74777F] mb-0.5 uppercase">Requested</p>
                  <p className="text-sm font-medium text-[#74777F]">{batch.dateRequested}</p>
                </div>

                {/* 4. Item Quantity */}
                <div className="lg:text-center">
                  <p className="text-[10px] lg:hidden font-bold text-[#74777F] mb-0.5 uppercase">Qty</p>
                  <p className="text-sm font-bold text-[#1A1C1E]">
                    {batch.items.length} <span className="lg:hidden text-[10px] text-[#74777F] font-normal">items</span>
                  </p>
                </div>

                {/* 5. Date Returned */}
                <div className="lg:text-center">
                  <p className="text-[10px] lg:hidden font-bold text-[#74777F] mb-0.5 uppercase">Returned Date</p>
                  <p className={`text-sm font-medium ${isAllReturned ? 'text-[#006E33]' : 'text-[#74777F]'}`}>
                    {displayReturnDate}
                  </p>
                </div>

                {/* 6. Global Status Badge */}
                <div className="lg:text-center flex lg:justify-center items-center">
                  <p className="text-[10px] lg:hidden font-bold text-[#74777F] mr-auto uppercase">Global Status</p>
                  <span className={`text-[10px] font-black uppercase tracking-tighter px-4 py-1.5 rounded-xl shadow-sm border ${
                    batch.status === 'Completed' ? 'bg-[#C4EED0] text-[#002107] border-[#A2D9B3]' :
                    batch.status === 'In Progress' ? 'bg-[#D6E3FF] text-[#001B3E] border-[#B1C5FF]' :
                    batch.status === 'Cancelled' ? 'bg-[#FFDAD6] text-[#BA1A1A] border-[#FFB4AB]' :
                    'bg-[#F1F3F8] text-[#44474E] border-[#E0E2EC]'
                  }`}>
                    {batch.status || 'Preparing'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
</main>

{/* MODAL: ADD RECORD */}
{isAddModalOpen && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white w-full max-w-4xl rounded-[40px] p-10 shadow-2xl border border-white/20 overflow-y-auto max-h-[95vh] custom-scrollbar relative">
      
      {/* LOADING OVERLAY */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[110] flex flex-col items-center justify-center rounded-[40px] transition-all">
          <div className="w-12 h-12 border-4 border-[#005FB7]/20 border-t-[#005FB7] rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold text-[#005FB7] uppercase tracking-wider animate-pulse">Saving Batch Record...</p>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-8 tracking-tight text-[#1A1C1E]">New Request Record</h2>
      
      <form onSubmit={handleSaveRecord} className="space-y-6">
        {/* INPUT FIELDS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          
          {/* 1. Name of Requestor - Full Width */}
          <div className="space-y-2 md:col-span-6">
            <label className="text-xs font-semibold text-black ml-1">Name of Requestor</label>
            <input 
              name="borrowedBy" 
              placeholder="Full Name" 
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>

          {/* 2. Company Name - Half Width */}
          <div className="space-y-2 md:col-span-3">
            <label className="text-xs font-semibold text-black ml-1">Company Name</label>
            <input 
              name="companyName" 
              placeholder="e.g. ABC Corporation" 
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>

          {/* 3. Department Name - Half Width */}
          <div className="space-y-2 md:col-span-3">
            <label className="text-xs font-semibold text-black ml-1">Department</label>
            <input 
              name="departmentName" 
              placeholder="e.g. Marketing / Production" 
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>

          {/* 4. Purpose - Full Width */}
          <div className="space-y-2 md:col-span-6">
            <label className="text-xs font-semibold text-black ml-1">Purpose</label>
            <input 
              name="eventName" 
              placeholder="Enter the event or project title..." 
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>

          {/* 5. Date Requested - 1/3 Width (Updated to auto-fill today) */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-black ml-1">Date Requested</label>
            <input 
              name="purposeDate" 
              type="date" 
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>

          {/* 6. Pick Up Date - 1/3 Width */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-black ml-1">Pick Up Date</label>
            <input 
              name="claimDate" 
              type="date" 
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>

          {/* 7. Return Date - 1/3 Width */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-black ml-1">Return Date</label>
            <input 
              name="returnExpectedDate" 
              type="date" 
              className="w-full p-4 bg-[#F1F3F8] rounded-2xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7]/20 transition-all disabled:opacity-50" 
              required 
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* TABLE SECTION: DETAILED ITEM LIST */}
        <div className="border-t border-[#E0E2EC] pt-6 mt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h3 className="text-sm font-bold text-[#1A1C1E] uppercase tracking-wide">Items to be borrowed ({selectedItems.length})</h3>
            <div className="flex gap-2">
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => setIsItemPickerOpen(true)} 
                className="flex items-center gap-2 px-5 py-2.5 bg-[#F1F3F8] text-[#005FB7] text-xs font-bold rounded-xl cursor-pointer transition-all hover:bg-[#D6E3FF] disabled:opacity-50"
              >
                Browse Items
              </button>
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => setIsQRScannerOpen(true)} 
                className="flex items-center gap-2 px-5 py-2.5 bg-[#005FB7] text-white text-xs font-bold rounded-xl cursor-pointer transition-all hover:bg-[#004A8F] disabled:opacity-50"
              >
                Scan QR
              </button>
            </div>
          </div>

          {/* SEARCH TO ADD AUTOCOMPLETE */}
          <div className="relative mb-4 z-50">
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-[#74777F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text"
                placeholder="Type item name or code to quickly add..."
                value={itemSearchText}
                onChange={(e) => {
                  setItemSearchText(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)} 
                className="w-full p-3.5 pl-11 bg-white border border-[#E0E2EC] rounded-xl outline-none text-sm font-medium focus:ring-2 ring-[#005FB7] transition-all disabled:opacity-50 placeholder:text-[#74777F]"
              />
            </div>
            
            {showSuggestions && itemSearchText.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E0E2EC] rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar z-[60]">
                {(() => {
                  const searchResults = allItems
                    .filter(item => 
                      !selectedItems.some(selected => selected.id === item.id) &&
                      (item.itemName.toLowerCase().includes(itemSearchText.toLowerCase()) || 
                       item.itemCode.toLowerCase().includes(itemSearchText.toLowerCase()))
                    )
                    .sort((a, b) => a.id - b.id);

                  if (searchResults.length === 0) {
                    return <div className="p-4 text-center text-sm text-[#74777F] font-medium">No items match "{itemSearchText}"</div>;
                  }

                  return searchResults.map(item => {
                    const isAvailable = item.availabilityStatus === 'Available';
                    return (
                      <div 
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (isAvailable) {
                            setSelectedItems([...selectedItems, item]);
                            setItemSearchText("");
                            setShowSuggestions(false);
                          }
                        }}
                        className={`p-3 border-b border-[#F1F3F8] transition-colors flex justify-between items-center group ${
                          isAvailable ? "hover:bg-[#F8FAFF] cursor-pointer" : "opacity-60 cursor-not-allowed bg-gray-50"
                        }`}
                      >
                        <div>
                          <p className={`font-bold text-sm leading-tight ${isAvailable ? "text-[#1A1C1E]" : "text-[#74777F]"}`}>
                            {item.itemName}
                          </p>
                          <div className="flex flex-wrap gap-2 items-center mt-1.5">
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isAvailable ? "text-[#005FB7] bg-[#D6E3FF]" : "text-gray-500 bg-gray-200"}`}>
                              {item.itemCode}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              isAvailable ? "bg-[#C4EED0] text-[#002107]" : "bg-[#FAD2E1] text-[#7A0B2E]"
                            }`}>
                              {item.availabilityStatus}
                            </span>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          disabled={!isAvailable}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                            isAvailable 
                              ? "bg-[#F1F3F8] text-[#005FB7] group-hover:bg-[#005FB7] group-hover:text-white" 
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {isAvailable ? "+ Add" : "Unavailable"}
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* --- SMART SUGGESTIONS BLOCK --- */}
          {suggestedItems.length > 0 && (
            <div className="mb-6 bg-[#F8FAFF] border border-[#D6E3FF] rounded-2xl p-4 animate-in fade-in zoom-in duration-300">
              <h4 className="text-xs font-black text-[#005FB7] mb-3 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" /></svg>
                Suggested based on your selection
              </h4>
              <div className="flex flex-wrap gap-2">
                {suggestedItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItems([...selectedItems, item])}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#005FB7]/20 rounded-xl text-xs font-bold text-[#1A1C1E] shadow-sm hover:bg-[#005FB7] hover:text-white hover:border-[#005FB7] transition-all group cursor-pointer"
                  >
                    <span className="text-[#005FB7] group-hover:text-white mr-1 text-lg leading-none">+</span>
                    {item.itemName}
                    <span className="font-mono text-[10px] text-[#74777F] group-hover:text-blue-200">({item.itemCode})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SELECTED ITEMS TABLE */}
          <div className="bg-[#F8FAFF] rounded-[24px] border border-[#D6E3FF] overflow-hidden">
            {selectedItems.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#74777F] font-medium italic">Walang item na napili.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#EDF1FF] border-b border-[#D6E3FF]">
                    <tr className="text-xs font-bold uppercase text-[#44474E] tracking-wider">
                      <th className="px-6 py-4">Item Details</th>
                      <th className="px-6 py-4">Serial No.</th>
                      <th className="px-6 py-4">Condition</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6E3FF]">
                    {selectedItems.map(item => (
                      <tr key={item.id} className="text-sm font-medium text-[#1A1C1E] hover:bg-white/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold uppercase text-[#1A1C1E]">{item.itemName}</p>
                          <p className="text-xs font-mono font-semibold text-[#005FB7]">{item.itemCode}</p>
                        </td>
                        <td className="px-6 py-4 text-[#44474E] font-medium">
                          {item.serialNumber || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            item.deviceStatus === 'Working' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {item.deviceStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button 
                              type="button" 
                              disabled={isSubmitting}
                              onClick={() => setSelectedItems(selectedItems.filter(i => i.id !== item.id))} 
                              className="p-2 text-[#BA1A1A] cursor-pointer hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                            >
                              ✕
                            </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-4 pt-6">
          <button 
            type="button" 
            disabled={isSubmitting}
            onClick={() => { setSelectedItems([]); setIsAddModalOpen(false); setItemSearchText(""); }} 
            className="flex-1 text-sm font-bold text-[#44474E] uppercase cursor-pointer hover:bg-[#F1F3F8] py-4 rounded-2xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            disabled={isSubmitting || selectedItems.length === 0} 
            className="flex-[1.5] py-4 bg-[#005FB7] text-white rounded-2xl text-sm font-bold uppercase shadow-lg shadow-blue-200 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden relative"
          >
            <div className="flex items-center justify-center gap-3">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving Record...</span>
                </>
              ) : (
                <span>Confirm & Save Record</span>
              )}
            </div>
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL 1: FIXED ITEM PICKER (CLEAN & SORTED OLDEST FIRST) */}
      {isItemPickerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 text-sm">
          {/* Main Container */}
          <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl flex flex-col lg:flex-row h-[85vh] overflow-hidden border border-white/20 relative">
            
            {/* LEFT SIDE: SEARCH & SELECTION LIST */}
            <div className="flex-1 flex flex-col p-8 border-r border-[#E0E2EC] min-w-0 bg-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-2xl text-[#1A1C1E] tracking-normal">Select equipment</h3>
                  <p className="text-sm text-[#74777F] font-medium tracking-normal mt-1">Issuance selection</p>
                </div>
                
                {/* IMPROVED CLOSE BUTTON: Visible on all screens, positioned away from the sidebar */}
                <button 
                  onClick={() => setIsItemPickerOpen(false)} 
                  className="p-3 bg-[#F1F3F8] text-[#74777F] rounded-full cursor-pointer hover:bg-[#E2E2E6] hover:text-[#BA1A1A] transition-all shadow-sm"
                  title="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* SEARCH */}
              <div className="relative mb-6">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#74777F]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder="Search item code or name..." 
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full bg-[#F1F3F8] rounded-2xl py-4 pl-12 pr-4 outline-none font-medium text-sm focus:ring-2 ring-[#005FB7]/20 transition-all"
                />
              </div>

              {/* CATEGORIES */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-4 custom-scrollbar">
                {categories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setActiveCategory(cat)} 
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap border-2 cursor-pointer transition-all tracking-normal
                      ${activeCategory === cat ? "bg-[#005FB7] border-[#005FB7] text-white shadow-lg" : "bg-white border-[#E0E2EC] text-[#44474E] hover:border-[#005FB7]/30"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* SCROLLABLE ITEM LIST */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {filteredPickerItems.map(item => {
                  const isSelected = selectedItems.find(i => i.id === item.id);
                  const isAvailable = item.availabilityStatus === "Available";
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => isAvailable && handleToggleItem(item)} 
                      className={`grid grid-cols-[1fr_auto] items-center p-5 rounded-[28px] border-2 transition-all tracking-normal
                        ${isSelected ? "bg-[#D6E3FF] border-[#005FB7]" : "bg-white border-[#E0E2EC]"} 
                        ${!isAvailable ? "opacity-40 grayscale cursor-not-allowed" : "hover:border-[#005FB7]/40 cursor-pointer active:scale-[0.98]"}`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-base text-[#1A1C1E] leading-tight">{item.itemName}</p>
                          <p className="text-xs font-semibold text-[#005FB7]">{item.itemCode}</p>
                        </div>
                        <div className="text-xs font-semibold text-[#44474E] flex flex-col justify-center gap-1">
                          <p><span className="text-[#74777F] font-bold text-[10px]">Serial:</span> {item.serialNumber || 'N/A'}</p>
                          <div className="flex gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.deviceStatus === 'Working' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {item.deviceStatus}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isAvailable ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {item.availabilityStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="pl-4">
                        {isSelected && <div className="w-8 h-8 bg-[#005FB7] rounded-full flex items-center justify-center text-white shadow-lg">✓</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT SIDE: SIDEBAR (SELECTED LIST) */}
            <div className="w-full lg:w-85 bg-[#F7F9FF] p-8 flex flex-col h-full border-t lg:border-t-0 border-[#E0E2EC]">
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-bold text-sm text-[#74777F] tracking-normal">Selected list</h4>
                <span className="bg-[#005FB7] text-white text-xs font-bold px-3 py-1 rounded-full">
                  {selectedItems.length} items
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {selectedItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <p className="text-sm font-bold tracking-normal leading-tight">No items<br/>selected yet</p>
                  </div>
                ) : (
                  selectedItems.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#D6E3FF] flex justify-between items-center group animate-in slide-in-from-right-4">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate text-[#1A1C1E] tracking-normal">{item.itemName}</p>
                        <p className="text-xs font-semibold text-[#005FB7] tracking-normal">{item.itemCode}</p>
                      </div>
                      <button 
                        onClick={() => handleToggleItem(item)} 
                        className="p-2 text-[#BA1A1A] hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-8 space-y-3">
                <button 
                  onClick={() => setIsItemPickerOpen(false)} 
                  className="w-full py-5 bg-[#1A1C1E] text-white rounded-[24px] font-bold text-sm tracking-normal shadow-xl hover:bg-black transition-all cursor-pointer active:scale-95"
                >
                  Done selecting
                </button>
                <button 
                  onClick={() => setSelectedItems([])}
                  className="w-full text-xs font-bold text-[#74777F] tracking-normal hover:text-[#BA1A1A] cursor-pointer"
                >
                  Clear selection
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

{/* MODAL 2: ENHANCED CONTINUOUS QR SCANNER */}
      {isQRScannerOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-5xl rounded-[40px] flex flex-col lg:flex-row h-[85vh] overflow-hidden shadow-2xl border border-white/20">
            
            {/* LEFT SECTION: CAMERA VIEWPORT */}
            <div className="flex-1 p-8 bg-white flex flex-col items-center justify-between">
              <div className="w-full flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-2xl text-[#1A1C1E] tracking-tight">Smart QR Scanner</h3>
                  <p className="text-xs text-[#74777F] font-medium">I-tapat ang QR code sa camera para sa automatic detection.</p>
                </div>
                <button onClick={() => setIsQRScannerOpen(false)} className="lg:hidden p-3 bg-[#F1F3F8] rounded-full cursor-pointer hover:bg-[#E2E2E6] transition-colors">✕</button>
              </div>

              {/* VIEWPORT AREA */}
              <div className="relative w-full aspect-square max-w-[420px] overflow-hidden rounded-[40px] bg-black border-[12px] border-[#F1F3F8] shadow-2xl group">
                <div id="reader" className="w-full h-full"></div>
                
                {/* SCANNING OVERLAYS */}
                <div className="absolute inset-0 border-[30px] border-black/30 pointer-events-none"></div>
                
                {/* CORNER BRACKETS */}
                <div className="absolute top-10 left-10 w-10 h-10 border-t-4 border-l-4 border-[#005FB7] rounded-tl-xl"></div>
                <div className="absolute top-10 right-10 w-10 h-10 border-t-4 border-r-4 border-[#005FB7] rounded-tr-xl"></div>
                <div className="absolute bottom-10 left-10 w-10 h-10 border-b-4 border-l-4 border-[#005FB7] rounded-bl-xl"></div>
                <div className="absolute bottom-10 right-10 w-10 h-10 border-b-4 border-r-4 border-[#005FB7] rounded-br-xl"></div>

                {/* ANIMATED SCAN LINE */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#005FB7] shadow-[0_0_20px_#005FB7] animate-scan z-10"></div>
                
                {/* STATUS INDICATOR */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Scanner Active</span>
                </div>
              </div>

              {/* HELPER TEXT */}
              <p className="text-[10px] text-[#74777F] font-bold uppercase tracking-tighter mt-4 text-center">
                Maaaring mag-scan ng maraming items nang sunod-sunod.
              </p>
            </div>

            {/* RIGHT SECTION: SCANNED ITEMS SIDEBAR */}
            <div className="w-full lg:w-85 bg-[#F7F9FF] p-8 flex flex-col border-t lg:border-t-0 lg:border-l border-[#E0E2EC]">
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-black text-xs text-[#74777F] uppercase tracking-[0.2em]">Scanned Batch</h4>
                <div className="bg-[#005FB7] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-blue-100 animate-in zoom-in">
                  {selectedItems.length} Items
                </div>
              </div>

              {/* LIST AREA */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {selectedItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#44474E" strokeWidth="1.5" className="mb-4"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10"></rect></svg>
                    <p className="text-[10px] font-black uppercase tracking-widest">No items scanned yet</p>
                  </div>
                ) : (
                  [...selectedItems].reverse().map(item => (
                    <div 
                      key={item.id} 
                      className="bg-white p-4 rounded-2xl shadow-sm border border-[#D6E3FF] flex justify-between items-center group animate-in slide-in-from-right-4 duration-300"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-[11px] truncate uppercase text-[#1A1C1E] leading-tight">{item.itemName}</p>
                        <p className="text-[9px] font-mono font-bold text-[#005FB7]">{item.itemCode}</p>
                      </div>
                      <button 
                        onClick={() => handleToggleItem(item)} 
                        className="p-2 text-[#BA1A1A] hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        title="Remove item"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* ACTION AREA */}
              <div className="mt-8 space-y-4">
                <button 
                  onClick={() => setIsQRScannerOpen(false)} 
                  className="w-full py-5 bg-[#1A1C1E] text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl cursor-pointer hover:bg-black transition-all active:scale-95"
                >
                  Finish Scanning
                </button>
                <div className="flex items-center justify-center gap-2 opacity-50">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                   <span className="text-[8px] font-black uppercase tracking-tighter">Verified Secured Scan</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

{/* MODAL 3: VIEW ALL RECORD / BATCH PREVIEW */}
{isDetailModalOpen && selectedBatch && (
  <>
    {/* 1. BULK CONFIRMATION MODAL */}
    {showBulkConfirm && (
      <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white border-2 border-[#BA1A1A] p-6 md:p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center space-y-6">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-[#FFDAD6] text-[#BA1A1A] rounded-full flex items-center justify-center mx-auto">
            {isProcessing ? (
              <div className="w-8 h-8 border-4 border-[#BA1A1A] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            )}
          </div>
          <div>
            <h4 className="text-xl font-bold text-[#1A1C1E]">Confirm Bulk Return</h4>
            <p className="text-[#44474E] mt-2 font-medium text-sm md:text-base">Are you sure? This will mark all items in this batch as returned for today's date.</p>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  const today = new Date().toISOString().split('T')[0];
                  const updatedItems = selectedBatch.items.map((i: any) => ({ ...i, dateReturned: today, requestStatus: "Returned" }));
                  setSelectedBatch({ ...selectedBatch, items: updatedItems, status: "Returned" });
                  const logIds = updatedItems.map((i: any) => i.id);
                  for (const item of updatedItems) {
                    await updateSingleLogEntry(item.id, item.itemId, { requestStatus: "Returned", dateReturned: today });
                  }
                  await updateBatchStatus(logIds, "Returned");
                  await fetchData();
                  setShowBulkConfirm(false);
                } finally { setIsProcessing(false); }
              }}
              className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#BA1A1A] text-white active:scale-95 cursor-pointer'}`}
            >
              {isProcessing ? 'Processing...' : 'Yes, Mark All Returned'}
            </button>
            <button disabled={isProcessing} onClick={() => setShowBulkConfirm(false)} className="w-full py-3 bg-gray-100 text-[#1A1C1E] font-bold uppercase tracking-wider text-[11px] hover:bg-gray-200 rounded-xl transition-all cursor-pointer">Go Back</button>
          </div>
        </div>
      </div>
    )}

    {/* 2. QR SCANNER MODAL OVERLAY */}
    {showQRScanner && (
      <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
        <div className="bg-[#1A1C1E] text-white p-6 md:p-8 rounded-[40px] shadow-2xl max-w-md w-full border border-white/10 relative">
          
          {/* Close Button Top Right */}
          <button 
            onClick={() => setShowQRScanner(false)} 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer z-10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>

          <div className="text-center space-y-6">
            <div className="relative w-36 h-36 mx-auto border-2 border-blue-500/50 rounded-3xl flex items-center justify-center overflow-hidden bg-black">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/40 to-transparent h-1 w-full" style={{ animation: 'scan 2s infinite linear' }} />
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-blue-400/50"><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-bold tracking-tight">QR Multi-Scanner</h4>
              <p className="text-gray-400 text-xs font-medium">Scan items one after another. Scanner remains active.</p>
            </div>

            <input 
              autoFocus
              placeholder="Waiting for scan..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-center text-blue-400 font-mono text-lg outline-none focus:ring-2 ring-blue-500/50 transition-all placeholder:text-gray-600"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const scannedCode = e.currentTarget.value.trim();
                  if (!scannedCode) return;

                  const matchedItem = selectedBatch.items.find((i: any) => i.itemCode === scannedCode);
                  
                  if (matchedItem) {
                    // 1. Play Success Sound (Web Audio API)
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep
                    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    oscillator.start();
                    oscillator.stop(audioCtx.currentTime + 0.1);

                    const today = new Date().toISOString().split('T')[0];
                    
                    // 2. Update UI
                    const updatedItems = selectedBatch.items.map((i: any) => 
					  i.itemCode === scannedCode ? { ...i, requestStatus: "Returned", dateReturned: today } : i
					);
                    setSelectedBatch({ ...selectedBatch, items: updatedItems });
                    
                    // 3. Reset Input for Continuous Scanning
                    e.currentTarget.value = "";
                    
                    // 4. Update Database
                    await updateSingleLogEntry(matchedItem.id, matchedItem.itemId, { requestStatus: "Returned", dateReturned: today });
                    await fetchData();
                  } else {
                    setShowScanError(true);
                    e.currentTarget.value = ""; 
                  }
                }
              }}
            />

            {/* LIVE FEED OF SCANNED ITEMS */}
            <div className="text-left pt-2">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Scanned Items</p>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                  {selectedBatch.items.filter((i: any) => i.requestStatus === "Returned").length} Scanned
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto custom-scrollbar-dark space-y-2 pr-2">
                {selectedBatch.items.filter((i: any) => i.requestStatus === "Returned").length > 0 ? (
                  [...selectedBatch.items].filter(i => i.requestStatus === "Returned").reverse().map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white truncate max-w-[180px]">{item.itemName}</span>
                        <span className="text-[9px] font-mono text-gray-500">{item.itemCode}</span>
                      </div>
                      <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center opacity-30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2"><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
                    <p className="text-[10px] font-bold">Waiting for input...</p>
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => setShowQRScanner(false)} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-[2px] transition-all rounded-2xl cursor-pointer border border-white/5">Done</button>
          </div>
        </div>
      </div>
    )}

    {/* 3. ITEM NOT FOUND ERROR MODAL */}
    {showScanError && (
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white p-8 rounded-[32px] shadow-2xl max-w-xs w-full text-center space-y-5 ">
          <div className="w-16 h-16 bg-[#FFDAD6] text-[#BA1A1A] rounded-2xl flex items-center justify-center mx-auto rotate-3">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-black text-[#1A1C1E] uppercase">Item Not Found</h4>
            <p className="text-[#44474E] text-xs font-medium">The scanned code does not match any items in this record sheet.</p>
          </div>
          <button onClick={() => { setShowScanError(false); }} className="w-full py-3 bg-[#1A1C1E] text-white rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all cursor-pointer">Continue Scanning</button>
        </div>
      </div>
    )}

    {/* MAIN RECORD MODAL */}
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md md:p-4 text-sm">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 10px; }
        .custom-scrollbar-dark::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>

      <div className="bg-[#F8FAFF] md:bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-white/20 relative md:max-h-[95vh]">
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
          <div className="mb-6 border-b pb-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl md:text-3xl font-bold text-[#1A1C1E]">Record Sheet</h2>
                <p className="text-[9px] md:text-[10px] text-[#74777F] font-bold uppercase tracking-widest italic">Live Preview & Management</p>
              </div>
              <button onClick={() => { setIsDetailModalOpen(false); setEditingCell(null); }} className="p-2 text-[#74777F] hover:bg-[#F1F3F8] rounded-full transition-colors cursor-pointer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 items-start">
              <div className="md:col-span-4 space-y-5">
                <div onDoubleClick={() => setEditingCell({ id: 'header', field: 'requestorName' })}>
                  <p className="text-[10px] md:text-[11px] font-black text-[#74777F] uppercase tracking-wider mb-1">Name of Requestor</p>
                  {editingCell?.id === 'header' && editingCell?.field === 'requestorName' ? (
                    <input autoFocus className="w-full bg-blue-50 border border-blue-300 rounded-lg px-3 py-1 font-bold outline-none text-sm" defaultValue={selectedBatch.requestorName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} onBlur={async (e) => {
                      const val = e.target.value;
                      if (val === selectedBatch.requestorName) return setEditingCell(null);
                      setSelectedBatch({ ...selectedBatch, requestorName: val });
                      setEditingCell(null);
                      await updateSessionBatch(selectedBatch.sessionId, { requestorName: val });
                      await fetchData();
                    }} />
                  ) : ( <p className="font-bold text-[#1A1C1E] text-base md:text-lg cursor-text">{selectedBatch.requestorName || '---'}</p> )}
                </div>
                <div>
                  <p className="text-[10px] md:text-[11px] font-black text-[#74777F] uppercase tracking-wider mb-1">Company & Dept</p>
                  <div className="flex items-center gap-2">
                     <div onDoubleClick={() => setEditingCell({ id: 'header', field: 'companyName' })}>
                        {editingCell?.id === 'header' && editingCell?.field === 'companyName' ? (
                          <input autoFocus className="w-20 bg-blue-50 border border-blue-300 rounded px-2 py-1 font-bold text-xs" defaultValue={selectedBatch.companyName} onBlur={async (e) => {
                            const val = e.target.value;
                            setSelectedBatch({ ...selectedBatch, companyName: val });
                            setEditingCell(null);
                            await updateSessionBatch(selectedBatch.sessionId, { companyName: val });
                            await fetchData();
                          }} />
                        ) : ( <p className="font-bold text-[#1A1C1E] text-sm md:text-base cursor-text">{selectedBatch.companyName}</p> )}
                     </div>
                     <span className="text-gray-300 font-bold">•</span>
                     <div onDoubleClick={() => setEditingCell({ id: 'header', field: 'departmentName' })}>
                        {editingCell?.id === 'header' && editingCell?.field === 'departmentName' ? (
                          <input autoFocus className="w-20 bg-blue-50 border border-blue-300 rounded px-2 py-1 font-bold text-xs" defaultValue={selectedBatch.departmentName} onBlur={async (e) => {
                            const val = e.target.value;
                            setSelectedBatch({ ...selectedBatch, departmentName: val });
                            setEditingCell(null);
                            await updateSessionBatch(selectedBatch.sessionId, { departmentName: val });
                            await fetchData();
                          }} />
                        ) : ( <p className="font-bold text-[#1A1C1E] text-sm md:text-base cursor-text">{selectedBatch.departmentName}</p> )}
                     </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 space-y-1" onDoubleClick={() => setEditingCell({ id: 'header', field: 'purposeTitle' })}>
                <p className="text-[10px] md:text-[11px] font-black text-[#74777F] uppercase tracking-wider">Purpose / Event</p>
                {editingCell?.id === 'header' && editingCell?.field === 'purposeTitle' ? (
                  <textarea autoFocus className="w-full bg-blue-50 border border-blue-300 rounded-lg px-3 py-2 font-bold text-sm outline-none resize-none" rows={2} defaultValue={selectedBatch.purposeTitle} onBlur={async (e) => {
                    const val = e.target.value;
                    setSelectedBatch({ ...selectedBatch, purposeTitle: val });
                    setEditingCell(null);
                    await updateSessionBatch(selectedBatch.sessionId, { purposeTitle: val });
                    await fetchData();
                  }} />
                ) : ( <p className="font-bold text-[#1A1C1E] leading-relaxed cursor-text text-sm md:text-base">{selectedBatch.purposeTitle}</p> )}
              </div>

              <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
                <div><p className="text-[10px] md:text-[11px] font-black text-[#74777F] uppercase tracking-wider mb-1">Date Requested</p><p className="font-bold text-[#1A1C1E] text-sm">{selectedBatch.dateRequested}</p></div>
                <div>
                  <p className="text-[10px] md:text-[11px] font-black text-[#74777F] uppercase tracking-wider mb-1">Status</p>
                  <select value={selectedBatch.status} onChange={async (e) => {
                    const newStatus = e.target.value;
                    const logIds = selectedBatch.items.map((i) => i.id);
                    if (newStatus === "In used/Not Yet Returned") {
                       const resetItems = selectedBatch.items.map((i) => ({ ...i, requestStatus: "Not Yet Returned", dateReturned: null }));
                       setSelectedBatch({ ...selectedBatch, status: newStatus, items: resetItems });
                       for (const item of resetItems) { await updateSingleLogEntry(item.id, item.itemId, { requestStatus: "Not Yet Returned", dateReturned: null }); }
                    } else { setSelectedBatch({ ...selectedBatch, status: newStatus }); }
                    await updateBatchStatus(logIds, newStatus);
                    await fetchData();
                  }} className="w-full bg-gray-100 border-none rounded-lg px-2 py-1.5 md:px-4 md:py-2.5 font-bold text-black text-xs outline-none shadow-sm cursor-pointer">
                    <option value="Preparing">Preparing</option>
                    <option value="Ready for Pickup">Ready for Pickup</option>
                    <option value="In used/Not Yet Returned">Not Yet Returned</option>
                    <option value="Returned">Returned</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black">Items</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowQRScanner(true)} className="text-[10px] md:text-[10px] font-bold text-[#005FB7] uppercase tracking-wider hover:bg-[#D0E4FF] transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-[#E8F0FF] rounded-lg border border-[#ADCFFF] active:scale-95 shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 7h10v10H7z"/></svg>
                  Use QR Scanner
                </button>
                <button onClick={() => setShowBulkConfirm(true)} className="text-[9px] md:text-[10px] font-bold text-[#006E33] uppercase tracking-wider hover:text-[#005326] transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-[#C4EED0] rounded-lg border border-[#A6D6B8] active:scale-95 shadow-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Mark All as Returned
                </button>
              </div>
            </div>

            {/* MOBILE: CARD GRID */}
            <div className="grid grid-cols-1 gap-3 md:hidden mb-6">
              {selectedBatch.items.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-[#E0E2EC] shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                    <div className="max-w-[60%]"><p className="font-bold text-black text-xs uppercase truncate">{item.itemName}</p><p className="text-[10px] font-bold text-blue-600">{item.itemCode}</p></div>
                    <div className="text-right"><p className="text-[8px] font-black text-[#74777F] uppercase">Serial</p><p className="font-semibold text-[#1A1C1E] text-[10px]">{item.serialNumber || '---'}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <select value={item.requestStatus} onChange={async (e) => {
                      const newStatus = e.target.value;
                      const today = new Date().toISOString().split('T')[0];
                      const dateVal = newStatus === "Returned" ? today : null;
                      const updatedItems = selectedBatch.items.map((i) => i.id === item.id ? { ...i, requestStatus: newStatus, dateReturned: dateVal } : i );
                      setSelectedBatch({ ...selectedBatch, items: updatedItems });
                      await updateSingleLogEntry(item.id, item.itemId, { requestStatus: newStatus, dateReturned: dateVal });
                      await fetchData();
                    }} className={`w-full px-2 py-2 rounded-xl text-[9px] font-black uppercase outline-none text-center cursor-pointer ${item.requestStatus === 'Returned' ? 'bg-[#C4EED0] text-[#002107]' : item.requestStatus === 'Missing' ? 'bg-[#FFECB3] text-[#7F5100]' : 'bg-[#FFDAD6] text-[#BA1A1A]'}`}>
                      <option value="Not Yet Returned">Not Yet Returned</option><option value="Returned">Returned</option><option value="Missing">Missing</option>
                    </select>
                    <input type="date" className="w-full bg-[#F1F3F8] rounded-xl px-2 py-1.5 text-[10px] font-bold outline-none text-center" value={item.dateReturned || ""} onChange={async (e) => {
                      const val = e.target.value;
                      const updatedItems = selectedBatch.items.map((i) => i.id === item.id ? { ...i, dateReturned: val || null, requestStatus: val ? "Returned" : "Not Yet Returned" } : i );
                      setSelectedBatch({ ...selectedBatch, items: updatedItems });
                      await updateSingleLogEntry(item.id, item.itemId, { dateReturned: val || null, requestStatus: val ? "Returned" : "Not Yet Returned" });
                      await fetchData();
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP: TABLE */}
            <div className="hidden md:block rounded-3xl border border-[#E0E2EC] bg-white overflow-hidden mb-4">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-[#F1F3F8] border-b border-[#E0E2EC]"><tr className="text-[10px] font-black text-[#44474E] uppercase tracking-widest"><th className="px-6 py-4 w-[25%]">Item Details</th><th className="px-6 py-4 w-[20%]">Serial Number</th><th className="px-6 py-4 w-[25%]">Item Status</th><th className="px-6 py-4 w-[30%]">Date Returned</th></tr></thead>
                <tbody className="divide-y divide-[#E0E2EC]">
                  {selectedBatch.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFF] transition-colors">
                      <td className="px-6 py-4"><div><p className="font-bold text-black uppercase text-xs leading-tight">{item.itemName}</p><p className="text-[11px] font-bold text-blue-600 mt-0.5">{item.itemCode}</p></div></td>
                      <td className="px-6 py-4"><span className="font-semibold text-[#74777F]">{item.serialNumber || '---'}</span></td>
                      <td className="px-6 py-4">
                        <select value={item.requestStatus} onChange={async (e) => {
                          const newStatus = e.target.value;
                          const today = new Date().toISOString().split('T')[0];
                          const dateVal = newStatus === "Returned" ? today : null;
                          const updatedItems = selectedBatch.items.map((i) => i.id === item.id ? { ...i, requestStatus: newStatus, dateReturned: dateVal } : i );
                          setSelectedBatch({ ...selectedBatch, items: updatedItems });
                          await updateSingleLogEntry(item.id, item.itemId, { requestStatus: newStatus, dateReturned: dateVal });
                          await fetchData();
                        }} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase cursor-pointer outline-none transition-all ${item.requestStatus === 'Returned' ? 'bg-[#C4EED0] text-[#002107]' : item.requestStatus === 'Missing' ? 'bg-[#FFECB3] text-[#7F5100]' : 'bg-[#FFDAD6] text-[#BA1A1A]'}`}>
                          <option value="Not Yet Returned">Not Yet Returned</option><option value="Returned">Returned</option><option value="Missing">Missing</option>
                        </select>
                      </td>
                      <td className="px-6 py-4"><input type="date" className="bg-[#F1F3F8] border-none rounded-lg px-3 py-2 text-xs font-bold outline-none w-full" value={item.dateReturned || ""} onChange={async (e) => {
                        const val = e.target.value;
                        const updatedItems = selectedBatch.items.map((i) => i.id === item.id ? { ...i, dateReturned: val || null, requestStatus: val ? "Returned" : "Not Yet Returned" } : i );
                        setSelectedBatch({ ...selectedBatch, items: updatedItems });
                        await updateSingleLogEntry(item.id, item.itemId, { dateReturned: val || null, requestStatus: val ? "Returned" : "Not Yet Returned" });
                        await fetchData();
                      }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 md:px-10 md:pb-10 md:pt-6 bg-white border-t border-[#E0E2EC] flex justify-end">
          <button onClick={() => { setIsDetailModalOpen(false); setEditingCell(null); }} className="w-full md:w-auto px-10 py-3.5 md:py-4 bg-[#1A1C1E] text-white rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-widest active:scale-95 shadow-xl hover:bg-black transition-all cursor-pointer">Close Record Sheet</button>
        </div>
      </div>
    </div>
  </>
)}
      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-[#1A1C1E]/60 z-40 lg:hidden backdrop-blur-sm" />
      )}

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-[#1A1C1E]/80 flex items-center justify-center p-4 z-[110] backdrop-blur-md">
          <div className="bg-white p-10 rounded-[40px] max-w-md w-full shadow-2xl border border-[#E0E2EC]">
            <h3 className="text-2xl font-bold mb-4 text-[#BA1A1A]">Sign Out</h3>
            <p className="text-[#44474E] text-sm leading-relaxed mb-10 font-medium">Are you sure you want to end your session?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-4 text-[#44474E] font-bold text-xs uppercase tracking-widest hover:bg-[#F1F3F8] rounded-2xl transition-all cursor-pointer">Cancel</button>
              <button onClick={handleLogout} className="flex-1 py-4 bg-[#BA1A1A] text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-[#93000A] transition-all cursor-pointer">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
