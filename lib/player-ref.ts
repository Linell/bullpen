export type PlayerRef = {
  id: number;
  name: string;
};

export function playerRef(id: number | null, name: string | null): PlayerRef | undefined {
  return id != null && name != null ? { id, name } : undefined;
}
