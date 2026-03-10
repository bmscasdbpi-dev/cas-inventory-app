"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getItemByCode } from "../actions/itemActions"; 
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";

export default function VerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemCodeFromUrl = searchParams.get("c");

  // --- STATES ---
  const [searchCode, setSearchCode] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isInvalidModalOpen, setIsInvalidModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIAL CHECK ---
  useEffect(() => {
    if (itemCodeFromUrl) handleSearch(itemCodeFromUrl);
  }, [itemCodeFromUrl]);

  // --- LOGIC: EXTRACT CODE FROM QR (RAW OR LINK) ---
  const processScannedText = (text: string) => {
    let finalCode = text.trim();
    // Kung ang QR ay may URL (hal. https://inventory.com/?c=CA-001)
    if (text.includes("?c=")) {
      try {
        const urlParts = text.split("?c=");
        if (urlParts[1]) {
          finalCode = urlParts[1].split("&")[0];
        }
      } catch (e) {
        console.error("Error parsing QR link:", e);
      }
    }
    return finalCode;
  };

  // --- LOGIC: CAMERA SCANNER ---
  useEffect(() => {
    let scanner: Html5QrcodeScanner;
    if (showScanner) {
      scanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: 280 }, false);
      scanner.render((text) => {
        const code = processScannedText(text);
        setSearchCode(code);
        handleSearch(code);
        setShowScanner(false);
        scanner.clear();
      }, () => {});
    }
    return () => { if (scanner) scanner.clear().catch(() => {}); };
  }, [showScanner]);

  // --- LOGIC: IMAGE UPLOAD SCAN ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingImage(true);
    // Gagawa ng temporary hidden reader para sa file scanning
    const html5QrCode = new Html5Qrcode("hidden-reader");

    try {
      const text = await html5QrCode.scanFile(file, true);
      const code = processScannedText(text);
      setSearchCode(code);
      handleSearch(code);
    } catch (err) {
      setIsInvalidModalOpen(true); // Invalid QR image
    } finally {
      setIsParsingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- LOGIC: DATABASE SEARCH ---
  async function handleSearch(codeToSearch?: string) {
    const code = codeToSearch || searchCode;
    if (!code) return;
    setLoading(true);
    
    const cleanCode = code.trim().toUpperCase();
    const item = await getItemByCode(cleanCode);
    
    if (item) {
      setSelectedItem(item);
      router.push(`?c=${cleanCode}`, { scroll: false });
    } else {
      setIsInvalidModalOpen(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-[#1A1C1E] p-4 md:p-8 tracking-normal">
      <div className="max-w-6xl mx-auto">
        
        {/* Hidden element used by the library for image scanning */}
        <div id="hidden-reader" className="hidden"></div>

        {/* --- VIEW 1: MATERIAL DESIGN 3 SEARCH SCREEN --- */}
        {!selectedItem && !showScanner && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full max-w-sm text-center">
              
              <div className="inline-flex p-6 bg-[#D3E3FD] text-[#001C38] rounded-[28px] mb-8 shadow-sm">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>

              <h1 className="text-3xl font-medium mb-3">Item verification</h1>
              <p className="text-[#44474E] text-sm mb-10 leading-relaxed">Enter a code, use your camera, or upload an image to verify equipment details.</p>

              <div className="space-y-4">
                {/* Input Field */}
                <input 
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter item code" 
                  className="w-full bg-transparent border-2 border-[#74777F] p-4 rounded-2xl outline-none text-base font-medium focus:border-[#005FB7] focus:border-2 transition-all text-center tracking-normal"
                />
                
                {/* Main Verify Button */}
                <button 
                  onClick={() => handleSearch()}
                  disabled={loading || !searchCode || isParsingImage}
                  className="w-full bg-[#005FB7] text-white py-4 rounded-full font-semibold text-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3"
                >
                  {loading || isParsingImage ? (
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : "Verify code"}
                </button>

                <div className="relative py-6 flex items-center">
                  <div className="flex-grow border-t border-[#C4C7C5]"></div>
                  <span className="flex-shrink mx-4 text-xs font-medium text-[#44474E]">or</span>
                  <div className="flex-grow border-t border-[#C4C7C5]"></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Camera Button */}
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="bg-[#D3E3FD] text-[#001C38] py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#C1D8FB] transition-colors cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Camera
                  </button>

                  {/* Image Upload Button */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#D3E3FD] text-[#001C38] py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#C1D8FB] transition-colors cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: DEDICATED SCANNER SCREEN --- */}
        {showScanner && (
          <div className="fixed inset-0 bg-[#FDFBFF] z-[100] flex flex-col animate-in slide-in-from-bottom-full duration-500">
            <div className="p-6 flex items-center gap-4 border-b border-[#E0E2EC] bg-white">
              <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-[#F1F3F8] rounded-full transition-colors cursor-pointer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#44474E" strokeWidth="2.5"><path d="M19 12H5m7 7l-7-7 7-7"/></svg>
              </button>
              <h2 className="text-xl font-medium tracking-normal">Scan QR code</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 bg-[#F0F4F9]">
              <div className="w-full max-w-sm bg-white p-4 rounded-[32px] shadow-2xl border border-[#D3E3FD] overflow-hidden">
                <div id="reader" className="rounded-2xl overflow-hidden bg-black aspect-square"></div>
              </div>
              <p className="text-[#44474E] text-sm text-center font-medium px-10">Point the camera at the item's QR code to verify automatically.</p>
              <button 
                onClick={() => setShowScanner(false)} 
                className="px-10 py-4 bg-[#1A1C1E] text-white rounded-full font-bold text-xs tracking-normal cursor-pointer active:scale-95 transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        )}

{/* --- VIEW 3: VERIFIED DETAILS SCREEN (M3 REDESIGN) --- */}
        {selectedItem && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Navigation & Badge */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <button 
                onClick={() => { setSelectedItem(null); router.push('?', {scroll:false}); }}
                className="inline-flex items-center gap-3 text-[#005FB7] font-semibold hover:bg-[#D3E3FD]/30 p-2 pr-6 rounded-full transition-all cursor-pointer group"
              >
                <div className="p-3 bg-white rounded-full border border-[#E0E2EC] shadow-sm group-hover:shadow-md transition-shadow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5m7 7l-7-7 7-7"/></svg>
                </div>
                <span>Go Back</span>
              </button>
              
              <div className="px-6 py-2.5 bg-[#C4EED0] text-[#002107] rounded-full text-sm font-semibold flex items-center gap-3 border border-[#002107]/5 self-start shadow-sm">
                <div className="w-2 h-2 bg-[#002107] rounded-full animate-pulse"></div> 
                Official verified record
              </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-[40px] shadow-sm border border-[#E0E2EC] overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                
                {/* Details Side (7 Cols) */}
                <div className="lg:col-span-7 p-8 md:p-12 space-y-10">
                  <header>
                    <p className="text-xs font-bold text-[#005FB7] mb-3 uppercase tracking-wider">Device identification</p>
                    <h1 className="text-4xl font-medium text-[#1A1C1E] mb-3 tracking-normal">{selectedItem.itemName}</h1>
                    <div className="inline-block px-4 py-2 bg-[#F1F3F8] rounded-xl font-bold text-[#44474E] text-xs">
                      {selectedItem.itemCode}
                    </div>
                  </header>

                  {/* Tonal Data Grid (4 core fields) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Operating status", value: selectedItem.deviceStatus || "Working", color: "text-green-700 font-bold italic" },
                      { label: "Category type", value: selectedItem.itemType || "Equipment" },
                      { label: "Official serial", value: selectedItem.serialNumber || "—" },
                      { label: "Storage zone", value: selectedItem.locationStored || "—" }
                    ].map((info, idx) => (
                      <div key={idx} className="bg-[#F7F9FF] p-6 rounded-[28px] border border-[#D3E3FD]/30 hover:border-[#005FB7]/20 transition-colors">
                        <p className="text-xs font-semibold text-[#74777F] mb-2">{info.label}</p>
                        <p className={`text-base font-medium ${info.color || "text-[#1A1C1E]"}`}>{info.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Long Text Records (Maintenance & Remarks) */}
                  <div className="space-y-6 pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#74777F" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        <h4 className="text-sm font-semibold text-[#44474E]">Maintenance history</h4>
                      </div>
                      <div className="p-7 bg-[#FDFBFF] border border-[#E0E2EC] rounded-[32px] text-sm leading-relaxed text-[#44474E] shadow-inner">
                        {selectedItem.maintenanceRecords || "No logged maintenance history available for this unit."}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#74777F" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <h4 className="text-sm font-semibold text-[#44474E]">Additional remarks</h4>
                      </div>
                      <div className="p-7 bg-[#FDFBFF] border border-[#E0E2EC] rounded-[32px] text-sm leading-relaxed text-[#44474E] italic shadow-inner">
                        {selectedItem.remarks || "No additional remarks or notes provided."}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF/Document Preview Side (5 Cols) */}
                <div className="lg:col-span-5 bg-[#F7F9FF] p-8 md:p-12 flex flex-col items-center border-l border-[#E0E2EC]/50">
                  <p className="text-sm font-semibold text-[#74777F] mb-8">Digital documentation</p>
                  
                  {(() => {
                    const fileIdMatch = selectedItem?.gdriveLink?.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
                    const fileId = fileIdMatch ? fileIdMatch[1] : null;

                    if (fileId) {
                      return (
                        <div className="relative w-full rounded-[40px] border border-[#D3E3FD] bg-white shadow-2xl overflow-hidden h-[600px] hover:scale-[1.01] transition-transform">
                           <iframe 
                             src={`https://drive.google.com/file/d/${fileId}/preview`} 
                             className="absolute inset-0 w-full h-full border-0" 
                             allow="autoplay"
                           ></iframe>
                        </div>
                      );
                    }
                    return (
                      <div className="h-[600px] w-full flex flex-col items-center justify-center border-2 border-dashed border-[#D3E3FD] rounded-[40px] bg-white/50 text-[#74777F] p-10 text-center">
                        <div className="p-6 bg-white rounded-full mb-6 shadow-sm">
                          <svg className="opacity-20" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                        </div>
                        <p className="font-medium opacity-50 text-sm">No digital documentation attached for this specific record.</p>
                      </div>
                    );
                  })()}
                  
                  {/* Quick Action Button for Mobile PDF */}
                  {selectedItem?.gdriveLink && (
                    <a 
                      href={selectedItem.gdriveLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-8 inline-flex items-center gap-2 text-[#005FB7] text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer"
                    >
                      Open in Google Drive ➔
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INVALID MODAL (M3 STYLE) */}
      {isInvalidModalOpen && (
        <div className="fixed inset-0 bg-[#001C38]/40 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-[#FDFBFF] rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border border-[#D3E3FD] animate-in zoom-in-95">
            <div className="w-12 h-12 bg-[#FEE2E2] text-[#991B1B] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </div>
            <h2 className="text-xl font-medium mb-3">Invalid record</h2>
            <p className="text-[#44474E] text-sm mb-10 leading-relaxed">The code was not found or the image could not be read. Please try again with a clear code.</p>
            <button 
              onClick={() => setIsInvalidModalOpen(false)} 
              className="w-full bg-[#005FB7] text-white py-4 rounded-full font-semibold text-sm hover:shadow-lg transition-all cursor-pointer"
            >
              Close and retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}