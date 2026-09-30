export type ShipId = "ion" | "ember" | "void" | "sol";

export type ShipDef = {
  id: ShipId;
  name: string;
  blurb: string;
  trail: string;
  shield: string;
  preview: string;
};

const KEY = "ion-wake-ship-v1";

export const SHIPS: ShipDef[] = [
  {
    id: "ion",
    name: "Ion",
    blurb: "Stock hull. Cyan visor.",
    trail: "#4ad0ff",
    shield: "74, 208, 255",
    preview: "/sprites/ships/ion.png",
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Bronze plates. Amber burn.",
    trail: "#ff9a4a",
    shield: "255, 154, 74",
    preview: "/sprites/ships/ember.png",
  },
  {
    id: "void",
    name: "Void",
    blurb: "Matte black. Violet wake.",
    trail: "#b07cff",
    shield: "176, 124, 255",
    preview: "/sprites/ships/void.png",
  },
  {
    id: "sol",
    name: "Sol",
    blurb: "Ivory armor. Gold light.",
    trail: "#f0d080",
    shield: "240, 208, 128",
    preview: "/sprites/ships/sol.png",
  },
];

export function isShipId(v: unknown): v is ShipId {
  return v === "ion" || v === "ember" || v === "void" || v === "sol";
}

export function loadShip(): ShipId {
  try {
    const raw = localStorage.getItem(KEY);
    if (isShipId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "ion";
}

export function saveShip(id: ShipId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function shipDef(id: ShipId): ShipDef {
  return SHIPS.find((s) => s.id === id) ?? SHIPS[0];
}
