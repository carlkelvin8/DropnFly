"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";

const ChatBot = dynamic(() => import("@/components/chat/ChatBot"), {
  ssr: false,
  loading: () => null,
});

export function ChatBotClient() {
  const [loaded, setLoaded] = useState(false);

  const handleInteract = useCallback(() => {
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <button
        onClick={handleInteract}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-blue-500 text-white shadow-xl shadow-orange-500/30 transition-all hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-110 active:scale-95"
        aria-label="Open chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>
      </button>
    );
  }

  return <ChatBot />;
}
