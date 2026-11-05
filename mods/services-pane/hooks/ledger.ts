/** Task numbers marked complete in a superpowers progress ledger. */
export const completedTasks = (progressMd: string): Set<number> => {
  const done = new Set<number>()
  for (const line of progressMd.split('\n')) {
    const m = /^Task (\d+): complete\b/.exec(line)
    if (m) done.add(Number(m[1]))
  }
  return done
}

/** The workspace dir whose `plan-path` marker equals `plan` (repo-relative), else null. */
export const matchWorkspace = (
  markers: { dir: string; planPath: string }[],
  plan: string,
): string | null => {
  const want = plan.trim()
  return markers.find((m) => m.planPath.trim() === want)?.dir ?? null
}
