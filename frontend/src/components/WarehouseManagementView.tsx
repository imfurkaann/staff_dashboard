import React, { useState, useEffect } from 'react';
import { stockApi, StockItem } from '../api/stockApi';
import { 
  Package, 
  Plus, 
  Trash2, 
  Search, 
  FilePenLine, 
  X, 
  AlertTriangle,
  Users
} from 'lucide-react';

export const WarehouseManagementView: React.FC = () => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ itemName: '', totalStock: 100 });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const [deleteItem, setDeleteItem] = useState<StockItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadStock = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await stockApi.getStockItems();
      setStockItems(data);
    } catch (err: any) {
      setError(err.message || 'Stok bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.itemName.trim()) return;
    try {
      setCreateSubmitting(true);
      await stockApi.createStockItem({
        itemName: newItemForm.itemName,
        totalStock: newItemForm.totalStock
      });
      setIsCreateModalOpen(false);
      setNewItemForm({ itemName: '', totalStock: 100 });
      loadStock();
    } catch (err: any) {
      setError(err.message || 'Malzeme eklenemedi.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    try {
      setAdjustSubmitting(true);
      await stockApi.updateStockQuantity(adjustItem.id, adjustQuantity);
      setAdjustItem(null);
      loadStock();
    } catch (err: any) {
      setError(err.message || 'Stok güncellenemedi.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteItem) return;
    try {
      setDeleteSubmitting(true);
      await stockApi.deleteStockItem(deleteItem.id);
      setDeleteItem(null);
      loadStock();
    } catch (err: any) {
      setError(err.message || 'Stok kartı silinemedi.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Filter items
  const filteredItems = stockItems.filter(item => 
    item.itemName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
      {/* Action Buttons Header Bar - matching Visitor Tracking layout */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Compact Title Section */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1e3a8a] shadow-xs">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">Depo & Stok Yönetimi</h1>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
              Lojman sarf malzemeleri ve kişisel zimmetlerin stok durumları.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#1e3a8a] text-white hover:bg-[#172554] border border-[#1e3a8a] font-extrabold text-[11px] transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Malzeme Ekle</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex justify-between items-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="cursor-pointer text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Input Bar - matching Visitor Tracking layout */}
      <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-xs">
        <label className="relative block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Malzeme adı ile ara..."
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 placeholder-slate-400"
          />
        </label>
      </div>

      {/* Table Grid Wrapper - matching Visitor Tracking layout */}
      <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm w-full">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3 whitespace-nowrap">Malzeme Açıklaması / Adı</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">Toplam Stok</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">Odalarda Olan</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">Personelde Olan</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">Depoda (Müsait)</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center">Stok Durumu</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-bold whitespace-nowrap">
                    Stok kayıtları yükleniyor...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-extrabold text-slate-800">Stok Kartı Bulunamadı</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 font-semibold">Seçilen kriterlere uygun kayıt bulunmuyor.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const available = item.totalStock - (item.usedStock + item.usedInRooms);
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      🟢 Yeterli Stok
                    </span>
                  );

                  if (available === 0) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                        🔴 Stok Tükendi
                      </span>
                    );
                  } else if (available < 10) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        🟡 Kritik Seviye
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 text-[#1e3a8a] flex items-center justify-center shrink-0 shadow-2xs">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <span>{item.itemName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {item.totalStock} Adet
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {item.usedInRooms} Adet
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {item.usedStock} Adet
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-extrabold px-2 py-0.5 rounded-md text-[11px] border ${
                          available === 0 
                            ? 'bg-rose-50 text-rose-900 border-rose-100' 
                            : available < 10 
                            ? 'bg-amber-50 text-amber-900 border-amber-100' 
                            : 'bg-emerald-50 text-emerald-900 border-emerald-100'
                        }`}>
                          {available} Müsait
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-600">
                        {statusBadge}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setAdjustItem(item);
                            setAdjustQuantity(item.totalStock);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-extrabold cursor-pointer transition-colors"
                        >
                          <FilePenLine className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          type="button"
                          disabled={item.usedStock > 0 || item.usedInRooms > 0}
                          onClick={() => {
                            setError(null);
                            setDeleteItem(item);
                          }}
                          className={`inline-flex items-center p-1.5 rounded-lg border cursor-pointer transition-colors ${
                            item.usedStock > 0 || item.usedInRooms > 0
                              ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                          }`}
                          title={item.usedStock > 0 || item.usedInRooms > 0 ? "Kullanımda veya odalarda olan ürünler silinemez" : "Stok Kartını Sil"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW STOCK ITEM MODAL */}
      {isCreateModalOpen && (
        <div
          onClick={() => setIsCreateModalOpen(false)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-700" />
                <span>Yeni Stok Kartı Oluştur</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Malzeme / Eşya Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Nevresim Takımı, Yastık, Battaniye"
                  value={newItemForm.itemName}
                  onChange={(e) => setNewItemForm({ ...newItemForm, itemName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Başlangıç Stok Miktarı *</label>
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="Örn: 100"
                  value={newItemForm.totalStock}
                  onChange={(e) => setNewItemForm({ ...newItemForm, totalStock: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="py-2.5 px-4 bg-[#1e3a8a] text-white hover:bg-blue-900 font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {createSubmitting ? 'Kaydediliyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STOCK QUANTITY MODAL */}
      {adjustItem && (
        <div
          onClick={() => setAdjustItem(null)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FilePenLine className="w-4 h-4 text-blue-700" />
                <span>Stok Miktarını Düzenle</span>
              </h3>
              <button
                onClick={() => setAdjustItem(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-slate-500">Stok Kalemi</p>
              <p className="text-xs font-black text-slate-800">{adjustItem.itemName}</p>
              <div className="grid grid-cols-2 gap-4 pt-1.5 text-[10px] font-bold text-slate-600">
                <p>Mevcut Toplam: <span className="text-slate-900 font-extrabold">{adjustItem.totalStock} Adet</span></p>
                <p>Personelde: <span className="text-slate-900 font-extrabold">{adjustItem.usedStock} Adet</span></p>
                <p>Odalarda: <span className="text-slate-900 font-extrabold">{adjustItem.usedInRooms} Adet</span></p>
                <p>Toplam Kullanımda: <span className="text-slate-900 font-extrabold">{adjustItem.usedStock + adjustItem.usedInRooms} Adet</span></p>
              </div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Yeni Toplam Miktar *
                </label>
                <input
                  type="number"
                  required
                  min={adjustItem.usedStock + adjustItem.usedInRooms}
                  placeholder={`En az ${adjustItem.usedStock + adjustItem.usedInRooms} olmalıdır`}
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none"
                />
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  Şu an kullanımda ve odalarda toplam {adjustItem.usedStock + adjustItem.usedInRooms} adet malzeme bulunduğundan toplam stok bu değerin altına düşürülemez.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="py-2.5 px-4 bg-[#1e3a8a] text-white hover:bg-blue-900 font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteItem && (
        <div
          onClick={() => setDeleteItem(null)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200 shadow-2xs">
                <Trash2 className="w-5.5 h-5.5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Stok Kartını Sil
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  <strong>{deleteItem.itemName}</strong> stok tanımı depodan tamamen kaldırılacaktır. Bu işlemi onaylıyor musunuz?
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteSubmitting}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer text-xs disabled:opacity-50"
              >
                {deleteSubmitting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
