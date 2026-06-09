const field = (key, label, value) => ({ key, label, value });

export const templates = [
  {
    id: "membership",
    name: "Membership",
    eyebrow: "Loyalty",
    passType: "generic",
    description: "A polished membership card with points and status.",
    colors: {
      background: "#5B4BDE",
      foreground: "#FFFFFF",
      label: "#D8D3FF",
    },
    logoText: "NORTHSTAR",
    organizationName: "Northstar Club",
    passDescription: "Northstar Club membership card",
    barcode: {
      format: "PKBarcodeFormatQR",
      message: "MEMBER-2048-AX",
      altText: "2048 1928 42",
    },
    fields: {
      header: [field("status", "STATUS", "GOLD")],
      primary: [field("member", "MEMBER", "ALEX MORGAN")],
      secondary: [
        field("number", "MEMBER NO.", "2048 1928"),
        field("since", "MEMBER SINCE", "2024"),
      ],
      auxiliary: [field("points", "POINTS", "12,480")],
      back: [
        field("benefits", "MEMBER BENEFITS", "Enjoy priority access, member pricing, and points on every purchase."),
        field("support", "SUPPORT", "support@example.com"),
      ],
    },
  },
  {
    id: "event",
    name: "Event ticket",
    eyebrow: "Events",
    passType: "eventTicket",
    description: "Tickets for conferences, concerts, and private events.",
    colors: {
      background: "#101828",
      foreground: "#FFFFFF",
      label: "#A8B3CF",
    },
    logoText: "SIGNAL / 26",
    organizationName: "Signal Events",
    passDescription: "Signal 2026 admission ticket",
    barcode: {
      format: "PKBarcodeFormatQR",
      message: "TICKET-SIGNAL-26-A104",
      altText: "A104",
    },
    fields: {
      header: [field("admit", "ADMIT", "1")],
      primary: [field("event", "EVENT", "SIGNAL 2026")],
      secondary: [
        field("date", "DATE", "JUN 18"),
        field("time", "TIME", "9:00 AM"),
      ],
      auxiliary: [
        field("venue", "VENUE", "CULTURE HALL"),
        field("seat", "SEAT", "A-104"),
      ],
      back: [
        field("doors", "DOORS OPEN", "Doors open at 8:00 AM. Please bring a valid photo ID."),
        field("terms", "TERMS", "This ticket is non-transferable."),
      ],
    },
  },
  {
    id: "coupon",
    name: "Coupon",
    eyebrow: "Offers",
    passType: "coupon",
    description: "A bold offer card built to drive store visits.",
    colors: {
      background: "#F04438",
      foreground: "#FFFFFF",
      label: "#FFE1DC",
    },
    logoText: "BRIGHT MARKET",
    organizationName: "Bright Market",
    passDescription: "Bright Market summer offer",
    barcode: {
      format: "PKBarcodeFormatQR",
      message: "SAVE25-SUMMER",
      altText: "SAVE25",
    },
    fields: {
      header: [field("offer", "OFFER", "LIMITED")],
      primary: [field("discount", "YOUR REWARD", "25% OFF")],
      secondary: [field("details", "USE ON", "ANY FULL-PRICE ITEM")],
      auxiliary: [field("expires", "VALID THROUGH", "JUL 31")],
      back: [
        field("terms", "TERMS", "One use per customer. Excludes gift cards and sale items."),
        field("locations", "WHERE TO USE", "Valid at all Bright Market locations."),
      ],
    },
  },
  {
    id: "store",
    name: "Store card",
    eyebrow: "Rewards",
    passType: "storeCard",
    description: "A balance and rewards card for retail customers.",
    colors: {
      background: "#087A5B",
      foreground: "#FFFFFF",
      label: "#B5E8D8",
    },
    logoText: "COMMON GROUND",
    organizationName: "Common Ground",
    passDescription: "Common Ground rewards card",
    barcode: {
      format: "PKBarcodeFormatQR",
      message: "CG-8392019",
      altText: "8392 019",
    },
    fields: {
      header: [field("tier", "TIER", "FOUNDING")],
      primary: [field("balance", "AVAILABLE BALANCE", "$48.50")],
      secondary: [
        field("name", "CARDHOLDER", "ALEX MORGAN"),
        field("visits", "VISITS", "24"),
      ],
      auxiliary: [field("reward", "NEXT REWARD", "1 VISIT")],
      back: [
        field("rewards", "REWARDS", "Earn one stamp on every visit. Ten stamps unlock a free item."),
        field("help", "CARD HELP", "hello@example.com"),
      ],
    },
  },
  {
    id: "boarding",
    name: "Boarding pass",
    eyebrow: "Travel",
    passType: "boardingPass",
    description: "A clean travel pass with route and boarding details.",
    colors: {
      background: "#175CD3",
      foreground: "#FFFFFF",
      label: "#C7D7FE",
    },
    logoText: "ALTITUDE",
    organizationName: "Altitude Air",
    passDescription: "Altitude Air boarding pass",
    barcode: {
      format: "PKBarcodeFormatPDF417",
      message: "M1MORGAN/ALEX EABC123 TLVAMMAL 0042 158Y012A0012 100",
      altText: "ABC123",
    },
    fields: {
      header: [field("flight", "FLIGHT", "AL 042")],
      primary: [
        field("origin", "TEL AVIV", "TLV"),
        field("destination", "AMMAN", "AMM"),
      ],
      secondary: [
        field("passenger", "PASSENGER", "ALEX MORGAN"),
        field("date", "DATE", "18 JUN"),
      ],
      auxiliary: [
        field("gate", "GATE", "B12"),
        field("seat", "SEAT", "12A"),
        field("boarding", "BOARDING", "08:15"),
      ],
      back: [
        field("sequence", "SEQUENCE", "0012"),
        field("notice", "TRAVEL NOTICE", "Boarding closes 20 minutes before departure."),
      ],
    },
  },
];

export const cloneTemplate = (template) => JSON.parse(JSON.stringify(template));
