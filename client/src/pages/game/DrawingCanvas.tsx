import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number; erase: boolean };

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [, setRedoStack] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#f3f2ff');
  const [width, setWidth] = useState(6);
  const [portraitWarning, setPortraitWarning] = useState(false);
  const currentStroke = useRef<Stroke | null>(null);

  useEffect(() => {
    function checkOrientation() {
      setPortraitWarning(window.innerWidth < 700 && window.innerHeight > window.innerWidth);
    }
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1024';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      drawStroke(ctx, s);
    }
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length < 2) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = s.erase ? '#0f1024' : s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Route all subsequent pointer events (even ones that move outside the
    // canvas mid-stroke) back to this element, so a touch gesture can't get
    // "lost" between the canvas and the page behind it.
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    currentStroke.current = { points: [getPos(e)], color, width: tool === 'eraser' ? width * 3 : width, erase: tool === 'eraser' };
    setRedoStack([]);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || !currentStroke.current) return;
    currentStroke.current.points.push(getPos(e));
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && currentStroke.current.points.length > 1) {
      const pts = currentStroke.current.points;
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = currentStroke.current.erase ? '#0f1024' : currentStroke.current.color;
      ctx.lineWidth = currentStroke.current.width;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  function onPointerUp() {
    if (currentStroke.current) {
      setStrokes((prev) => [...prev, currentStroke.current!]);
      currentStroke.current = null;
    }
    setDrawing(false);
  }

  function undo() {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setRedoStack((r) => [...r, prev[prev.length - 1]]);
      return next;
    });
  }

  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const stroke = prev[prev.length - 1];
      setStrokes((s) => [...s, stroke]);
      return prev.slice(0, -1);
    });
  }

  function clearAll() {
    setStrokes([]);
    setRedoStack([]);
  }

  const colors = ['#f3f2ff', '#ff5c72', '#ffc94d', '#34d399', '#3fc6ff', '#7c5cff'];

  return (
    <div className="flex flex-col gap-3">
      {portraitWarning && (
        <div className="text-center text-sm rounded-lg py-2 px-3 bg-[var(--color-surface-hi)] text-[var(--color-gold)]">
          📱 يجب تدوير الجهاز إلى الوضع الأفقي للرسم
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-[var(--color-border)] touch-none"
        style={{ height: 320, background: '#0f1024', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className={`btn !py-1.5 !px-3 text-sm ${tool === 'pen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTool('pen')}>
          ✏️ قلم
        </button>
        <button className={`btn !py-1.5 !px-3 text-sm ${tool === 'eraser' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTool('eraser')}>
          🧹 مساحة
        </button>
        <button className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={undo}>
          ↩️ تراجع
        </button>
        <button className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={redo}>
          ↪️ تقدم
        </button>
        <button className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={clearAll}>
          🗑️ امسح الرسم
        </button>
        <div className="flex items-center gap-1 mr-auto">
          {colors.map((c) => (
            <button
              key={c}
              className="w-6 h-6 rounded-full border-2"
              style={{ background: c, borderColor: color === c ? 'white' : 'transparent' }}
              onClick={() => {
                setColor(c);
                setTool('pen');
              }}
            />
          ))}
        </div>
        <select className="input !w-auto !py-1.5 text-sm" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
          <option value={3}>رفيع</option>
          <option value={6}>متوسط</option>
          <option value={12}>سميك</option>
        </select>
      </div>
    </div>
  );
}
