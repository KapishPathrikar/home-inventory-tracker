"use client";
import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, ShoppingBag, Loader2, History, Edit2, Check, Plus, X, Trash2 } from 'lucide-react';

interface GroceryItem {
  id?: string;
  product_name: string;
  category: string;
  quantity: number;
  price: number;
  purchase_date: string;
  status?: string;
  consumed_date?: string;
}

export default function Home() {
  const [inventory, setInventory] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ purchase_date: string; items: GroceryItem[] } | null>(null);
  
  // Toggle for manual add item drawer
  const [showManualForm, setShowManualForm] = useState(false);
  
  // Manual Form States
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState("Groceries");
  const [manualQty, setManualQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");

  // Track inline name editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/inventory";

  const fetchInventory = async () => {
    try {
      const res = await fetch(API_URL + "/");
      const data = await res.json();
      if (Array.isArray(data)) setInventory(data);
    } catch (err) {
      console.error("Failed fetching inventory", err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setScanning(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/scan`, { method: "POST", body: formData });
      const data = await res.json();
      setScanResult(data);
    } catch (err) {
      alert("Error scanning receipt");
    } finally {
      setScanning(false);
    }
  };

  const saveScannedItems = async () => {
    if (!scanResult) return;
    setLoading(true);
    try {
      const itemsToSave = scanResult.items.map(item => ({ ...item, purchase_date: scanResult.purchase_date }));
      await fetch(`${API_URL}/save-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToSave }),
      });
      setScanResult(null);
      fetchInventory();
    } catch (err) {
      alert("Failed saving items");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPrice) return;

    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      await fetch(`${API_URL}/save-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            product_name: manualName,
            category: manualCategory,
            quantity: Number(manualQty),
            price: Number(manualPrice),
            purchase_date: todayStr
          }]
        }),
      });

      setManualName("");
      setManualPrice("");
      setManualQty(1);
      setShowManualForm(false);
      fetchInventory();
    } catch (err) {
      alert("Failed adding item");
    } finally {
      setLoading(false);
    }
  };

  const consumeItem = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}/consume`, { method: "PATCH" });
      fetchInventory();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this item?")) return;
    try {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      fetchInventory();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAllItems = async () => {
    if (!confirm("CRITICAL WARNING: Are you sure you want to permanently delete ALL active and consumed items? This action cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/delete-all`, { method: "DELETE" });
      if (res.ok) {
        setInventory([]);
        alert("Inventory completely cleared.");
      } else {
        alert("Failed to clear inventory. Verify your backend endpoint.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while clearing inventory.");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditNameValue(currentName);
  };

  const saveNameEdit = async (id: string) => {
    try {
      const item = inventory.find(i => i.id === id);
      if (!item) return;

      await fetch(`${API_URL}/save-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            product_name: editNameValue,
            category: item.category,
            quantity: item.quantity,
            price: item.price,
            purchase_date: item.purchase_date
          }]
        }),
      });

      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      setEditingId(null);
      fetchInventory();
    } catch (err) {
      console.error(err);
    }
  };

  const removeScannedItem = (indexToRemove: number) => {
    if (!scanResult) return;
    setScanResult({ ...scanResult, items: scanResult.items.filter((_, idx) => idx !== indexToRemove) });
  };

  const calculateDaysLasted = (purchaseStr: string, consumedStr?: string) => {
    if (!consumedStr) return 0;
    const start = new Date(purchaseStr);
    const end = new Date(consumedStr);
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAverageLifespanDays = (productName: string): number | null => {
    const historicalMatches = inventory.filter(
      item => item.status === "Consumed" && item.product_name.trim().toLowerCase() === productName.trim().toLowerCase()
    );
    if (historicalMatches.length === 0) return null;
    const totalDays = historicalMatches.reduce((acc, item) => acc + calculateDaysLasted(item.purchase_date, item.consumed_date), 0);
    return Math.round(totalDays / historicalMatches.length);
  };

  const getAverageLifespan = (productName: string) => {
    const average = getAverageLifespanDays(productName);
    if (average === null) return "New Item";
    return average === 0 ? "Same Day" : `${average} Days`;
  };

  const getTargetFinishDate = (purchaseDateStr: string, productName: string) => {
    const avgDays = getAverageLifespanDays(productName);
    if (avgDays === null) return { dateStr: "N/A", isOverdue: false };

    const purchaseDate = new Date(purchaseDateStr);
    purchaseDate.setDate(purchaseDate.getDate() + avgDays);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetClone = new Date(purchaseDate.getTime());
    targetClone.setHours(0, 0, 0, 0);

    return {
      dateStr: purchaseDate.toISOString().split('T')[0],
      isOverdue: targetClone <= today
    };
  };

  const activeStock = inventory.filter(item => item.status === "Available");
  const consumedHistory = inventory.filter(item => item.status === "Consumed");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Responsive Header Layout */}
        <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl gap-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
            <h1 className="text-lg sm:text-2xl font-bold">Home Inventory</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Delete All Button */}
            {inventory.length > 0 && (
              <button 
                onClick={deleteAllItems}
                disabled={loading}
                className="flex items-center gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 font-semibold px-3 py-2 rounded-xl transition text-xs sm:text-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            )}

            {/* Type Manually Button */}
            <button 
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 font-semibold px-3 py-2 rounded-xl transition text-xs sm:text-sm"
            >
              {showManualForm ? <X className="w-4 h-4 text-rose-400" /> : <Plus className="w-4 h-4 text-emerald-400" />}
              <span>{showManualForm ? "Close Form" : "Type Item"}</span>
            </button>

            {/* Scan Receipt Action */}
            <label className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold px-3 py-2 rounded-xl cursor-pointer transition text-xs sm:text-sm">
              <Camera className="w-4 h-4" />
              <span>Scan Receipt</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Manual Add Input Box */}
        {showManualForm && (
          <form onSubmit={handleManualSubmit} className="bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Item Name</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Fresh Milk, Tomato 1kg"
                value={manualName} 
                onChange={(e) => setManualName(e.target.value)}
                className="w-full bg-slate-900 text-slate-100 rounded-xl px-3 py-2 border border-slate-700 outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Qty</label>
              <input 
                type="number" 
                min="1"
                required
                value={manualQty} 
                onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-900 text-slate-100 rounded-xl px-3 py-2 border border-slate-700 outline-none focus:border-emerald-500 text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Price (₹)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={manualPrice} 
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="w-full bg-slate-900 text-slate-100 rounded-xl px-3 py-2 border border-slate-700 outline-none focus:border-emerald-500 text-sm font-mono"
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="absolute right-1 top-1 bottom-1 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold px-3 rounded-lg text-xs transition"
                >
                  {loading ? "..." : "Add"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* AI Scanner Preview */}
        {scanning && (
          <div className="bg-slate-800 p-6 rounded-2xl border-2 border-dashed border-emerald-500/30 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-emerald-400 font-medium text-sm sm:text-base">Gemini is parsing invoice line items...</p>
          </div>
        )}

        {scanResult && (
          <div className="bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-700 space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-emerald-400">Confirm Scanned Items ({scanResult.purchase_date})</h2>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-700">
              {scanResult.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-xs sm:text-sm gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeScannedItem(idx)} className="text-slate-500 hover:text-rose-500 transition font-bold text-lg px-1.5">&times;</button>
                    <span>{item.product_name} (x{item.quantity})</span>
                  </div>
                  <span className="font-mono text-slate-400">₹{item.price}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveScannedItems} disabled={loading} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-2 rounded-xl transition text-xs sm:text-sm">
                {loading ? "Saving..." : "Accept & Add to Stock"}
              </button>
              <button onClick={() => setScanResult(null)} className="px-3 sm:px-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition text-xs sm:text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Active Stock Board */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-700 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-semibold">Active Household Stock</h2>
          </div>

          {activeStock.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No active items in stock.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse block md:table">
                <thead className="hidden md:table-header-group">
                  <tr className="bg-slate-850 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Bought On</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4">Price</th>
                    <th className="p-4 text-amber-400">Avg Lifespan</th>
                    <th className="p-4 text-emerald-400">Finish By</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-sm block md:table-row-group">
                  {activeStock.map((item) => {
                    const target = getTargetFinishDate(item.purchase_date, item.product_name);
                    return (
                      <tr key={item.id} className="hover:bg-slate-750/50 transition flex flex-col md:table-row p-4 md:p-0 border-b border-slate-700 md:border-b-0 space-y-2 md:space-y-0">
                        <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Item Name</span>
                          {editingId === item.id ? (
                            <div className="flex items-center gap-2 w-full max-w-xs justify-end md:justify-start">
                              <input
                                type="text"
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                className="bg-slate-700 text-slate-100 px-2 py-1 rounded-lg border border-emerald-500 outline-none text-xs sm:text-sm w-full"
                              />
                              <button onClick={() => saveNameEdit(item.id!)} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-200 text-right md:text-left">{item.product_name}</span>
                              <button onClick={() => startEditing(item.id!, item.product_name)} className="text-slate-400 hover:text-slate-200 transition p-1" title="Edit name">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Bought On</span>
                          <span className="font-mono text-xs text-slate-400">{item.purchase_date}</span>
                        </td>
                        <td className="md:p-4 flex justify-between items-center md:table-cell border-none md:text-center">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Qty</span>
                          <span className="font-mono">{item.quantity}</span>
                        </td>
                        <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Price</span>
                          <span className="font-mono text-slate-300">₹{item.price}</span>
                        </td>
                        <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Avg Lifespan</span>
                          <span className="font-semibold text-xs text-amber-400 font-mono">
                            {getAverageLifespan(item.product_name)}
                          </span>
                        </td>
                        <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Finish By</span>
                          <span className={`font-mono font-semibold text-xs ${target.isOverdue ? "text-rose-400 animate-pulse" : "text-slate-300"}`}>
                            {target.dateStr} {target.isOverdue && target.dateStr !== "N/A" ? "(Due)" : ""}
                          </span>
                        </td>
                        <td className="md:p-4 flex justify-between md:justify-end items-center md:table-cell border-none pt-2 md:pt-0 border-t border-dashed border-slate-700/50 md:border-none">
                          <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Actions</span>
                          <div className="flex items-center gap-4">
                            <button onClick={() => consumeItem(item.id!)} className="text-slate-400 hover:text-emerald-400 transition" title="Mark as Consumed">
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button onClick={() => deleteItem(item.id!)} className="text-slate-400 hover:text-rose-500 transition font-bold text-xl px-1" title="Delete Permanently">
                              &times;
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Consumption History Log */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-700 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-semibold">Consumption History & Lifespan</h2>
          </div>

          {consumedHistory.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No items finished yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse block md:table">
                <thead className="hidden md:table-header-group">
                  <tr className="bg-slate-850 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Bought On</th>
                    <th className="p-4">Finished On</th>
                    <th className="p-4 text-right text-amber-400">Days Lasted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-sm block md:table-row-group">
                  {consumedHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-750/30 transition bg-slate-900/20 flex flex-col md:table-row p-4 md:p-0 border-b border-slate-700 md:border-b-0 space-y-2 md:space-y-0">
                      <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                        <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Product Name</span>
                        <span className="font-medium text-slate-400 line-through text-right md:text-left">{item.product_name}</span>
                      </td>
                      <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                        <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Bought On</span>
                        <span className="font-mono text-xs text-slate-500">{item.purchase_date}</span>
                      </td>
                      <td className="md:p-4 flex justify-between items-center md:table-cell border-none">
                        <span className="md:hidden text-xs font-bold uppercase tracking-wider text-slate-500">Finished On</span>
                        <span className="font-mono text-xs text-emerald-500">{item.consumed_date}</span>
                      </td>
                      <td className="md:p-4 flex justify-between md:justify-end items-center md:table-cell border-none pt-2 md:pt-0 border-t border-dashed border-slate-700/50 md:border-none">
                        <span className="md:hidden text-xs font-bold uppercase tracking-wider text-amber-400">Days Lasted</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-amber-400 font-mono">
                            {calculateDaysLasted(item.purchase_date, item.consumed_date) === 0 ? "Same Day" : `${calculateDaysLasted(item.purchase_date, item.consumed_date)} Days`}
                          </span>
                          <button onClick={() => deleteItem(item.id!)} className="text-slate-500 hover:text-rose-500 transition font-bold text-xl px-1">
                            &times;
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}