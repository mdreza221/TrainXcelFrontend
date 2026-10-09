"use client";
import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/libs/api";
import io from "socket.io-client";

function normalizeActionLink(link?: string | null): string | null {
  if (!link) return null;
  if (link.startsWith("/courses/")) {
    return `/dashboard/learn${link.replace("/courses", "")}`;
  }
  if (link === "/dashboard?tab=courses") {
    return "/dashboard?tab=manage-courses";
  }
  return link;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingReadIds, setLoadingReadIds] = useState<Record<number, boolean>>({});
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetchNotifications();

    let socket: any;

    api.get("/auth/token")
      .then((res) => {
        if (!active) return;
        const token = res.data?.token;
        socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000", {
          query: token ? { token } : undefined,
        });

        socket.on("notification", (notif: any) => {
          setNotifications((prev) => [notif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        });
      })
      .catch((err) => {
        console.error("Socket auth fetch failed", err);
      });

    return () => {
      active = false;
      if (socket) socket.disconnect();
    };
  }, []);

  // Click-outside handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n: any) => !n.isRead).length);
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id: number) => {
    if (!id) {
      console.warn("Attempted to mark notification as read with undefined ID");
      return;
    }
    setLoadingReadIds((prev) => ({ ...prev, [id]: true }));
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReadIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const markAllRead = async () => {
    setIsMarkingAllRead(true);
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const openNotification = (notif: any) => {
    setIsOpen(false);
    if (notif.id && !notif.isRead) {
      markAsRead(notif.id);
    }
    const link = normalizeActionLink(notif.actionLink);
    if (link) {
      router.push(link);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{ position: "relative" }}
        className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+8px)] -right-16 sm:right-0 z-[9999] w-[300px] sm:w-[320px] max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-fadeIn"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
            <h4 className="font-bold text-slate-900 dark:text-zinc-50 text-sm">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {unreadCount} new
                </span>
              )}
            </h4>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={isMarkingAllRead}
                  className="text-[10px] font-semibold text-blue-600 hover:underline dark:text-blue-400 disabled:opacity-50 flex items-center gap-1"
                >
                  {isMarkingAllRead && <Loader2 size={10} className="animate-spin" />}
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={28} className="mx-auto text-slate-200 dark:text-zinc-700 mb-2" />
                <p className="text-slate-500 dark:text-zinc-400 text-sm">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id || notif.createdAt}
                  onClick={() => openNotification(notif)}
                  className={`px-4 py-3 border-b border-slate-50 dark:border-zinc-800/60 flex gap-3 items-start cursor-pointer ${
                    !notif.isRead ? "bg-blue-50/40 dark:bg-blue-900/10" : "hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                  }`}
                >
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      !notif.isRead ? "bg-blue-500" : "bg-transparent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug ${
                        !notif.isRead
                          ? "font-semibold text-slate-900 dark:text-zinc-100"
                          : "text-slate-600 dark:text-zinc-300"
                      }`}
                    >
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                      disabled={loadingReadIds[notif.id]}
                      className="h-7 w-7 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 flex items-center justify-center shrink-0 transition disabled:opacity-50"
                      title="Mark as read"
                    >
                      {loadingReadIds[notif.id] ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
