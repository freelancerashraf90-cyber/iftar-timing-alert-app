import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { Bell, BellOff, Loader2, MapPin, Moon, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────
interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string;
}

interface PrayerData {
  timings: PrayerTimings;
  date: { readable: string };
  city: string;
  country: string;
}

interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  passed: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────
function parseTimeToToday(timeStr: string): Date {
  // timeStr like "04:32" (24h, local city time)
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h,
    m,
    0,
    0,
  );
  return target;
}

function computeCountdown(timeStr: string): Countdown {
  const target = parseTimeToToday(timeStr);
  const now = Date.now();
  let diff = target.getTime() - now;

  if (diff < 0) {
    // Already passed today — show tomorrow's
    target.setDate(target.getDate() + 1);
    diff = target.getTime() - now;
    if (diff < 0) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        passed: true,
      };
    }
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, totalSeconds, passed: false };
}

function formatTime24to12(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// ──────────────────────────────────────────────────────────────────
// Web Audio beep
// ──────────────────────────────────────────────────────────────────
function playAlertBeep(freq = 880, duration = 0.6) {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    // Second tone
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 1.25, ctx.currentTime);
      gain2.gain.setValueAtTime(0.25, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration,
      );
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + duration);
    }, 350);
  } catch {
    // Silently fail if audio is unavailable
  }
}

// ──────────────────────────────────────────────────────────────────
// Browser notifications
// ──────────────────────────────────────────────────────────────────
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function sendNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  new Notification(title, {
    body,
    icon: "/assets/generated/ramadan-logo-transparent.dim_200x200.png",
  });
}

// ──────────────────────────────────────────────────────────────────
// Star field component
// ──────────────────────────────────────────────────────────────────
const STAR_COUNT = 60;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  delay: Math.random() * 4,
  duration: 2 + Math.random() * 3,
}));

function StarField() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: "oklch(0.92 0.12 78)",
            opacity: 0,
            animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      {/* Subtle gradient nebula */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, oklch(0.22 0.06 280 / 0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, oklch(0.18 0.05 240 / 0.35) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, oklch(0.14 0.04 264 / 0.2) 0%, transparent 70%)
          `,
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Islamic geometric decoration
// ──────────────────────────────────────────────────────────────────
function GeometricDecor({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* 8-pointed Islamic star */}
      <path
        d="M60 10 L67 45 L100 30 L75 55 L110 60 L75 65 L100 90 L67 75 L60 110 L53 75 L20 90 L45 65 L10 60 L45 55 L20 30 L53 45 Z"
        fill="oklch(0.78 0.16 72 / 0.12)"
        stroke="oklch(0.78 0.16 72 / 0.3)"
        strokeWidth="0.5"
      />
      <circle
        cx="60"
        cy="60"
        r="16"
        fill="none"
        stroke="oklch(0.78 0.16 72 / 0.2)"
        strokeWidth="0.5"
      />
      <circle
        cx="60"
        cy="60"
        r="30"
        fill="none"
        stroke="oklch(0.78 0.16 72 / 0.1)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
// Countdown Card
// ──────────────────────────────────────────────────────────────────
interface CountdownCardProps {
  type: "sehri" | "iftar";
  label: string;
  timeStr: string | null;
  countdown: Countdown | null;
  isLoading: boolean;
}

function CountdownCard({
  type,
  label,
  timeStr,
  countdown,
  isLoading,
}: CountdownCardProps) {
  const isAlert =
    countdown !== null && !countdown.passed && countdown.totalSeconds <= 600;
  const isPassed = countdown?.passed ?? false;
  const isSehri = type === "sehri";

  const cardDataOcid = isSehri ? "sehri.card" : "iftar.card";
  const loadingDataOcid = isSehri
    ? "sehri.loading_state"
    : "iftar.loading_state";

  const icon = isSehri ? "🌙" : "🌅";
  const eventLabel = isSehri ? "Sehri ends at" : "Iftar at";

  return (
    <motion.div
      data-ocid={cardDataOcid}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: isSehri ? 0 : 0.15 }}
      className={`
        relative overflow-hidden rounded-3xl border p-6 md:p-8
        transition-all duration-500
        ${
          isAlert
            ? "border-amber-500/60 animate-pulse-amber bg-[oklch(0.15_0.04_55)]"
            : "border-[oklch(0.78_0.16_72_/_0.2)] bg-[oklch(0.16_0.03_262)] glow-gold"
        }
      `}
      style={
        isAlert
          ? {
              boxShadow:
                "0 0 40px oklch(0.72 0.2 55 / 0.5), 0 0 100px oklch(0.72 0.2 55 / 0.2)",
            }
          : {
              boxShadow:
                "0 0 20px oklch(0.78 0.16 72 / 0.2), 0 0 60px oklch(0.78 0.16 72 / 0.08)",
            }
      }
    >
      {/* Decorative geometric corner */}
      <GeometricDecor className="absolute -top-6 -right-6 w-28 h-28 opacity-40" />
      <GeometricDecor className="absolute -bottom-6 -left-6 w-20 h-20 opacity-20 rotate-45" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <span className="text-3xl">{icon}</span>
        <div>
          <h2 className="font-display text-xl md:text-2xl font-bold text-gold-bright">
            {label}
          </h2>
          {timeStr && (
            <p
              className="text-sm font-sans mt-0.5"
              style={{ color: "oklch(0.7 0.08 72)" }}
            >
              {eventLabel}{" "}
              <span className="font-semibold text-gold-bright">
                {formatTime24to12(timeStr)}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Countdown display */}
      <div className="relative z-10 min-h-[100px] flex items-center justify-center">
        {isLoading ? (
          <div
            data-ocid={loadingDataOcid}
            className="flex flex-col items-center gap-3"
          >
            <Loader2 className="w-8 h-8 animate-spin text-gold-bright" />
            <p className="text-sm" style={{ color: "oklch(0.6 0.06 72)" }}>
              Fetching times…
            </p>
          </div>
        ) : !timeStr ? (
          <div className="text-center">
            <p
              className="text-5xl font-display font-bold"
              style={{ color: "oklch(0.35 0.04 264)" }}
            >
              --:--:--
            </p>
            <p
              className="text-sm mt-2"
              style={{ color: "oklch(0.45 0.04 72)" }}
            >
              Enter location to start
            </p>
          </div>
        ) : isPassed ? (
          <div className="text-center">
            <p
              className="text-4xl font-display font-bold"
              style={{ color: "oklch(0.55 0.1 72)" }}
            >
              Passed
            </p>
            <p className="text-sm mt-2" style={{ color: "oklch(0.5 0.06 72)" }}>
              Counting for tomorrow
            </p>
          </div>
        ) : (
          <div className="text-center w-full">
            <motion.p
              key={countdown?.totalSeconds}
              className={`
                text-5xl md:text-6xl font-display font-bold tracking-tight
                ${isAlert ? "text-glow-amber animate-shimmer" : "text-glow-gold"}
              `}
              style={isAlert ? {} : { color: "oklch(0.88 0.18 78)" }}
              initial={{ scale: 1.04 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {countdown
                ? `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`
                : "--:--:--"}
            </motion.p>
            {isAlert && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-semibold mt-2 tracking-widest uppercase"
                style={{ color: "oklch(0.72 0.2 55)" }}
              >
                ⚡ Alert Zone — {countdown!.minutes}m {pad(countdown!.seconds)}s
                remaining
              </motion.p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Prayer time row
// ──────────────────────────────────────────────────────────────────
const PRAYER_DISPLAY: { key: string; label: string; emoji: string }[] = [
  { key: "Fajr", label: "Fajr (Sehri)", emoji: "🌙" },
  { key: "Sunrise", label: "Sunrise", emoji: "🌤" },
  { key: "Dhuhr", label: "Dhuhr", emoji: "☀️" },
  { key: "Asr", label: "Asr", emoji: "🌦" },
  { key: "Maghrib", label: "Maghrib (Iftar)", emoji: "🌅" },
  { key: "Isha", label: "Isha", emoji: "🌟" },
];

// ──────────────────────────────────────────────────────────────────
// Main App
// ──────────────────────────────────────────────────────────────────
export default function App() {
  const [city, setCity] = useState<string>(
    () => localStorage.getItem("iftar_city") ?? "Dhaka",
  );
  const [country, setCountry] = useState<string>(
    () => localStorage.getItem("iftar_country") ?? "Bangladesh",
  );
  const [prayerData, setPrayerData] = useState<PrayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifGranted, setNotifGranted] = useState(
    typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  );

  const [sehriCountdown, setSehriCountdown] = useState<Countdown | null>(null);
  const [iftarCountdown, setIftarCountdown] = useState<Countdown | null>(null);

  // Track whether we've already fired the 10-min and 0:00 alerts this cycle
  const alertFiredRef = useRef<{
    sehri10: boolean;
    sehri0: boolean;
    iftar10: boolean;
    iftar0: boolean;
  }>({ sehri10: false, sehri0: false, iftar10: false, iftar0: false });

  // ── Fetch prayer times ──
  const fetchPrayerTimes = useCallback(
    async (cityVal: string, countryVal: string) => {
      if (!cityVal.trim() || !countryVal.trim()) return;

      setLoading(true);
      setError(null);
      alertFiredRef.current = {
        sehri10: false,
        sehri0: false,
        iftar10: false,
        iftar0: false,
      };

      try {
        const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityVal)}&country=${encodeURIComponent(countryVal)}&method=2`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        if (json.code !== 200 || !json.data?.timings) {
          throw new Error(
            json.status ?? "City not found. Please check city/country.",
          );
        }
        const data: PrayerData = {
          timings: json.data.timings as PrayerTimings,
          date: json.data.date,
          city: cityVal,
          country: countryVal,
        };
        setPrayerData(data);
        localStorage.setItem("iftar_city", cityVal);
        localStorage.setItem("iftar_country", countryVal);

        // Request notification permission on first successful fetch
        const granted = await requestNotificationPermission();
        setNotifGranted(granted);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch prayer times.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Auto-fetch on first mount if saved city/country exist
  useEffect(() => {
    const savedCity = localStorage.getItem("iftar_city");
    const savedCountry = localStorage.getItem("iftar_country");
    if (savedCity && savedCountry) {
      fetchPrayerTimes(savedCity, savedCountry);
    }
  }, [fetchPrayerTimes]);

  // ── Countdown tick ──
  useEffect(() => {
    if (!prayerData) return;

    const tick = () => {
      const sehri = computeCountdown(prayerData.timings.Fajr);
      const iftar = computeCountdown(prayerData.timings.Maghrib);

      setSehriCountdown(sehri);
      setIftarCountdown(iftar);

      // 10-minute Sehri alert
      if (
        !sehri.passed &&
        sehri.totalSeconds <= 600 &&
        sehri.totalSeconds > 598 &&
        !alertFiredRef.current.sehri10
      ) {
        alertFiredRef.current.sehri10 = true;
        playAlertBeep(660);
        sendNotification(
          "🌙 Sehri Alert",
          "Sehri ends in 10 minutes! Finish your meal.",
        );
        toast.warning("⏰ Sehri ends in 10 minutes!", {
          description: "Finish your Sehri meal soon.",
          duration: 8000,
        });
      }

      // Sehri time ends (0:00)
      if (
        !sehri.passed &&
        sehri.totalSeconds === 0 &&
        !alertFiredRef.current.sehri0
      ) {
        alertFiredRef.current.sehri0 = true;
        playAlertBeep(440, 1.2);
        sendNotification(
          "🌙 Sehri Time Has Ended",
          "Fast begins now. May your fast be accepted.",
        );
        toast.error("🌙 Sehri time has ended!", {
          description: "May your fast be accepted.",
          duration: 10000,
        });
      }

      // 10-minute Iftar alert
      if (
        !iftar.passed &&
        iftar.totalSeconds <= 600 &&
        iftar.totalSeconds > 598 &&
        !alertFiredRef.current.iftar10
      ) {
        alertFiredRef.current.iftar10 = true;
        playAlertBeep(880);
        sendNotification(
          "🌅 Iftar Alert",
          "Iftar in 10 minutes! Prepare to break your fast.",
        );
        toast.warning("⏰ Iftar in 10 minutes!", {
          description: "Prepare to break your fast.",
          duration: 8000,
        });
      }

      // Iftar time (0:00)
      if (
        !iftar.passed &&
        iftar.totalSeconds === 0 &&
        !alertFiredRef.current.iftar0
      ) {
        alertFiredRef.current.iftar0 = true;
        playAlertBeep(1046, 1.2);
        sendNotification(
          "🌅 It's Iftar Time!",
          "Break your fast now. Ramadan Mubarak!",
        );
        toast.success("🌅 It's Iftar Time!", {
          description: "Break your fast now. Ramadan Mubarak! 🎉",
          duration: 12000,
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [prayerData]);

  // ── Form submit ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPrayerTimes(city, country);
  };

  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-dvh pattern-islamic overflow-x-hidden">
      <StarField />
      <Toaster richColors position="top-right" />

      {/* ── Header ── */}
      <header className="relative z-10 pt-10 pb-6 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src="/assets/generated/ramadan-logo-transparent.dim_200x200.png"
            alt="Ramadan crescent moon logo"
            className="w-24 h-24 md:w-32 md:h-32 drop-shadow-2xl animate-float"
            style={{
              filter: "drop-shadow(0 0 20px oklch(0.78 0.16 72 / 0.5))",
            }}
          />

          <div>
            <h1
              className="font-display text-3xl md:text-5xl font-bold tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.88 0.18 78), oklch(0.78 0.16 72), oklch(0.65 0.12 65))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "none",
              }}
            >
              Iftar Timing Alert App
            </h1>
            <p
              className="mt-2 font-sans text-base md:text-lg"
              style={{ color: "oklch(0.7 0.08 72)" }}
            >
              رمضان مبارك &nbsp;·&nbsp; Ramadan Mubarak
            </p>

            {/* Notification status badge */}
            <div className="mt-3 flex justify-center">
              {notifGranted ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                  style={{
                    background: "oklch(0.22 0.06 140 / 0.4)",
                    color: "oklch(0.75 0.15 140)",
                    border: "1px solid oklch(0.6 0.12 140 / 0.3)",
                  }}
                >
                  <Bell className="w-3 h-3" /> Alerts enabled
                </span>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full cursor-pointer"
                  style={{
                    background: "oklch(0.22 0.04 55 / 0.3)",
                    color: "oklch(0.7 0.1 55)",
                    border: "1px solid oklch(0.6 0.1 55 / 0.3)",
                  }}
                  onClick={() =>
                    requestNotificationPermission().then(setNotifGranted)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      requestNotificationPermission().then(setNotifGranted);
                    }
                  }}
                >
                  <BellOff className="w-3 h-3" /> Click to enable alerts
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pb-16">
        {/* ── Location Form ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 rounded-2xl border p-5 md:p-6"
          style={{
            background: "oklch(0.16 0.03 262 / 0.9)",
            borderColor: "oklch(0.78 0.16 72 / 0.2)",
            boxShadow: "0 4px 24px oklch(0.06 0.02 264 / 0.6)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin
                className="w-4 h-4 text-gold"
                style={{ color: "oklch(0.78 0.16 72)" }}
              />
              <span
                className="font-heading font-semibold text-sm tracking-wide uppercase"
                style={{ color: "oklch(0.7 0.08 72)" }}
              >
                Your Location
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="city-input"
                  className="text-sm font-sans"
                  style={{ color: "oklch(0.75 0.08 72)" }}
                >
                  City
                </Label>
                <Input
                  id="city-input"
                  data-ocid="location.city_input"
                  type="text"
                  placeholder="e.g. Dhaka"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="font-sans text-base h-11 border-[oklch(0.3_0.04_262)] focus-visible:ring-[oklch(0.78_0.16_72)]"
                  style={{
                    background: "oklch(0.13 0.025 264)",
                    color: "oklch(0.92 0.02 72)",
                    borderColor: "oklch(0.28 0.04 262)",
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="country-input"
                  className="text-sm font-sans"
                  style={{ color: "oklch(0.75 0.08 72)" }}
                >
                  Country
                </Label>
                <Input
                  id="country-input"
                  data-ocid="location.country_input"
                  type="text"
                  placeholder="e.g. Bangladesh"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  className="font-sans text-base h-11 border-[oklch(0.3_0.04_262)] focus-visible:ring-[oklch(0.78_0.16_72)]"
                  style={{
                    background: "oklch(0.13 0.025 264)",
                    color: "oklch(0.92 0.02 72)",
                    borderColor: "oklch(0.28 0.04 262)",
                  }}
                />
              </div>
            </div>

            <Button
              type="submit"
              data-ocid="location.submit_button"
              disabled={loading}
              className="h-11 font-heading font-semibold text-sm tracking-wide w-full sm:w-auto sm:self-end px-8 rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.78 0.16 72), oklch(0.68 0.14 65))",
                color: "oklch(0.12 0.028 264)",
                boxShadow: "0 0 16px oklch(0.78 0.16 72 / 0.3)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Fetching…
                </>
              ) : (
                "Get Prayer Times"
              )}
            </Button>
          </form>
        </motion.section>

        {/* ── Error State ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              data-ocid="prayer.error_state"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 rounded-xl border px-5 py-4 flex items-start gap-3"
              style={{
                background: "oklch(0.15 0.04 22 / 0.6)",
                borderColor: "oklch(0.62 0.22 22 / 0.4)",
              }}
            >
              <span className="text-xl">⚠️</span>
              <div>
                <p
                  className="font-heading font-semibold text-sm"
                  style={{ color: "oklch(0.8 0.2 22)" }}
                >
                  Could not fetch prayer times
                </p>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "oklch(0.7 0.12 22)" }}
                >
                  {error}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Date display ── */}
        <AnimatePresence>
          {prayerData && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm mb-5 font-sans"
              style={{ color: "oklch(0.6 0.06 72)" }}
            >
              <Star
                className="inline w-3 h-3 mr-1"
                style={{ color: "oklch(0.78 0.16 72)" }}
              />
              Prayer times for{" "}
              <span style={{ color: "oklch(0.78 0.16 72)" }}>
                {prayerData.city}, {prayerData.country}
              </span>{" "}
              — {prayerData.date?.readable}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── Countdown Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <CountdownCard
            type="sehri"
            label="Sehri"
            timeStr={prayerData?.timings.Fajr ?? null}
            countdown={sehriCountdown}
            isLoading={loading}
          />
          <CountdownCard
            type="iftar"
            label="Iftar"
            timeStr={prayerData?.timings.Maghrib ?? null}
            countdown={iftarCountdown}
            isLoading={loading}
          />
        </div>

        {/* ── Prayer Times List ── */}
        <AnimatePresence>
          {prayerData && (
            <motion.section
              data-ocid="prayer.list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border overflow-hidden"
              style={{
                background: "oklch(0.16 0.03 262 / 0.85)",
                borderColor: "oklch(0.78 0.16 72 / 0.15)",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: "oklch(0.78 0.16 72 / 0.12)" }}
              >
                <Moon
                  className="w-4 h-4"
                  style={{ color: "oklch(0.78 0.16 72)" }}
                />
                <h3
                  className="font-heading font-semibold text-sm tracking-wide uppercase"
                  style={{ color: "oklch(0.78 0.16 72)" }}
                >
                  All Prayer Times
                </h3>
              </div>

              <div
                className="divide-y"
                style={{ borderColor: "oklch(0.78 0.16 72 / 0.08)" }}
              >
                {PRAYER_DISPLAY.map((p, idx) => {
                  const time = prayerData.timings[p.key] as string | undefined;
                  const isFajr = p.key === "Fajr";
                  const isMaghrib = p.key === "Maghrib";
                  return (
                    <motion.div
                      key={p.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className="flex items-center justify-between px-5 py-3.5"
                      style={
                        isFajr || isMaghrib
                          ? { background: "oklch(0.78 0.16 72 / 0.05)" }
                          : {}
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{p.emoji}</span>
                        <span
                          className="font-sans text-sm font-medium"
                          style={{
                            color:
                              isFajr || isMaghrib
                                ? "oklch(0.88 0.18 78)"
                                : "oklch(0.82 0.08 72)",
                          }}
                        >
                          {p.label}
                        </span>
                        {(isFajr || isMaghrib) && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-sans"
                            style={{
                              background: "oklch(0.78 0.16 72 / 0.2)",
                              color: "oklch(0.88 0.18 78)",
                            }}
                          >
                            {isFajr ? "Sehri" : "Iftar"}
                          </span>
                        )}
                      </div>
                      <span
                        className="font-display font-semibold text-base"
                        style={{ color: "oklch(0.88 0.18 78)" }}
                      >
                        {time ? formatTime24to12(time) : "—"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Empty state — no data yet */}
        {!prayerData && !loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🌙</div>
            <p
              className="font-display text-lg"
              style={{ color: "oklch(0.55 0.06 72)" }}
            >
              Enter your city above to see prayer times and start the countdown
            </p>
          </motion.div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t py-6 text-center"
        style={{ borderColor: "oklch(0.78 0.16 72 / 0.12)" }}
      >
        <p
          className="text-xs font-sans"
          style={{ color: "oklch(0.45 0.05 72)" }}
        >
          © {year}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            style={{ color: "oklch(0.65 0.1 72)" }}
          >
            caffeine.ai
          </a>
        </p>
        <p
          className="text-xs mt-1 font-sans"
          style={{ color: "oklch(0.35 0.04 72)" }}
        >
          Prayer times powered by Al Adhan API
        </p>
      </footer>
    </div>
  );
}
