import { useEffect, useRef, useState } from "react";
import { Crop, Image, Loader2, Play, RotateCcw, Ruler, Wand2, Grid, Waves, Eye } from "lucide-react";

const API_URL = "http://127.0.0.1:5500";
const A3_ASPECT = 297 / 420;

function App() {
  const [image, setImage] = useState(null);
  const [svgContent, setSvgContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Settings
  const [mode, setMode] = useState("flow");
  const [margin, setMargin] = useState(20);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState("cover");
  const [stroke, setStroke] = useState(0.3);

  // Params
  const [flow, setFlow] = useState({ count: 4000, length: 100, blur: 21, contrast: 200 });
  const [hatch, setHatch] = useState({ grid: 10, angle: 45, contrast: 1.0, showGrid: true });

  const stageRef = useRef(null);
  const marginPercentX = (margin / 297) * 100;
  const marginPercentY = (margin / 420) * 100;

  const handleUpload = (e) => { if (e.target.files?.[0]) setImage(e.target.files[0]); };

  const handleGenerate = async () => {
    if (!image) return setError("Please upload an image first.");
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("image", image);
    fd.append("generatorMode", mode);
    fd.append("margin", margin);
    fd.append("rotation", rotation);
    fd.append("fitMode", fitMode);
    fd.append("strokeWidth", stroke);

    if (mode === "flow") {
      fd.append("lineCount", flow.count);
      fd.append("lineLength", flow.length);
      fd.append("blurRadius", flow.blur);
      fd.append("contrast", flow.contrast);
    } else {
      fd.append("gridSize", hatch.grid);
      fd.append("hatchAngle", hatch.angle);
      fd.append("contrast", hatch.contrast);
      fd.append("showGrid", hatch.showGrid); // Sending the toggle state
    }

    try {
      const res = await fetch(`${API_URL}/generate`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSvgContent(data.svg);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
        <div className="p-5 border-b border-slate-800">
          <h1 className="font-bold text-lg mb-4 flex items-center gap-2"><Wand2 className="text-blue-500"/> Plotter Lab</h1>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['flow', 'hatch'].map(m => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize ${mode === m ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                {m === 'flow' ? <Waves size={14} className="inline mr-1"/> : <Grid size={14} className="inline mr-1"/>} {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
             <label className="block p-3 border border-dashed border-slate-700 rounded-lg hover:bg-slate-800 cursor-pointer">
               <span className="text-xs text-slate-400 block mb-1">Image Source</span>
               <div className="flex items-center gap-2 text-sm font-medium truncate"><Image size={16}/> {image ? image.name : "Select File..."}</div>
               <input type="file" className="hidden" onChange={handleUpload} />
             </label>
             <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setRotation((r) => (r + 90) % 360)} className="py-2 bg-slate-900 rounded-lg text-xs font-bold border border-slate-800 hover:bg-slate-800"><RotateCcw size={14} className="inline"/> {rotation}°</button>
               <button onClick={() => setFitMode(m => m === 'cover' ? 'contain' : 'cover')} className="py-2 bg-slate-900 rounded-lg text-xs font-bold border border-slate-800 hover:bg-slate-800 capitalize"><Crop size={14} className="inline"/> {fitMode}</button>
             </div>
             <div>
               <div className="flex justify-between text-xs mb-2 text-slate-400"><span>Pen Width</span><span>{stroke} mm</span></div>
               <input type="range" min="0.1" max="2.0" step="0.1" value={stroke} onChange={e => setStroke(Number(e.target.value))} className="w-full accent-blue-500"/>
             </div>
             <div>
               <div className="flex justify-between text-xs mb-2 text-slate-400"><span>Margin</span><span>{margin} mm</span></div>
               <input type="range" min="0" max="80" step="5" value={margin} onChange={e => setMargin(Number(e.target.value))} className="w-full accent-blue-500"/>
             </div>
          </div>

          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Algorithm Settings</h3>
            {mode === 'flow' ? (
              <>
                <div><span className="text-xs text-slate-400 block mb-2">Density ({flow.count})</span><input type="range" min="1000" max="10000" step="500" value={flow.count} onChange={e => setFlow({...flow, count: Number(e.target.value)})} className="w-full accent-purple-500"/></div>
                <div><span className="text-xs text-slate-400 block mb-2">Length ({flow.length})</span><input type="range" min="10" max="300" step="10" value={flow.length} onChange={e => setFlow({...flow, length: Number(e.target.value)})} className="w-full accent-purple-500"/></div>
                <div><span className="text-xs text-slate-400 block mb-2">Smoothness ({flow.blur})</span><input type="range" min="1" max="101" step="2" value={flow.blur} onChange={e => setFlow({...flow, blur: Number(e.target.value)})} className="w-full accent-purple-500"/></div>
                <div><span className="text-xs text-slate-400 block mb-2">Threshold ({flow.contrast})</span><input type="range" min="0" max="255" step="5" value={flow.contrast} onChange={e => setFlow({...flow, contrast: Number(e.target.value)})} className="w-full accent-purple-500"/></div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-slate-400 block mb-2">Grid Size ({hatch.grid}mm)</span><input type="range" min="2" max="50" step="1" value={hatch.grid} onChange={e => setHatch({...hatch, grid: Number(e.target.value)})} className="w-full accent-emerald-500"/></div>
                <div><span className="text-xs text-slate-400 block mb-2">Angle ({hatch.angle}°)</span><input type="range" min="0" max="180" step="5" value={hatch.angle} onChange={e => setHatch({...hatch, angle: Number(e.target.value)})} className="w-full accent-emerald-500"/></div>
                <div><span className="text-xs text-slate-400 block mb-2">Contrast (x{hatch.contrast})</span><input type="range" min="0.5" max="3.0" step="0.1" value={hatch.contrast} onChange={e => setHatch({...hatch, contrast: Number(e.target.value)})} className="w-full accent-emerald-500"/></div>
                
                {/* FIXED TOGGLE BUTTON UI */}
                <button 
                  onClick={() => setHatch(h => ({...h, showGrid: !h.showGrid}))}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-between ${hatch.showGrid ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                >
                  <span className="flex items-center gap-2"><Grid size={14}/> Show Grid Lines</span>
                  
                  {/* Switch Container */}
                  <div className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${hatch.showGrid ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    {/* Switch Circle - using translate-x for smoother animation */}
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${hatch.showGrid ? 'translate-x-4' : 'translate-x-0'}`}/>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900">
          <button onClick={handleGenerate} disabled={loading} className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/10">
            {loading ? <Loader2 className="animate-spin" size={18}/> : <Play size={18}/>} GENERATE
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-black flex items-center justify-center relative overflow-hidden p-8">
        <div ref={stageRef} className="bg-white shadow-2xl relative transition-all duration-300" style={{ aspectRatio: '297/420', height: 'min(90vh, 100%)', width: 'auto' }}>
          {svgContent && <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svgContent }} />}
          <div className="absolute border border-dashed border-red-400/30 pointer-events-none" style={{ top: `${marginPercentY}%`, bottom: `${marginPercentY}%`, left: `${marginPercentX}%`, right: `${marginPercentX}%` }}/>
        </div>
      </main>
    </div>
  );
}

export default App;