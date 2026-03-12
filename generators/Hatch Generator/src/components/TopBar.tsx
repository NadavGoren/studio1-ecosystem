import { useAppStore } from '../store';
import { 
  MousePointer2, MousePointer, Square, Circle, Hexagon, 
  Minus, Undo2, Redo2, Download, ZoomIn, ZoomOut, Maximize,
  AlignLeft, AlignCenter, AlignRight, 
  ArrowUpToLine, FoldVertical, ArrowDownToLine
} from 'lucide-react';
import { exportToSVG, downloadSVG } from '../lib/svg-export';

export function TopBar() {
  const { 
    tool, setTool, undo, redo, zoomToFit, setZoom, viewTransform,
    selectedShapeIds, alignSelection 
  } = useAppStore();
  const state = useAppStore();

  const handleExport = () => {
    const svg = exportToSVG(state);
    downloadSVG(svg, 'hatch-design.svg');
  };

  const ToolBtn = ({ id, icon: Icon, label }: any) => (
    <button
      onClick={() => setTool(id)}
      className={`p-2 rounded-lg transition-all flex items-center justify-center ${tool === id ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-black'}`}
      title={label}
    >
      <Icon size={18} />
    </button>
  );

  const AlignBtn = ({ icon: Icon, label, action }: any) => (
    <button
      onClick={action}
      disabled={selectedShapeIds.length === 0}
      className="p-1.5 rounded-md text-gray-500 hover:bg-white hover:text-black hover:shadow-sm transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
      title={label}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-30 relative">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">H</div>
        <span className="font-bold text-lg tracking-tight">HatchStudio</span>
      </div>

      {/* CENTER: Creation Tools */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
        <ToolBtn id="select" icon={MousePointer2} label="Select (V)" />
        <ToolBtn id="direct_select" icon={MousePointer} label="Direct Select (A)" />
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <ToolBtn id="rectangle" icon={Square} label="Rectangle (R)" />
        <ToolBtn id="ellipse" icon={Circle} label="Ellipse (O)" />
        <ToolBtn id="polygon" icon={Hexagon} label="Polygon (P)" />
        <ToolBtn id="line" icon={Minus} label="Line (L)" />
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-3">
        {/* ALIGNMENT TOOLS (Always Visible) */}
        <div className="flex items-center gap-0.5 bg-gray-50 p-1 rounded-lg border border-gray-100 mr-2">
          <AlignBtn icon={AlignLeft} label="Align Left" action={() => alignSelection('left')} />
          <AlignBtn icon={AlignCenter} label="Align Center" action={() => alignSelection('center')} />
          <AlignBtn icon={AlignRight} label="Align Right" action={() => alignSelection('right')} />
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <AlignBtn icon={ArrowUpToLine} label="Align Top" action={() => alignSelection('top')} />
          <AlignBtn icon={FoldVertical} label="Align Middle" action={() => alignSelection('middle')} />
          <AlignBtn icon={ArrowDownToLine} label="Align Bottom" action={() => alignSelection('bottom')} />
        </div>

        <div className="flex items-center gap-1 mr-2">
           <button onClick={undo} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><Undo2 size={18}/></button>
           <button onClick={redo} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><Redo2 size={18}/></button>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
           <button onClick={() => setZoom(viewTransform.scale - 0.1)} className="p-1.5 hover:bg-white rounded text-gray-600"><ZoomOut size={16}/></button>
           <span className="text-xs font-mono w-12 text-center text-gray-600">{Math.round(viewTransform.scale * 100)}%</span>
           <button onClick={() => setZoom(viewTransform.scale + 0.1)} className="p-1.5 hover:bg-white rounded text-gray-600"><ZoomIn size={16}/></button>
           <button onClick={zoomToFit} className="p-1.5 hover:bg-white rounded text-gray-600" title="Fit"><Maximize size={16}/></button>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium ml-2 shadow-sm"
        >
          <Download size={16} /> Export
        </button>
      </div>
    </div>
  );
}








