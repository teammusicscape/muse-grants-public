import type { Collector } from "../base";
import { artnuri } from "./artnuri";
import { kstartup } from "./kstartup";
import { hrdArko } from "./hrdArko";
import { artmore } from "./artmore";
import { ncas } from "./ncas";
import { gokams } from "./gokams";
import { artnuriResidence } from "./artnuriResidence";
import { kgo } from "./kgo";

/** MVP 수집 대상 (PROJECT.md 18장 2단계) */
export const COLLECTORS: Collector[] = [artnuri, artnuriResidence, kgo, ncas, gokams, kstartup, hrdArko, artmore];
