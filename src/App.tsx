/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  FileText, 
  Building2, 
  User, 
  MapPin, 
  Hash,
  RefreshCw,
  Search,
  Upload,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Types
interface TaxItem {
  id: string;
  description: string;
  amount: number;
}

interface TaxParty {
  name: string;
  address: string;
  npwp: string;
}

interface NotaData {
  nomor: string;
  fakturNomor: string;
  fakturTanggal: string;
  penerima: TaxParty;
  pemberi: TaxParty;
  items: TaxItem[];
  tanggalDokumen: string;
  penandatangan: string;
}

const initialData: NotaData = {
  nomor: '880/RT/02/2025-025/RT/02/2025',
  fakturNomor: '030.007-24.80471793',
  fakturTanggal: '2024-08-16',
  penerima: {
    name: 'PT PERTAMINA HULU ENERGI OFFSHORE NORTH WEST JAVA',
    address: 'GEDUNG PHE TOWER LT 3, JL TB SIMATUPANG KAV 99 Blok 00 No.00 RT:000 RW:000 Kel.KEBAGUSAN Kec.PASAR MINGGU Kota/Kab.JAKARTA SELATAN DKI JAKARTA 12520',
    npwp: '010613404081000'
  },
  pemberi: {
    name: 'PT PGAS Solution',
    address: 'Gedung C Lt.4 Jl, KH. Zainul Arifin No. 20 Jakarta Barat 11140. Indonesia',
    npwp: '029885225051000'
  },
  items: [
    {
      id: '1',
      description: 'PG00119 - Personnel & Rent tools to Install Celling Toilet at Foxtrot F/S (20 Mei 2024 s/d 01 Juni 2024) Rp 90.004.085 x 1',
      amount: 90004085
    }
  ],
  tanggalDokumen: '2025-02-13',
  penandatangan: 'PT Pertamina Hulu Energi ONWJ'
};

// Helpers
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNPWP = (npwp: string) => {
  if (!npwp) return '';
  // Format: 00.000.000.0-000.000
  const clean = npwp.replace(/\D/g, '');
  if (clean.length !== 15) return npwp;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}.${clean.slice(8, 9)}.${clean.slice(9, 12)}.${clean.slice(12, 15)}`;
};

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export default function App() {
  const [data, setData] = useState<NotaData>(initialData);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const totalAmount = useMemo(() => {
    return data.items.reduce((sum, item) => sum + item.amount, 0);
  }, [data.items]);

  const ppnAmount = useMemo(() => {
    // 11% PPN calculation
    return Math.floor(totalAmount * 0.11);
  }, [totalAmount]);

  const handlePrint = () => {
    window.print();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                {
                  text: "Anda adalah pakar pajak Indonesia. Ekstrak data dari gambar Faktur Pajak ini dan kembalikan dalam format JSON murni. Pastikan NPWP adalah deretan angka (15 digit). Item harus berisi deskripsi lengkap dan nominal angka tanpa tanda pemisah di JSON."
                },
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: file.type
                  }
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  nomorNota: { type: Type.STRING, description: "Beri string kosong, user yang akan isi atau deteksi jika ada" },
                  fakturNomor: { type: Type.STRING },
                  fakturTanggal: { type: Type.STRING, description: "YYYY-MM-DD" },
                  penerimaName: { type: Type.STRING },
                  penerimaAddress: { type: Type.STRING },
                  penerimaNpwp: { type: Type.STRING },
                  pemberiName: { type: Type.STRING },
                  pemberiAddress: { type: Type.STRING },
                  pemberiNpwp: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER }
                      },
                      required: ["description", "amount"]
                    }
                  }
                },
                required: ["fakturNomor", "fakturTanggal", "penerimaName", "penerimaNpwp", "items"]
              }
            }
          });

          const extracted: any = JSON.parse(response.text);
          
          setData(prev => ({
            ...prev,
            nomor: extracted.nomorNota || prev.nomor,
            fakturNomor: extracted.fakturNomor || prev.fakturNomor,
            fakturTanggal: extracted.fakturTanggal || prev.fakturTanggal,
            penerima: {
              name: extracted.penerimaName || prev.penerima.name,
              address: extracted.penerimaAddress || prev.penerima.address,
              npwp: (extracted.penerimaNpwp || '').replace(/\D/g, '').slice(0, 15)
            },
            pemberi: {
              name: extracted.pemberiName || prev.pemberi.name,
              address: extracted.pemberiAddress || prev.pemberi.address,
              npwp: (extracted.pemberiNpwp || '').replace(/\D/g, '').slice(0, 15)
            },
            items: extracted.items.map((it: any, i: number) => ({
              id: Math.random().toString(36).substr(2, 9),
              description: it.description,
              amount: it.amount
            }))
          }));

        } catch (err: any) {
          console.error("Gemini Error:", err);
          setUploadError("Gagal menganalisis dokumen. Pastikan file adalah Faktur Pajak yang jelas.");
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsExtracting(false);
      setUploadError("Gagal membaca file.");
    }
  };

  const updatePenerima = (field: keyof TaxParty, value: string) => {
    setData(prev => ({
      ...prev,
      penerima: { ...prev.penerima, [field]: value }
    }));
  };

  const updatePemberi = (field: keyof TaxParty, value: string) => {
    setData(prev => ({
      ...prev,
      pemberi: { ...prev.pemberi, [field]: value }
    }));
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { id: Math.random().toString(36).substr(2, 9), description: '', amount: 0 }
      ]
    }));
  };

  const removeItem = (id: string) => {
    if (data.items.length === 1) return;
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const updateItem = (id: string, field: keyof TaxItem, value: any) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  return (
    <div className="min-h-screen font-sans selection:bg-sky-500/30">
      {/* Navigation / Toolbar */}
      <header className="sticky top-0 z-40 w-full glass-panel rounded-none border-t-0 border-x-0 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 p-2 rounded-xl shadow-lg shadow-sky-500/20">
              <FileText className="w-5 h-5 text-slate-900" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Nota Pembatalan <span className="text-sky-400 font-light italic">Generator</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setData(initialData)}
              className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button 
              onClick={handlePrint}
              className="bg-sky-400 text-slate-900 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-300 transition-all active:scale-95 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Cetak / Save PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 xl:grid-cols-2 gap-8 print:block print:p-0 print:max-w-none">
        
        {/* Input Form Column */}
        <div className="space-y-8 print:hidden">
          {/* AI Upload Section */}
          <section className="glass-panel p-8 border-sky-500/30 border-dashed border-2 bg-sky-500/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Upload className="w-24 h-24 text-sky-400 rotate-12" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={`p-4 rounded-full mb-4 transition-all ${isExtracting ? 'bg-sky-500 animate-pulse' : 'bg-sky-500/20'}`}>
                {isExtracting ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Upload className="w-8 h-8 text-sky-400" />}
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Automasi Faktur Pajak</h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                Unggah gambar atau PDF Faktur Pajak Anda. AI akan mengekstrak semua informasi secara otomatis untuk mempercepat pengisian nota pembatalan.
              </p>
              
              <label className={`
                flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all active:scale-95
                ${isExtracting ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-500 text-slate-900 hover:bg-sky-400 shadow-lg shadow-sky-500/20'}
              `}>
                <FileText className="w-5 h-5" />
                {isExtracting ? 'Menganalisis Dokumen...' : 'Pilih File Faktur'}
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  disabled={isExtracting}
                />
              </label>

              {uploadError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center gap-2 text-red-400 text-xs bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20"
                >
                  <AlertCircle className="w-4 h-4" />
                  {uploadError}
                </motion.div>
              )}
            </div>
          </section>

          <section className="glass-panel p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-100">
              <Hash className="w-5 h-5 text-sky-400" />
              Informasi Umum
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nomor Nota</label>
                <input 
                  type="text" 
                  value={data.nomor}
                  onChange={(e) => setData({...data, nomor: e.target.value})}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nomor Faktur Pajak</label>
                <input 
                  type="text" 
                  value={data.fakturNomor}
                  onChange={(e) => setData({...data, fakturNomor: e.target.value})}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tanggal Faktur</label>
                <input 
                  type="date" 
                  value={data.fakturTanggal}
                  onChange={(e) => setData({...data, fakturTanggal: e.target.value})}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none [color-scheme:dark]"
                />
              </div>
            </div>
          </section>

          <section className="glass-panel p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-100">
              <Building2 className="w-5 h-5 text-sky-400" />
              Penerima Jasa (Client)
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Perusahaan</label>
                <input 
                  type="text" 
                  value={data.penerima.name}
                  onChange={(e) => updatePenerima('name', e.target.value)}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">NPWP (15 Digit)</label>
                <input 
                  type="text" 
                  value={data.penerima.npwp}
                  onChange={(e) => updatePenerima('npwp', e.target.value)}
                  placeholder="000000000000000"
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Alamat Lengkap</label>
                <textarea 
                  rows={3}
                  value={data.penerima.address}
                  onChange={(e) => updatePenerima('address', e.target.value)}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none resize-none"
                />
              </div>
            </div>
          </section>

          <section className="glass-panel p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-100">
              <User className="w-5 h-5 text-sky-400" />
              Pemberi Jasa (Provider)
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Perusahaan</label>
                <input 
                  type="text" 
                  value={data.pemberi.name}
                  onChange={(e) => updatePemberi('name', e.target.value)}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">NPWP (15 Digit)</label>
                <input 
                  type="text" 
                  value={data.pemberi.npwp}
                  onChange={(e) => updatePemberi('npwp', e.target.value)}
                  placeholder="000000000000000"
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Alamat Lengkap</label>
                <textarea 
                  rows={2}
                  value={data.pemberi.address}
                  onChange={(e) => updatePemberi('address', e.target.value)}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none resize-none"
                />
              </div>
            </div>
          </section>

          <section className="glass-panel p-6 leading-relaxed">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                <RefreshCw className="w-5 h-5 text-sky-400" />
                Rincian Pembatalan
              </h2>
              <button 
                onClick={addItem}
                className="text-sky-400 hover:text-sky-300 font-bold text-sm flex items-center gap-1 transition-colors bg-sky-400/10 px-3 py-1.5 rounded-lg border border-sky-400/20"
              >
                <Plus className="w-4 h-4" /> Tambah Item
              </button>
            </div>
            
            <div className="space-y-6">
              <AnimatePresence>
                {data.items.map((item, index) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 glass-input rounded-2xl space-y-3 relative group"
                  >
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deskripsi Jasa</label>
                      <textarea 
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Deskripsi jasa yang dibatalkan..."
                        className="w-full px-3 py-2 bg-slate-950/20 border border-white/5 rounded-xl focus:ring-1 focus:ring-sky-500/50 outline-none text-sm resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nominal (Rp)</label>
                      <input 
                        type="number" 
                        value={item.amount}
                        onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950/20 border border-white/5 rounded-xl focus:ring-1 focus:ring-sky-500/50 outline-none text-sm"
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          <section className="glass-panel p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-100">
              <MapPin className="w-5 h-5 text-sky-400" />
              Tanda Tangan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tanggal Dokumen</label>
                <input 
                  type="date" 
                  value={data.tanggalDokumen}
                  onChange={(e) => setData({...data, tanggalDokumen: e.target.value})}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Penandatangan</label>
                <input 
                  type="text" 
                  value={data.penandatangan}
                  onChange={(e) => setData({...data, penandatangan: e.target.value})}
                  className="w-full glass-input px-4 py-2.5 rounded-xl outline-none"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Live Preview Column */}
        <div className="sticky top-24 h-fit print:static print:h-auto print:block">
          <div className="bg-white shadow-2xl rounded-sm border border-neutral-300 p-[1.5cm] min-h-[29.7cm] flex flex-col font-mono text-[11pt] leading-tight text-black print:shadow-none print:border-none print:p-0 print:min-h-0">
            {/* Document Header */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold underline mb-1">Nota Pembatalan</h1>
              <p className="text-sm">Nomor : {data.nomor}</p>
            </div>

            {/* Document Info Grid */}
            <div className="border border-black">
              <div className="grid grid-cols-[1.5fr_1fr] border-b border-black">
                <div className="p-1 px-3 border-r border-black">
                  Atas Faktur Pajak Nomor : {data.fakturNomor}
                </div>
                <div className="p-1 px-3">
                  Tanggal : {formatDateIndo(data.fakturTanggal)}
                </div>
              </div>

              <div className="text-center p-1 font-bold border-b border-black bg-neutral-50 print:bg-transparent">
                Penerima Jasa Kena Pajak
              </div>

              <div className="grid grid-cols-[80px_10px_1fr] p-1 px-3">
                <div className="p-0.5">Nama</div>
                <div className="p-0.5">:</div>
                <div className="p-0.5 font-bold">{data.penerima.name}</div>

                <div className="p-0.5 pt-2 align-top">Alamat</div>
                <div className="p-0.5 pt-2 align-top">:</div>
                <div className="p-0.5 pt-2 whitespace-pre-wrap">{data.penerima.address}</div>

                <div className="p-0.5 pt-2">NPWP</div>
                <div className="p-0.5 pt-2">:</div>
                <div className="p-0.5 pt-2 font-mono flex gap-1">
                  {data.penerima.npwp.split('').map((char, i) => (
                    <span key={i} className="border border-black px-1 min-w-[1.2rem] text-center">{char}</span>
                  ))}
                </div>
              </div>

              <div className="text-center p-1 font-bold border-t border-b border-black bg-neutral-50 print:bg-transparent mt-2">
                Kepada Pemberi Jasa Kena Pajak
              </div>

              <div className="grid grid-cols-[80px_10px_1fr] p-1 px-3">
                <div className="p-0.5">Nama</div>
                <div className="p-0.5">:</div>
                <div className="p-0.5 font-bold">{data.pemberi.name}</div>

                <div className="p-0.5">Alamat</div>
                <div className="p-0.5">:</div>
                <div className="p-0.5">{data.pemberi.address}</div>

                <div className="p-0.5">NPWP</div>
                <div className="p-0.5">:</div>
                <div className="p-0.5 font-mono flex gap-1">
                   {data.pemberi.npwp.split('').map((char, i) => (
                    <span key={i} className="border border-black px-1 min-w-[1.2rem] text-center">{char}</span>
                  ))}
                </div>
              </div>

              {/* Table Construction */}
              <div className="mt-4 border-t border-black">
                <div className="grid grid-cols-[40px_1fr_120px] font-bold text-center">
                  <div className="p-1 border-r border-black">No. Urut</div>
                  <div className="p-1 border-r border-black">Jasa Kena Pajak yang dibatalkan</div>
                  <div className="p-1 uppercase text-xs flex flex-col justify-center">
                    <span>Penggantian JKP</span>
                    <span>(Rp)</span>
                  </div>
                </div>

                {data.items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-[40px_1fr_120px] border-t border-black min-h-[150px]">
                    <div className="p-2 text-center border-r border-black">{idx + 1}</div>
                    <div className="p-2 border-r border-black whitespace-pre-wrap">{item.description}</div>
                    <div className="p-2 text-right tabular-nums">{formatCurrency(item.amount)}</div>
                  </div>
                ))}

                <div className="grid grid-cols-[1fr_120px] border-t border-black font-bold">
                  <div className="p-1 px-2 border-r border-black">Jumlah Penggantian JKP yang dibatalkan</div>
                  <div className="p-1 text-right tabular-nums">{formatCurrency(totalAmount)}</div>
                </div>
                <div className="grid grid-cols-[1fr_120px] border-t border-black font-bold">
                  <div className="p-1 px-2 border-r border-black">PPN yang diminta kembali</div>
                  <div className="p-1 text-right tabular-nums">{formatCurrency(ppnAmount)}</div>
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="mt-auto pt-12 self-end text-center min-w-[300px]">
              <p>Jakarta, {formatDateIndo(data.tanggalDokumen)}</p>
              <p className="mt-1 font-bold">{data.penandatangan}</p>
              <div className="h-24"></div>
            </div>
          </div>
          
          <div className="mt-6 p-5 glass-panel !rounded-2xl border-sky-500/10 flex items-start gap-4 print:hidden shadow-xl shadow-sky-500/5">
            <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm">Tips Pencetakan</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-medium">
                Gunakan menu <b className="text-sky-400">"Cetak / Save PDF"</b> di atas. Pada jendela browser, pilih <b className="text-sky-400">"Hanya Konten Situs"</b> dan matikan <b className="text-sky-400">"Header and Footer"</b> untuk hasil terbaik yang menyerupai dokumen asli.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer (Screen Only) */}
      <footer className="mt-16 py-12 border-t border-white/5 bg-slate-950/20 print:hidden">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-xs font-medium tracking-widest uppercase">
            &copy; {new Date().getFullYear()} Nota Pembatalan Generator &bull; Designed for Professionals
          </p>
        </div>
      </footer>
    </div>
  );
}
