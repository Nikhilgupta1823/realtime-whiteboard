import React from 'react'
import Whiteboard from './Whiteboard'

export default function App(){
  // simple room from URL (or default)
  const url = new URL(window.location.href);
  const room = url.searchParams.get('room') || 'main';
  return (
    <div className="app">
      <Whiteboard roomId={room} />
    </div>
  );
}
