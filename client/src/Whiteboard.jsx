 import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000'; // change when deployed

export default function Whiteboard({ roomId = 'main' }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [undoStack, setUndoStack] = useState([]);

  useEffect(() => {
    // connect socket
    socketRef.current = io(SERVER_URL);
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', roomId);
    });

    // receive line data from others
    socketRef.current.on('draw', (line) => {
      drawLineOnCanvas(line, false);
    });

    socketRef.current.on('clear-board', () => {
      clearCanvas(false);
    });

    socketRef.current.on('full-image', (dataUrl) => {
      // set canvas to provided image
      const ctx = canvasRef.current.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img,0,0);
      };
      img.src = dataUrl;
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      // preserve existing drawing by saving then restoring image
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      temp.getContext('2d').drawImage(canvas,0,0);

      const parent = canvas.parentElement;
      const newW = Math.max(600, parent.clientWidth - 40);
      const newH = Math.max(400, parent.clientHeight - 40);
      canvas.width = newW;
      canvas.height = newH;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(temp,0,0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e){
    drawing.current = true;
    lastPos.current = getPos(e);
    // push current state for undo
    pushUndo();
  }

  function stopDraw(){
    drawing.current = false;
    // after finishing stroke, optionally broadcast full canvas to help late joiners
    try {
      const dataUrl = canvasRef.current.toDataURL();
      socketRef.current.emit('full-image', { roomId, dataUrl });
    } catch(e){}
  }

  function draw(e){
    if (!drawing.current) return;
    const pos = getPos(e);
    const line = {
      from: lastPos.current,
      to: pos,
      color,
      width: lineWidth
    };
    drawLineOnCanvas(line, true);
    socketRef.current.emit('draw', { roomId, line });
    lastPos.current = pos;
    e.preventDefault();
  }

  function drawLineOnCanvas(line, stroke) {
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    ctx.lineTo(line.to.x, line.to.y);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.lineCap = 'round';
    ctx.stroke();
    if (stroke) ctx.closePath();
  }

  function clearCanvas(emit = true){
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
    if (emit) socketRef.current.emit('clear-board', roomId);
    // clear undo stack too
    setUndoStack([]);
  }

  function pushUndo(){
    try {
      const snapshot = canvasRef.current.toDataURL();
      setUndoStack(prev => {
        const next = [...prev, snapshot];
        // limit stack
        if (next.length > 20) next.shift();
        return next;
      });
    } catch(e){}
  }

  function undo(){
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = copy.pop();
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img,0,0);
        // optionally broadcast full image so others sync
        try {
          const dataUrl = canvasRef.current.toDataURL();
          socketRef.current.emit('full-image', { roomId, dataUrl });
        } catch(e){}
      };
      img.src = last;
      return copy;
    });
  }

  function downloadPNG(){
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  return (
    <>
      <div className="sidebar">
        <h3>Realtime Whiteboard</h3>
        <div className="toolbar-row">
          <label>Room:</label>
          <input value={roomId} readOnly />
        </div>

        <div className="toolbar-row">
          <label>Color:</label>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)} />
        </div>

        <div className="toolbar-row">
          <label>Width:</label>
          <input type="range" min="1" max="50" value={lineWidth} onChange={e=>setLineWidth(e.target.value)} />
          <span>{lineWidth}px</span>
        </div>

        <div className="toolbar-row">
          <button onClick={undo}>Undo</button>
          <button onClick={()=>clearCanvas(true)}>Clear</button>
          <button onClick={downloadPNG}>Download PNG</button>
        </div>

        <div className="hint">
          Open this page in another tab/browser to test real-time drawing.
        </div>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseUp={stopDraw}
          onMouseMove={draw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          width={1000}
          height={700}
        />
      </div>
    </>
  );
}