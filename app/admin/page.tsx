'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, Package, TrendingUp,
  RefreshCw, Eye, CheckCircle, Clock, XCircle,
  Building2, Mail, Phone, Globe, Tag, Boxes,
  ArrowUpRight, Inbox, ShoppingBag, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PRODUCTS, BRANDS, CATEGORIES } from '@/lib/data';
import type { RFQRequest, SellSurplusRequest } from '@/lib/types';

type TabType = 'overview' | 'rfqs' | 'surplus' | 'products';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  reviewed: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  quoted: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  accepted: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  declined: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [rfqs, setRfqs] = useState<RFQRequest[]>([]);
  const [surplusRequests, setSurplusRequests] = useState<SellSurplusRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<RFQRequest | null>(null);

  const loadData = async () => {
  setLoading(true);

  const db = supabase;

  if (!db) {
    setLoading(false);
    return;
  }

  const [rfqRes, surplusRes] = await Promise.all([
    db.from('rfq_requests').select('*').order('created_at', { ascending: false }),
    db.from('sell_surplus_requests').select('*').order('created_at', { ascending: false }),
  ]);

  if (rfqRes.data) setRfqs(rfqRes.data);
  if (surplusRes.data) setSurplusRequests(surplusRes.data);

  setLoading(false);
};

  useEffect(() => {
    loadData();
  }, []);

  const updateRfqStatus = async (id: string, status: string) => {
  const db = supabase;

  if (!db) return;

  await db.from('rfq_requests').update({ status }).eq('id', id);

  setRfqs((prev) =>
    prev.map((r) => (r.id === id ? { ...r, status } : r))
  );
};

  const pendingRfqs = rfqs.filter((r) => r.status === 'pending').length;
  const pendingSurplus = surplusRequests.filter((r) => r.status === 'pending').length;

  const tabs: { id: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'rfqs', label: 'RFQ Requests', icon: FileText, badge: pendingRfqs || undefined },
    { id: 'surplus', label: 'Surplus Offers', icon: Inbox, badge: pendingSurplus || undefined },
    { id: 'products', label: 'Products', icon: Package },
  ];

  return (
    <div className="min-h-screen bg-navy-950 pt-20">
      {/* Admin header */}
      <div className="bg-navy-900 border-b border-navy-700">
        <div className="page-container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">Xeltronic Electrical Solution — Management</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white border border-navy-600 hover:border-slate-500 px-3 py-1.5 rounded transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-container py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-navy-900 border border-navy-700 rounded-lg p-1 mb-6 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all whitespace-nowrap relative ${
                activeTab === id
                  ? 'bg-navy-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-navy-800'
              }`}
            >
              <Icon size={15} />
              {label}
              {badge != null && badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: FileText, label: 'Total RFQs', value: rfqs.length, color: 'text-sky-400', sub: `${pendingRfqs} pending` },
                { icon: Inbox, label: 'Surplus Offers', value: surplusRequests.length, color: 'text-amber-400', sub: `${pendingSurplus} pending` },
                { icon: Package, label: 'Products', value: PRODUCTS.length, color: 'text-emerald-400', sub: `${PRODUCTS.filter(p=>p.inStock).length} in stock` },
                { icon: Building2, label: 'Brands', value: BRANDS.length, color: 'text-gold-500', sub: `${CATEGORIES.length} categories` },
              ].map(({ icon: Icon, label, value, color, sub }) => (
                <div key={label} className="bg-navy-800 border border-navy-700 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-9 h-9 bg-current/10 rounded-lg flex items-center justify-center ${color}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Icon size={18} className={color} />
                    </div>
                    <ArrowUpRight size={14} className="text-slate-600" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className={`text-xs mt-1 ${color}`}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Recent RFQs */}
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700">
                <h2 className="font-bold text-white">Recent RFQ Requests</h2>
                <button onClick={() => setActiveTab('rfqs')} className="text-xs text-gold-500 hover:text-gold-400">
                  View all →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-700">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Company</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Part Number</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfqs.slice(0, 5).map((rfq) => (
                      <tr key={rfq.id} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="text-slate-200 font-medium">{rfq.company || rfq.name}</div>
                          <div className="text-xs text-slate-500">{rfq.email}</div>
                        </td>
                        <td className="px-5 py-3 font-mono text-gold-500 text-xs">{rfq.part_number}</td>
                        <td className="px-5 py-3 text-slate-300">{rfq.quantity}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[rfq.status || 'pending']}`}>
                            {rfq.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {rfqs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                          No RFQ requests yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* RFQ Requests Tab */}
        {activeTab === 'rfqs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">RFQ Requests ({rfqs.length})</h2>
              <div className="flex gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock size={12} className="text-amber-400" /> {pendingRfqs} pending</span>
              </div>
            </div>

            {rfqs.length === 0 ? (
              <div className="bg-navy-800 border border-navy-700 rounded-xl p-10 text-center">
                <FileText size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No RFQ requests yet</p>
              </div>
            ) : (
              <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-700 bg-navy-900">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Contact</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Part #</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Country</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfqs.map((rfq) => (
                        <tr key={rfq.id} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-200">{rfq.name}</div>
                            <div className="text-xs text-slate-500">{rfq.company}</div>
                            <div className="text-xs text-slate-500">{rfq.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gold-500 max-w-[160px]">
                            <div className="truncate">{rfq.part_number}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{rfq.quantity}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{rfq.country}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[rfq.status || 'pending']}`}>
                              {rfq.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setSelectedRfq(rfq)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-600 rounded transition-colors"
                                title="View details"
                              >
                                <Eye size={13} />
                              </button>
                              {rfq.status === 'pending' && (
                                <button
                                  onClick={() => updateRfqStatus(rfq.id!, 'quoted')}
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                  title="Mark as quoted"
                                >
                                  <CheckCircle size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Surplus Offers Tab */}
        {activeTab === 'surplus' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Surplus Inventory Offers ({surplusRequests.length})</h2>
            {surplusRequests.length === 0 ? (
              <div className="bg-navy-800 border border-navy-700 rounded-xl p-10 text-center">
                <Inbox size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No surplus offers yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {surplusRequests.map((req) => (
                  <div key={req.id} className="bg-navy-800 border border-navy-700 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-white">{req.contact_person}</p>
                        <p className="text-sm text-slate-400">{req.company} — {req.country}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[req.status || 'pending']}`}>
                          {req.status || 'pending'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      <div><span className="text-slate-500">Brand:</span> <span className="text-slate-300 font-medium">{req.brand || '—'}</span></div>
                      <div><span className="text-slate-500">Condition:</span> <span className="text-slate-300 font-medium">{req.condition || '—'}</span></div>
                      <div><span className="text-slate-500">Quantity:</span> <span className="text-slate-300 font-medium">{req.quantity || '—'}</span></div>
                    </div>
                    {req.part_numbers && (
                      <div className="mt-3 p-3 bg-navy-900 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Part Numbers:</p>
                        <p className="text-xs font-mono text-gold-500">{req.part_numbers}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                      <a href={`mailto:${req.email}`} className="flex items-center gap-1 hover:text-gold-500">
                        <Mail size={11} /> {req.email}
                      </a>
                      {req.phone && <span className="flex items-center gap-1"><Phone size={11} /> {req.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Product Catalog ({PRODUCTS.length})</h2>
              <div className="text-xs text-slate-400">
                {PRODUCTS.filter(p => p.inStock).length} in stock · {PRODUCTS.filter(p => !p.inStock).length} out of stock
              </div>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-700 bg-navy-900">
                      {['SKU', 'Brand', 'Part Number', 'Name', 'Category', 'Condition', 'Stock'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCTS.map((p) => (
                      <tr key={p.id} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{p.sku}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gold-500">{p.brand}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-300">{p.partNumber}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-200 max-w-[220px]">
                          <div className="truncate">{p.name}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{p.category}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            p.condition === 'New' ? 'bg-emerald-500/20 text-emerald-400' :
                            p.condition === 'Refurbished' ? 'bg-sky-500/20 text-sky-400' :
                            p.condition === 'Used' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{p.condition}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {p.inStock ? (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle size={11} /> In Stock
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <XCircle size={11} /> Out of Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RFQ Detail Modal */}
      {selectedRfq && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRfq(null)}>
          <div className="bg-navy-800 border border-navy-600 rounded-xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <h3 className="font-bold text-white text-lg">RFQ Details</h3>
              <button onClick={() => setSelectedRfq(null)} className="text-slate-400 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Name', value: selectedRfq.name },
                { label: 'Company', value: selectedRfq.company },
                { label: 'Email', value: selectedRfq.email },
                { label: 'Phone', value: selectedRfq.phone || '—' },
                { label: 'Country', value: selectedRfq.country },
                { label: 'Part Number', value: selectedRfq.part_number, mono: true },
                { label: 'Quantity', value: String(selectedRfq.quantity) },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between items-start gap-4 py-2 border-b border-navy-700">
                  <span className="text-slate-500 shrink-0">{label}</span>
                  <span className={`text-slate-200 font-medium text-right ${mono ? 'font-mono text-gold-500' : ''}`}>{value}</span>
                </div>
              ))}
              {selectedRfq.message && (
                <div className="pt-2">
                  <p className="text-slate-500 mb-2">Message</p>
                  <p className="text-slate-300 bg-navy-900 rounded p-3 text-xs leading-relaxed">{selectedRfq.message}</p>
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-3">
              <a href={`mailto:${selectedRfq.email}?subject=Re: RFQ for ${selectedRfq.part_number}`}
                className="btn-gold flex-1 justify-center text-sm py-2">
                <Mail size={14} />
                Reply by Email
              </a>
              {selectedRfq.status === 'pending' && (
                <button
                  onClick={() => { updateRfqStatus(selectedRfq.id!, 'quoted'); setSelectedRfq({ ...selectedRfq, status: 'quoted' }); }}
                  className="btn-outline-slate flex-1 justify-center text-sm py-2"
                >
                  Mark Quoted
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
