"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  Brain,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  startSocraticConversationAction,
  sendSocraticMessageAction,
  getSocraticConversationAction,
} from "@/server/actions/talent";
import type { SocraticMessage } from "@/server/services/talent-socratic";

export interface SocraticMentorChatProps {
  skillId?: string;
  challengeId?: string;
  skillName?: string;
}

export function SocraticMentorChat({
  skillId,
  challengeId,
  skillName,
}: SocraticMentorChatProps) {
  const t = useTranslations("Talent");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SocraticMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start a conversation on mount.
  useEffect(() => {
    async function start() {
      setStarting(true);
      const res = await startSocraticConversationAction({
        skillId,
        challengeId,
        title: skillName ? `Mentor — ${skillName}` : "Conversation avec ton mentor",
      });
      setStarting(false);
      if (res.success) {
        setConversationId(res.data.conversationId);
        // If there's an existing conversation with messages, load them.
        const convRes = await getSocraticConversationAction(
          res.data.conversationId,
        );
        if (convRes.success && convRes.data?.messages) {
          setMessages(convRes.data.messages);
        }
      }
    }
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, challengeId]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !conversationId) return;
    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Optimistic update: append user's message.
    const optimisticMessages = [
      ...messages,
      {
        role: "user" as const,
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ];
    setMessages(optimisticMessages);

    const res = await sendSocraticMessageAction({
      conversationId,
      message: userMessage,
    });
    setLoading(false);

    if (res.success) {
      // Append the assistant's response.
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.response,
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      toast.error(res.error?.message ?? t("messageSendFailed"));
      // Revert optimistic update.
      setMessages(messages);
    }
  }

  return (
    <Card className="flex h-[600px] flex-col overflow-hidden border-0 bg-gradient-to-br from-violet-950 via-purple-950 to-fuchsia-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
          <Brain className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold">
            {t("socraticMentor")}
          </h3>
          <p className="text-xs text-white/60">
            {skillName ? `${t("discussing")} ${skillName}` : t("askAnything")}
          </p>
        </div>
        <Sparkles className="size-5 text-white/40" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <MessageSquare className="size-12 text-white/30" />
            <p className="text-sm text-white/60">{t("socraticEmpty")}</p>
            <p className="max-w-xs text-xs text-white/40">
              {t("socraticEmptyDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                        : "bg-white/10 text-white/90"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm text-white/70">
                  <Loader2 className="size-4 animate-spin" />
                  {t("mentorThinking")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("typeMessage")}
            className="min-h-[44px] resize-none border-white/20 bg-white/5 text-white placeholder:text-white/40"
            rows={1}
            disabled={loading || starting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={loading || starting || !input.trim()}
            className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
