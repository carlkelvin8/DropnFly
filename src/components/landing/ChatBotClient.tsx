"use client";

import dynamic from "next/dynamic";

const ChatBot = dynamic(() => import("@/components/chat/ChatBot"), { ssr: false });

export function ChatBotClient() {
  return <ChatBot />;
}
