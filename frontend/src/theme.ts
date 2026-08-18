// Warm Swiss utility palette — "The Registrar Desk".
export const COLORS = {
  ink: "#18212B",
  paper: "#F7F5EF",
  surface: "#FFFDF8",
  line: "#D9D6CE",
  muted: "#5F6870",
  red: "#C83B32",
  moss: "#48634E",
  ochre: "#B77A24",
  navy: "#24364B",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  reviewer: "Reviewer",
  lecturer: "Lecturer",
  office: "Office",
};

export const ROLE_COLOR: Record<string, string> = {
  admin: COLORS.red,
  reviewer: COLORS.navy,
  lecturer: COLORS.moss,
  office: COLORS.ochre,
};

export function stageColor(stage: string): string {
  return stage === "Admitted"
    ? COLORS.moss
    : stage === "Under review"
      ? COLORS.navy
      : stage === "Documents"
        ? COLORS.ochre
        : COLORS.muted;
}
