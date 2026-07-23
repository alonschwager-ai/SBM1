"use client";

import { useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { MessageCircleIcon, PhoneIcon, SirenIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { db } from "@/lib/firebase";
import { getCurrentPosition } from "@/lib/geolocation";
import { UserDoc } from "@/lib/types";

const EMERGENCY_NUMBERS = [
  { label: "משטרה", number: "100" },
  { label: "מגן דוד אדום", number: "101" },
  { label: "כיבוי אש", number: "102" },
];

// Israeli local numbers (05X-XXXXXXX) need a country code for wa.me deep
// links; strip the leading 0 and prefix +972.
function toIntlPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

async function getAdminPhone(): Promise<string | null> {
  const snapshot = await getDocs(
    query(collection(db, "users"), where("role", "==", "admin"), limit(1))
  );
  const admin = snapshot.docs[0]?.data() as UserDoc | undefined;
  return admin?.phone ?? null;
}

export function SosWidget() {
  const [locating, setLocating] = useState(false);

  async function sendLocation(channel: "whatsapp" | "sms") {
    setLocating(true);
    try {
      const [position, adminPhone] = await Promise.all([getCurrentPosition(), getAdminPhone()]);
      if (!adminPhone) {
        toast.error("לא הוגדר מספר טלפון למנהל המערכת");
        return;
      }

      const { latitude, longitude } = position.coords;
      const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
      const message = `זוהי הודעת חירום - המיקום שלי: ${mapsLink}`;

      if (channel === "whatsapp") {
        window.open(
          `https://wa.me/${toIntlPhone(adminPhone)}?text=${encodeURIComponent(message)}`,
          "_blank"
        );
      } else {
        window.location.href = `sms:${adminPhone}?body=${encodeURIComponent(message)}`;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת המיקום נכשלה");
    } finally {
      setLocating(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-lg"
            className="fixed bottom-6 start-6 z-40 size-14 min-h-[44px] rounded-full bg-destructive text-white shadow-lg hover:bg-destructive/90"
          />
        }
      >
        <SirenIcon className="size-6" />
        <span className="sr-only">חירום</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2" side="top" align="start">
        <p className="text-sm font-semibold">חיוג מהיר לשירותי חירום</p>
        <div className="grid gap-1.5">
          {EMERGENCY_NUMBERS.map((service) => (
            <Button
              key={service.number}
              variant="outline"
              className="min-h-11 justify-between"
              render={<a href={`tel:${service.number}`} />}
            >
              <span className="flex items-center gap-2">
                <PhoneIcon className="size-4" />
                {service.label}
              </span>
              <span dir="ltr" className="font-mono">
                {service.number}
              </span>
            </Button>
          ))}
        </div>

        <p className="pt-1 text-sm font-semibold">שליחת המיקום שלי למנהל</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={locating}
            onClick={() => sendLocation("whatsapp")}
          >
            <MessageCircleIcon data-icon="inline-start" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={locating}
            onClick={() => sendLocation("sms")}
          >
            <PhoneIcon data-icon="inline-start" />
            SMS
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
