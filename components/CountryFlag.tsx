import {
  AE,
  AR,
  AT,
  AU,
  BE,
  BG,
  BR,
  CA,
  CH,
  CL,
  CN,
  CO,
  CY,
  CZ,
  DE,
  DK,
  EE,
  EG,
  ES,
  EU,
  FI,
  FR,
  GB,
  GR,
  HK,
  HR,
  HU,
  ID,
  IE,
  IL,
  IN,
  IS,
  IT,
  JP,
  KH,
  KR,
  KW,
  LT,
  LU,
  LV,
  MT,
  MX,
  MY,
  NG,
  NL,
  NO,
  NZ,
  PE,
  PH,
  PK,
  PL,
  PT,
  RO,
  RU,
  SA,
  SE,
  SG,
  SI,
  SK,
  TH,
  TR,
  TW,
  UA,
  US,
  VN,
  ZA,
} from "country-flag-icons/react/3x2";
import { countryFlagCode } from "@/lib/calendar/country-flags";
import { countries } from "@/lib/calendar/countries";

const flagComponents = {
  AE,
  AR,
  AT,
  AU,
  BE,
  BG,
  BR,
  CA,
  CH,
  CL,
  CN,
  CO,
  CY,
  CZ,
  DE,
  DK,
  EE,
  EG,
  ES,
  EU,
  FI,
  FR,
  GB,
  GR,
  HK,
  HR,
  HU,
  ID,
  IE,
  IL,
  IN,
  IS,
  IT,
  JP,
  KH,
  KR,
  KW,
  LT,
  LU,
  LV,
  MT,
  MX,
  MY,
  NG,
  NL,
  NO,
  NZ,
  PE,
  PH,
  PK,
  PL,
  PT,
  RO,
  RU,
  SA,
  SE,
  SG,
  SI,
  SK,
  TH,
  TR,
  TW,
  UA,
  US,
  VN,
  ZA,
};

export default function CountryFlag({ country }: { country: string }) {
  const code = countryFlagCode(country);
  const label = countries[country]?.km || country;
  const Flag = code
    ? flagComponents[code.toUpperCase() as keyof typeof flagComponents]
    : null;

  return Flag ? (
    <Flag
      role="img"
      aria-label={label}
      title={label}
      className="inline-block h-3 w-[18px] shrink-0 rounded-[2px] align-middle ring-1 ring-black/10"
    />
  ) : (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className="inline-block h-3 w-[18px] shrink-0 align-middle text-[#70818a]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <title>{label}</title>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 6.5h14M5 17.5h14" />
    </svg>
  );
}
