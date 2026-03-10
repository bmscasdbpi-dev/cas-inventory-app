"use client";
import { useState } from "react";
import { createClient } from "../../db/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Mali ang email o password!");
    } else {
      router.push("/dashboard"); // Pag tama, pasok sa dashboard
    }
    setLoading(false);
  }

  return (
<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 p-6 selection:bg-indigo-100 selection:text-indigo-700">
  {/* Background Decorative Elements - Softened for Light Mode */}
  <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
  <div className="absolute bottom-0 -right-4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

  <form 
    onSubmit={handleLogin} 
    className="relative bg-white/70 backdrop-blur-xl border border-white p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] w-full max-w-md transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:border-slate-100"
  >
    <div className="mb-10 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
        
      </h1>
      <p className="text-slate-500 text-sm">Login to Dashboard</p>
    </div>

    <div className="space-y-5">
      <div className="group">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1 group-focus-within:text-indigo-600 transition-colors">
          Email Address
        </label>
        <input 
          type="email" 
          placeholder="admin@system.com" 
          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none text-slate-900 transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 placeholder:text-slate-400"
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
      </div>

      <div className="group">
        <div className="flex justify-between mb-1 ml-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">
            Password
          </label>
          <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">Forgot?</a>
        </div>
        <input 
          type="password" 
          placeholder="••••••••" 
          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none text-slate-900 transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 placeholder:text-slate-400"
          onChange={(e) => setPassword(e.target.value)}
          required 
        />
      </div>

      <button 
        disabled={loading}
        className="group relative w-full bg-indigo-600 overflow-hidden text-white py-4 rounded-2xl font-bold transition-all duration-300 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        <span className="relative z-10">
          {loading ? "Authenticating..." : "Sign In"}
        </span>
      </button>
    </div>

    <p className="mt-8 text-center text-slate-400 text-xs">
      &copy; 2026 DBPI-CAS Inventory.
    </p>
  </form>
</div>
  );
}
