import type { Collector } from "../base";
import { artnuri } from "./artnuri";
import { kstartup } from "./kstartup";
import { hrdArko } from "./hrdArko";
import { artmore } from "./artmore";
import { ncas } from "./ncas";
import { gokams } from "./gokams";
import { artnuriResidence } from "./artnuriResidence";
import { kgo } from "./kgo";
import { kofice } from "./kofice";
import { botame } from "./botame";
import { g2b } from "./g2b";
import { kocca } from "./kocca";
import { eduKocca } from "./eduKocca";

/** MVP 수집 대상 (PROJECT.md 18장 2단계) */
export const COLLECTORS: Collector[] = [artnuri, artnuriResidence, kgo, kofice, kocca, ncas, gokams, botame, g2b, kstartup, hrdArko, artmore, eduKocca];
