import Calendar from "./calendar";
import { cambodiaDate } from "@/lib/calendar/dates";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Calendar initialDate={cambodiaDate()} />;
}
