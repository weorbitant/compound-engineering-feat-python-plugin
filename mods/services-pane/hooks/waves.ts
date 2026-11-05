import type { DependsOn } from '../types/index'

type Services = Record<string, DependsOn[]>

const depsOf = (services: Services, s: string): string[] =>
  (services[s] ?? []).map((d) => d.service).filter((d) => d in services)

/** True when `s` can reach itself through known dependencies. */
const inCycle = (services: Services, s: string): boolean => {
  const seen = new Set<string>()
  const stack = depsOf(services, s)
  while (stack.length) {
    const cur = stack.pop() as string
    if (cur === s) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    stack.push(...depsOf(services, cur))
  }
  return false
}

/** Wave 1 for no deps; cycle members and unknown deps are treated as independent (wave 1). */
export const computeWaves = (services: Services): Record<string, number> => {
  const cyclic = new Set(Object.keys(services).filter((s) => inCycle(services, s)))
  const waves: Record<string, number> = {}
  const wave = (s: string): number => {
    if (s in waves) return waves[s]
    if (cyclic.has(s)) return (waves[s] = 1)
    const deps = depsOf(services, s)
    return (waves[s] = deps.length ? 1 + Math.max(...deps.map(wave)) : 1)
  }
  for (const s of Object.keys(services)) wave(s)
  return waves
}

/** Direct dependencies of `service` that are not yet done. */
export const waitingOn = (
  service: string,
  services: Services,
  isDone: (s: string) => boolean,
): string[] => (services[service] ?? []).map((d) => d.service).filter((d) => !isDone(d))
