"use client";
import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, ShoppingBag, Loader2, History, Edit2, Check, Plus, X } from 'lucide-react';

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

  // Handle saving a single manually typed item
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPrice) return;

    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0]; // Current date string (YYYY-MM-DD)

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

      // Reset form options
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

  const getAverageLifespan = (productName: string) => {
    const historicalMatches = inventory.filter(
      item => item.status === "Consumed" && item.product_name.trim().toLowerCase() === productName.trim().toLowerCase()
    );
    if (historicalMatches.length === 0) return "New Item";
    const totalDays = historicalMatches.reduce((acc, item) => acc + calculateDaysLasted(item.purchase_date, item.consumed_date), 0);
    const average = Math.round(totalDays / historicalMatches.length);
    return average === 0 ? "Same Day" : `${average} Days`;
  };

  const activeStock = inventory.filter(item => item.status === "Available");
  const consumedHistory = inventory.filter(item => item.status === "Consumed");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Dynamic Header Layout */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-800 p-5 rounded-2xl shadow-xl gap-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-emerald-400" />
            <h1 className="text-xl md:text-2xl font-bold">Home Inventory</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Type Manually Button */}
            <button 
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 font-semibold px-4 py-2.5 rounded-xl transition text-sm"
            >
              {showManualForm ? <X className="w-4 h-4 text-rose-400" /> : <Plus className="w-4 h-4 text-emerald-400" />}
              <span>{showManualForm ? "Close Form" : "Type Item"}</span>
            </button>

            {/* Scan Receipt Action */}
            <label className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition text-sm">
              <Camera className="w-4 h-4" />
              <span>Scan Receipt</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Manual Add Input Box (Expanded Form Panel) */}
        {showManualForm && (
          <form onSubmit={handleManualSubmit} className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="space-y-1.5 md:col-span-2">
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
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* AI Scanner Preview */}
        {scanning && (
          <div className="bg-slate-800 p-6 rounded-2xl border-2 border-dashed border-emerald-500/30 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-emerald-400 font-medium">Gemini is parsing invoice line items...</p>
          </div>
        )}

        {scanResult && (
          <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400">Confirm Scanned Items ({scanResult.purchase_date})</h2>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-700">
              {scanResult.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-sm gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeScannedItem(idx)} className="text-slate-500 hover:text-rose-500 transition font-bold text-lg px-1.5">&times;</button>
                    <span>{item.product_name} (x{item.quantity})</span>
                  </div>
                  <span className="font-mono text-slate-400">₹{item.price}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveScannedItems} disabled={loading} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-2 rounded-xl transition">
                {loading ? "Saving..." : "Accept & Add to Stock"}
              </button>
              <button onClick={() => setScanResult(null)} className="px-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition">Cancel</button>
            </div>
          </div>
        )}

        {/* Active Stock Board */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-700 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Active Household Stock</h2>
          </div>

          {activeStock.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No active items in stock.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-850 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Bought On</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4">Price</th>
                    <th className="p-4 text-amber-400">Avg Lifespan</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-sm">
                  {activeStock.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-750/50 transition">
                      <td className="p-4">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              className="bg-slate-700 text-slate-100 px-2 py-1 rounded-lg border border-emerald-500 outline-none w-full max-w-xs"
                            />
                            <button onClick={() => saveNameEdit(item.id!)} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="font-medium text-slate-200">{item.product_name}</span>
                            <button onClick={() => startEditing(item.id!, item.product_name)} className="text-slate-500 hover:text-slate-300 transition opacity-0 group-hover:opacity-100">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-400">{item.purchase_date}</td>
                      <td className="p-4 text-center font-mono">{item.quantity}</td>
                      <td className="p-4 font-mono text-slate-300">₹{item.price}</td>
                      <td className="p-4 font-semibold text-xs text-amber-400 font-mono">
                        {getAverageLifespan(item.product_name)}
                      </td>
                      <td className="p-4 text-right flex justify-end items-center gap-4">
                        <button onClick={() => consumeItem(item.id!)} className="text-slate-400 hover:text-emerald-400 transition" title="Mark as Consumed">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteItem(item.id!)} className="text-slate-400 hover:text-rose-500 transition font-bold text-xl px-1" title="Delete Permanently">
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Consumption History Log */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-700 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Consumption History & Lifespan</h2>
          </div>

          {consumedHistory.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No items finished yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-850 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Bought On</th>
                    <th className="p-4">Finished On</th>
                    <th className="p-4 text-right text-amber-400">Days Lasted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-sm">
                  {consumedHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-750/30 transition bg-slate-900/20">
                      <td className="p-4 font-medium text-slate-400 line-through">{item.product_name}</td>
                      <td className="p-4 font-mono text-xs text-slate-500">{item.purchase_date}</td>
                      <td className="p-4 font-mono text-xs text-emerald-500">{item.consumed_date}</td>
                      <td className="p-4 text-right flex justify-end items-center gap-4">
                        <span className="font-bold text-amber-400 font-mono">
                          {calculateDaysLasted(item.purchase_date, item.consumed_date) === 0 ? "Same Day" : `${calculateDaysLasted(item.purchase_date, item.consumed_date)} Days`}
                        </span>
                        <button onClick={() => deleteItem(item.id!)} className="text-slate-500 hover:text-rose-500 transition font-bold text-xl px-1">
                          &times;
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
    </div>
  );
}